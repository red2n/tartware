#!/usr/bin/env node
/**
 * Contrast regression check for the shared palette.
 *
 *   node UI/shared-styles/check-contrast.mjs
 *
 * Parses the palette files directly rather than a hand-kept copy of the
 * values, so editing a token is what this test actually sees. Exits non-zero
 * on any failure, which is what makes it useful in CI.
 *
 * Thresholds are WCAG 2.2: 4.5:1 for body text (1.4.3), 3:1 for the visual
 * boundary of a control or a focus ring (1.4.11), 7:1 for text once the user
 * has asked for more contrast (1.4.6 AAA).
 *
 * Zero dependencies on purpose — it must keep working when neither app's
 * node_modules is installed.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/* ── Colour maths ──────────────────────────────────────────── */

/** #rgb, #rrggbb and #rrggbbaa → {r,g,b,a} with channels 0-255 and alpha 0-1. */
function parseHex(hex) {
	let h = hex.trim().replace("#", "");
	if (h.length === 3) h = [...h].map((c) => c + c).join("");
	if (h.length !== 6 && h.length !== 8) return null;
	return {
		r: parseInt(h.slice(0, 2), 16),
		g: parseInt(h.slice(2, 4), 16),
		b: parseInt(h.slice(4, 6), 16),
		a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
	};
}

/** Semi-transparent tokens (badge fills, hover washes) only have a real
 *  contrast once composited over what sits behind them. */
function over(fg, bg) {
	if (fg.a === 1) return fg;
	return {
		r: fg.r * fg.a + bg.r * (1 - fg.a),
		g: fg.g * fg.a + bg.g * (1 - fg.a),
		b: fg.b * fg.a + bg.b * (1 - fg.a),
		a: 1,
	};
}

function luminance({ r, g, b }) {
	const f = (c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg, bg) {
	const a = luminance(fg);
	const b = luminance(bg);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* ── Token extraction ──────────────────────────────────────── */

/**
 * Pull `--token: value` declarations out of the first block whose selector
 * line contains `selector`. Brace-counting rather than regex so the nested
 * blocks in contrast.css do not confuse it.
 */
function tokensFrom(file, selector) {
	const css = readFileSync(join(HERE, file), "utf8");
	const at = css.indexOf(selector);
	if (at === -1) throw new Error(`selector ${selector} not found in ${file}`);

	let depth = 0;
	let start = -1;
	for (let i = css.indexOf("{", at); i < css.length; i++) {
		if (css[i] === "{") {
			if (depth === 0) start = i + 1;
			depth++;
		} else if (css[i] === "}") {
			depth--;
			if (depth === 0) {
				const body = css.slice(start, i);
				const out = {};
				for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
					out[m[1]] = m[2].trim();
				}
				return out;
			}
		}
	}
	throw new Error(`unbalanced braces after ${selector} in ${file}`);
}

/** Follow `var(--x)` chains to a literal, then parse it. */
function resolve(name, scope, depth = 0) {
	if (depth > 10) throw new Error(`cyclic var reference at ${name}`);
	const raw = scope[name];
	if (raw === undefined) return null;
	const ref = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
	if (ref) return resolve(ref[1], scope, depth + 1);
	return parseHex(raw);
}

/* ── The pairings under test ───────────────────────────────── */

const TEXT = 4.5;
const UI = 3.0;
const AAA = 7.0;

/** [foreground token, background token, minimum ratio, description] */
const PAIRS = [
	["--fgColor-default", "--bgColor-default", TEXT, "body text on the page"],
	["--fgColor-default", "--bgColor-muted", TEXT, "body text on a panel"],
	["--fgColor-muted", "--bgColor-default", TEXT, "secondary text on the page"],
	["--fgColor-muted", "--bgColor-muted", TEXT, "secondary text on a panel"],
	["--fgColor-accent", "--bgColor-default", TEXT, "link on the page"],
	["--fgColor-accent", "--bgColor-muted", TEXT, "link on a panel"],
	["--fgColor-success", "--bgColor-default", TEXT, "success text"],
	["--fgColor-danger", "--bgColor-default", TEXT, "danger text"],
	["--fgColor-attention", "--bgColor-default", TEXT, "attention text"],
	["--fgColor-done", "--bgColor-default", TEXT, "done text"],
	["--fgColor-onEmphasis", "--bgColor-accent-emphasis", TEXT, "label on a CTA"],
	["--fgColor-onEmphasis", "--button-primary-bgColor-rest", TEXT, "primary button at rest"],
	["--fgColor-onEmphasis", "--button-primary-bgColor-hover", TEXT, "primary button hovered"],
	["--fgColor-onEmphasis", "--button-primary-bgColor-active", TEXT, "primary button active"],
	["--fgColor-onEmphasis", "--bgColor-emphasis", TEXT, "label on the emphasis surface"],
	["--borderColor-control", "--bgColor-default", UI, "input border on the page"],
	["--borderColor-control", "--bgColor-muted", UI, "input border on a panel"],
	["--borderColor-accent-emphasis", "--bgColor-default", UI, "focus ring on the page"],
];

/** Same pairings, but text must reach AAA once more contrast is requested. */
const HC_PAIRS = PAIRS.map(([fg, bg, min, label]) => [
	fg,
	bg,
	min === TEXT ? AAA : 4.5,
	label,
]);

/* ── Run ───────────────────────────────────────────────────── */

const THEMES = [
	{
		name: "light",
		base: tokensFrom("palette-light.css", '[data-theme="light"]'),
		hc: tokensFrom("contrast.css", '[data-theme="light"]'),
	},
	{
		name: "dark",
		base: tokensFrom("palette-dark.css", '[data-theme="dark"]'),
		hc: tokensFrom("contrast.css", '[data-theme="dark"]'),
	},
];

let failures = 0;
let checked = 0;

for (const theme of THEMES) {
	for (const [mode, scope, pairs] of [
		["normal", theme.base, PAIRS],
		["prefers-contrast", { ...theme.base, ...theme.hc }, HC_PAIRS],
	]) {
		console.log(`\n  ${theme.name} · ${mode}`);
		for (const [fgName, bgName, min, label] of pairs) {
			const bg = resolve(bgName, scope);
			let fg = resolve(fgName, scope);
			if (!bg || !fg) {
				console.log(`  SKIP        ${label} — ${!bg ? bgName : fgName} undefined`);
				continue;
			}
			// A translucent surface sits over the page, not over nothing.
			const page = resolve("--bgColor-default", scope);
			const bgSolid = over(bg, page);
			fg = over(fg, bgSolid);

			const r = ratio(fg, bgSolid);
			const ok = r >= min;
			checked++;
			if (!ok) failures++;
			console.log(
				`  ${ok ? "pass" : "FAIL"}  ${r.toFixed(2).padStart(6)}:1  (min ${min})  ${label}`,
			);
		}
	}
}

console.log(
	`\n${failures === 0 ? "OK" : "FAILED"} — ${checked - failures}/${checked} pairings pass\n`,
);
process.exit(failures === 0 ? 0 : 1);
