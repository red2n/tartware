#!/usr/bin/env node
/**
 * Translation coverage check for pms-ui.
 *
 *   node UI/pms-ui/check-i18n.mjs
 *
 * The English string IS the key here (see core/i18n/i18n.service.ts), so this
 * reads the keys straight out of the templates rather than a hand-kept catalogue.
 * Editing a template is what this check actually sees.
 *
 * Three failures, all of which have happened:
 *   1. a key reaches `| translate` or `i18n.t()` with no entry in a locale file
 *      — the string silently renders in English, which looks like "translations
 *      don't work" rather than a missing row;
 *   2. the locale files drift apart, so one language is quietly behind;
 *   3. a `{placeholder}` in the English key has no counterpart in a translation,
 *      which renders the literal braces to the user.
 *
 * Orphans (entries no longer used) are reported but do not fail — a string can
 * legitimately be re-added, and deleting translation work is worse than carrying it.
 *
 * Zero dependencies on purpose — it must keep working with no node_modules.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "src");
const I18N = join(HERE, "public/assets/i18n");
const LANGS = ["es", "fr", "zh-TW"];

/**
 * Component inputs the receiving component already pipes through `| translate`.
 * A literal passed to one of these still needs a locale entry even though the
 * call site has no pipe on it.
 */
const SELF_TRANSLATING = {
	"app-page-header": ["title", "description"],
	"app-stat-card": ["title"],
	"app-dialog-shell": ["heading"],
	"app-callout": ["heading"],
	"app-dialog-actions": ["saveLabel", "savingLabel"],
};

/* ── Collect ───────────────────────────────────────────────── */

function walk(dir, out = []) {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.(html|ts)$/.test(name) && !name.endsWith(".spec.ts")) out.push(p);
	}
	return out;
}

const norm = (s) => s.replace(/\s+/g, " ").trim();

/** key -> Set of files that use it */
const used = new Map();
const add = (key, file) => {
	const k = norm(key);
	if (!k) return;
	if (!used.has(k)) used.set(k, new Set());
	used.get(k).add(relative(HERE, file));
};

const PIPE = /(['"])((?:\\.|(?!\1).)*)\1\s*\|\s*translate/g;
const TFN = /i18n\.t\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;

/**
 * Object-literal fields whose values reach a template as `x.<field> | translate`
 * — nav labels, report definitions, status tables, tooltip maps. The literal is
 * in a .ts file with no pipe next to it, so nothing but this list finds it, and
 * a menu label with no entry is exactly the kind of gap that ships unnoticed.
 */
const DATA_FIELDS = ["label", "description", "section", "title", "detail", "action", "tooltip", "hint"];

for (const file of walk(SRC)) {
	if (file.endsWith("index.html")) continue;
	const text = readFileSync(file, "utf8");
	for (const m of text.matchAll(PIPE)) add(m[2].replace(/\\(['"])/g, "$1"), file);
	for (const m of text.matchAll(TFN)) add(m[2].replace(/\\(['"])/g, "$1"), file);
	if (file.endsWith(".ts")) {
		for (const field of DATA_FIELDS) {
			for (const q of ['"', "'"]) {
				const re = new RegExp(`(?<![\\w.])${field}:\\s*${q}((?:\\\\.|[^${q}])*)${q}`, "g");
				for (const m of text.matchAll(re)) {
					const v = m[1].replace(/\\(['"])/g, "$1");
					if (/[A-Za-z]{2}/.test(v)) add(v, file);
				}
			}
		}
	}
	for (const [tag, attrs] of Object.entries(SELF_TRANSLATING)) {
		for (const el of text.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gs"))) {
			for (const attr of attrs) {
				const re = new RegExp(`(?<![\\[\\w-])${attr}="([^"{}]+)"`, "g");
				for (const a of el[0].matchAll(re)) add(a[1], file);
			}
		}
	}
}

/* ── Compare ───────────────────────────────────────────────── */

const locales = Object.fromEntries(
	LANGS.map((l) => {
		const raw = JSON.parse(readFileSync(join(I18N, `${l}.json`), "utf8"));
		return [l, Object.fromEntries(Object.entries(raw).filter(([k]) => !k.startsWith("_comment")))];
	}),
);

const failures = [];
const placeholders = (s) => (s.match(/\{(\w+)\}/g) ?? []).sort().join(",");

for (const lang of LANGS) {
	const missing = [...used.keys()].filter((k) => !(k in locales[lang])).sort();
	if (missing.length) {
		failures.push(
			`${lang}.json is missing ${missing.length} key(s) used in the UI:\n` +
				missing.slice(0, 20).map((k) => `    ${JSON.stringify(k)}  (${[...used.get(k)][0]})`).join("\n") +
				(missing.length > 20 ? `\n    …and ${missing.length - 20} more` : ""),
		);
	}
	const badParams = [...used.keys()]
		.filter((k) => k in locales[lang] && placeholders(k) !== placeholders(locales[lang][k]))
		.sort();
	if (badParams.length) {
		failures.push(
			`${lang}.json has ${badParams.length} entr(ies) whose {placeholders} do not match the English key:\n` +
				badParams.slice(0, 10).map((k) => `    ${JSON.stringify(k)}\n      → ${JSON.stringify(locales[lang][k])}`).join("\n"),
		);
	}
}

/*
 * A value from one of those data fields must still be piped where it is rendered.
 * `[pTooltip]="typeInfo.tooltip"` looks translated — the strings are in the
 * catalogue — but with no pipe on the binding the user reads raw English. The
 * fields are ours; API/user data (void_reason, housekeeping_notes, …) is not
 * matched here, so anything this finds is a genuine miss.
 */
/*
 * Only the fields that are ours by convention. `description`, `title` and
 * `detail` also name API and form-input values (an activity feed entry, a charge
 * the user typed) which must render exactly as stored — failing on those would
 * be noise, so they are left to review rather than checked here.
 */
const BOUND_FIELDS = ["label", "tooltip", "section"];
const BINDING = new RegExp(
	`(?:\\[[\\w.-]+\\]="|\\{\\{\\s*)([\\w$]+(?:\\(\\))?(?:\\??\\.[\\w$]+)*\\.(?:${BOUND_FIELDS.join("|")}))(?![\\w.])(?!\\s*\\|\\s*translate)`,
	"g",
);
const unpiped = [];
for (const file of walk(SRC)) {
	if (!file.endsWith(".html")) continue;
	const text = readFileSync(file, "utf8");
	for (const m of text.matchAll(BINDING)) {
		const line = text.slice(0, m.index).split("\n").length;
		unpiped.push(`${relative(HERE, file)}:${line}  ${m[1]}`);
	}
}
if (unpiped.length) {
	failures.push(
		`${unpiped.length} binding(s) render a translatable field without \`| translate\`:\n` +
			unpiped.slice(0, 15).map((u) => `    ${u}`).join("\n") +
			(unpiped.length > 15 ? `\n    …and ${unpiped.length - 15} more` : ""),
	);
}

// The locale files must carry the same key set as each other.
const keySets = LANGS.map((l) => new Set(Object.keys(locales[l])));
for (let i = 1; i < LANGS.length; i++) {
	const only = [...keySets[0]].filter((k) => !keySets[i].has(k));
	const other = [...keySets[i]].filter((k) => !keySets[0].has(k));
	if (only.length || other.length) {
		failures.push(
			`${LANGS[0]}.json and ${LANGS[i]}.json have drifted apart: ` +
				`${only.length} key(s) only in ${LANGS[0]}, ${other.length} only in ${LANGS[i]}.`,
		);
	}
}

/* ── Report ────────────────────────────────────────────────── */

const orphans = Object.keys(locales[LANGS[0]]).filter((k) => !used.has(k));

console.log(`i18n: ${used.size} keys used across ${LANGS.length} locales`);
if (orphans.length) console.log(`i18n: ${orphans.length} orphan entr(ies) no longer used (not a failure)`);

if (failures.length) {
	console.error(`\n✗ i18n check failed\n\n${failures.join("\n\n")}\n`);
	process.exit(1);
}
console.log("✓ every translatable string has an entry in every locale");
