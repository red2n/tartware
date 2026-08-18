#!/usr/bin/env node
/**
 * Tartware UI driver — launches a real browser against the running dev
 * servers and drives pms-ui / guest-portal.
 *
 *   node .claude/skills/run-tartware-ui/driver.mjs <command> [flags]
 *
 * Commands
 *   shots    screenshot pages across theme modes
 *   tokens   dump COMPUTED design tokens + element styles per mode
 *   toggle   exercise the pms-ui three-way theme toggle (mutates the DB!)
 *
 * Flags
 *   --app pms|guest|both      default both
 *   --modes light,dark,hc,forced   default light,dark
 *   --out <dir>               default ./ui-shots
 *
 * Requires: dev servers on 4200/4300 (see SKILL.md), and for pms-ui the
 * backend gateway on 8080. chromium-cli is NOT installed in this container;
 * the repo's own Playwright is the browser harness.
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const UI = resolve(HERE, "../../..");            // <repo>/UI
const REPO = resolve(UI, "..");                   // <repo>

// Resolve playwright through node resolution rather than a version-pinned
// path under .pnpm — the store path changes on every upgrade. It is CommonJS,
// so `import { chromium }` fails; createRequire is the working form.
let chromium;
try {
	const req = createRequire(join(UI, "pms-ui", "package.json"));
	({ chromium } = req("playwright"));
} catch (e) {
	console.error("Cannot load playwright from UI/pms-ui.\n  " + e.message);
	process.exit(2);
}

/* ── flags ─────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n, d) => {
	const i = argv.indexOf(`--${n}`);
	return i === -1 ? d : argv[i + 1];
};
const APP = flag("app", "both");
const OUT = resolve(flag("out", join(process.cwd(), "ui-shots")));
const MODE_NAMES = flag("modes", "light,dark").split(",").map((s) => s.trim());

const MEDIA = {
	light: { colorScheme: "light" },
	dark: { colorScheme: "dark" },
	hc: { colorScheme: "light", contrast: "more" },
	forced: { colorScheme: "light", forcedColors: "active" },
};

const PMS = "http://localhost:4200";
const GUEST = "http://localhost:4300";
const CREDS = { user: "setup.admin", pass: "TempPass1234", property: "Tartware Beach Resort" };

/* ── helpers ───────────────────────────────────────────── */

async function up(url) {
	try {
		const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
		return r.status < 500;
	} catch {
		return false;
	}
}

async function preflight() {
	const checks = [];
	if (APP !== "guest") {
		checks.push(["pms-ui        :4200", await up(PMS)]);
		checks.push(["api-gateway   :8080", await up("http://localhost:8080/health")]);
	}
	if (APP !== "pms") checks.push(["guest-portal  :4300", await up(GUEST)]);
	let bad = false;
	for (const [name, ok] of checks) {
		console.log(`  ${ok ? "up  " : "DOWN"}  ${name}`);
		if (!ok) bad = true;
	}
	if (bad) {
		console.error("\nSomething is not running. See SKILL.md § Start the stack.");
		process.exit(3);
	}
}

/**
 * pms-ui is behind auth. Log in and select a property, return storageState so
 * later contexts skip the flow. Uses domcontentloaded + waitForURL: the app
 * polls, so `networkidle` never settles and any goto waiting on it times out.
 */
async function login(browser) {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	await page.goto(`${PMS}/login`, { waitUntil: "domcontentloaded" });
	await page.getByLabel("Username").fill(CREDS.user);
	await page.getByRole("textbox", { name: "Password" }).fill(CREDS.pass);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL("**/select-property", { timeout: 30_000 });
	await page.getByRole("button", { name: CREDS.property }).click();
	await page.getByRole("button", { name: "Continue" }).click();
	await page.waitForURL("**/dashboard", { timeout: 30_000 });
	const state = await ctx.storageState();
	await ctx.close();
	return state;
}

/** Never use networkidle here — see login(). */
async function visit(page, url) {
	await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
	await page.waitForLoadState("load").catch(() => {});
	await page.waitForTimeout(3000);
}

const PMS_PAGES = [["dashboard", `${PMS}/dashboard`], ["guests", `${PMS}/guests`]];
const GUEST_PAGES = [["search", `${GUEST}/search`], ["lookup", `${GUEST}/lookup`]];

/* ── commands ──────────────────────────────────────────── */

async function cmdShots(browser) {
	mkdirSync(OUT, { recursive: true });
	const state = APP === "guest" ? null : await login(browser);
	for (const m of MODE_NAMES) {
		const media = MEDIA[m];
		if (!media) { console.error(`unknown mode "${m}"`); continue; }
		for (const [which, pages, vp] of [
			["pms", PMS_PAGES, { width: 1440, height: 900 }],
			["gp", GUEST_PAGES, { width: 1280, height: 900 }],
		]) {
			if (APP === "pms" && which !== "pms") continue;
			if (APP === "guest" && which !== "gp") continue;
			const ctx = await browser.newContext({
				viewport: vp, ...(which === "pms" ? { storageState: state } : {}), ...media,
			});
			const page = await ctx.newPage();
			await page.emulateMedia(media);
			for (const [name, url] of pages) {
				await visit(page, url);
				const f = join(OUT, `${which}-${name}-${m}.png`);
				await page.screenshot({ path: f });
				const theme = await page.getAttribute("html", "data-theme");
				console.log(`  ${`${which}-${name}`.padEnd(16)} ${m.padEnd(7)} data-theme=${theme}  ${f}`);
			}
			await ctx.close();
		}
	}
}

/**
 * Dumps the values that actually landed. This is how you catch a rule that
 * silently lost the cascade — a screenshot will not tell you that a border is
 * 0px because a component style outranked a global one.
 */
async function cmdTokens(browser) {
	const state = APP === "guest" ? null : await login(browser);
	for (const m of MODE_NAMES) {
		const media = MEDIA[m];
		if (!media) continue;
		if (APP !== "guest") {
			const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: state, ...media });
			const page = await ctx.newPage();
			await page.emulateMedia(media);
			await visit(page, `${PMS}/guests`);
			const r = await page.evaluate(() => {
				const cs = (p) => getComputedStyle(document.documentElement).getPropertyValue(p).trim();
				const el = (s, pseudo) => {
					const n = document.querySelector(s);
					if (!n) return "MISSING";
					const c = getComputedStyle(n, pseudo || undefined);
					return `${c.borderTopWidth}/${c.width} ${c.backgroundColor}`;
				};
				return {
					theme: document.documentElement.getAttribute("data-theme"),
					fgMuted: cs("--fgColor-muted"),
					fgAccent: cs("--fgColor-accent"),
					ctaRest: cs("--button-primary-bgColor-rest"),
					badge: el(".badge"),
					navBar: el(".nav-item-active", "::before"),
				};
			});
			console.log(`\n[pms ${m}]`);
			for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(10)} ${v}`);
			await ctx.close();
		}
		if (APP !== "pms") {
			const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...media });
			const page = await ctx.newPage();
			await page.emulateMedia(media);
			await visit(page, `${GUEST}/search`);
			const r = await page.evaluate(() => {
				const b = [...document.querySelectorAll("button")].find((x) => /Search Availability/i.test(x.textContent));
				const s = b ? getComputedStyle(b) : null;
				return {
					theme: document.documentElement.getAttribute("data-theme"),
					cta: s ? `${s.backgroundColor} on-label ${s.color}` : "MISSING",
				};
			});
			console.log(`\n[guest ${m}]`);
			for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(10)} ${v}`);
			await ctx.close();
		}
	}
}

/**
 * Cycles the topbar theme control through all three modes.
 * WARNING: ThemeService.setTheme() PUTs to /users/me/ui-preferences, so this
 * leaves setup.admin on whatever mode it stops at. Reset afterwards — the
 * exact SQL is in SKILL.md § Gotchas.
 */
async function cmdToggle(browser) {
	mkdirSync(OUT, { recursive: true });
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const page = await ctx.newPage();
	await page.goto(`${PMS}/login`, { waitUntil: "domcontentloaded" });
	await page.getByLabel("Username").fill(CREDS.user);
	await page.getByRole("textbox", { name: "Password" }).fill(CREDS.pass);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL("**/select-property", { timeout: 30_000 });
	await page.getByRole("button", { name: CREDS.property }).click();
	await page.getByRole("button", { name: "Continue" }).click();
	await page.waitForURL("**/dashboard", { timeout: 30_000 });
	await page.waitForTimeout(2500);

	const btn = page.getByRole("button", { name: /^Switch to/ });
	for (let i = 0; i < 4; i++) {
		const label = await btn.getAttribute("aria-label");
		const theme = await page.getAttribute("html", "data-theme");
		const stored = await page.evaluate(() => localStorage.getItem("theme_mode"));
		console.log(`  step ${i}: data-theme=${String(theme).padEnd(5)} stored=${String(stored).padEnd(6)} "${label}"`);
		await page.screenshot({ path: join(OUT, `pms-toggle-${i}-${stored}.png`) });
		await btn.click();
		await page.waitForTimeout(1500);
	}
	console.log("\n  NOTE: setup.admin's stored theme was changed. Reset it — see SKILL.md.");
	await ctx.close();
}

/* ── main ──────────────────────────────────────────────── */

const COMMANDS = { shots: cmdShots, tokens: cmdTokens, toggle: cmdToggle };
if (!COMMANDS[cmd]) {
	console.error("usage: driver.mjs <shots|tokens|toggle> [--app pms|guest|both] [--modes light,dark,hc,forced] [--out dir]");
	process.exit(1);
}

await preflight();
const browser = await chromium.launch().catch((e) => {
	if (/libnspr4|libnss3|libasound|shared libraries/.test(String(e))) {
		console.error("\nChromium is missing system libraries.\nRun the deps step in SKILL.md § Prerequisites, then re-run with LD_LIBRARY_PATH set.");
		process.exit(4);
	}
	throw e;
});
try {
	await COMMANDS[cmd](browser);
} finally {
	await browser.close();
}
