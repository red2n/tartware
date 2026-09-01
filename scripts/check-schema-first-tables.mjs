#!/usr/bin/env node
/**
 * Every table the DDL creates must have a type in `schema/`.
 *
 * Schema-first is the repo's first non-negotiable and the only one nothing
 * checked: `AGENTS.md` says domain types live in `schema/` and are imported
 * from there, and the rule was enforced by review alone. An audit on
 * 2026-09-01 found nineteen tables with no type in `schema/` at all, and two
 * whose row shapes were declared in `Apps/command-center-shared` and read from
 * three files — a domain type in `Apps/`, which is the exact thing the rule
 * prohibits. Both moved; the rest are named below.
 *
 * Covered means `schema/src` **exports a declared shape** named for the table —
 * `FolioSchema`, `FolioRowSchema`, `FolioRow`, singular or plural. Not a bare
 * mention: the first version of this check accepted any occurrence of the name,
 * and `ar_accounts` passed because `ArAccountCreateCommandSchema` contains the
 * word. A command payload is not the shape of the row it eventually writes, and
 * a check that accepts one for the other reports nine tables as typed that are
 * read through inline generics.
 *
 * Run: node scripts/check-schema-first-tables.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TABLES_DIR = "scripts/tables";
const SCHEMA_SRC = "schema/src";

/**
 * Tables with no type in `schema/` as of 2026-09-01, kept so the check can run
 * green while the debt is visible and countable.
 *
 * **This list may only shrink.** An entry is a table the product reads or
 * writes through inline `query<{ … }>` generics — a shape each caller re-derives
 * privately, which is the drift schema-first exists to stop. Nine of the twelve
 * are the AR ledger, which is the least-typed corner of the product and the one
 * that moves money. `fiscal_periods` and `night_audit_runs` were on this list
 * until the check told me they have row types already — the audit that produced
 * it looked only for `<Name>Schema` and missed `<Name>Row`.
 *
 * Adding a new table here instead of a schema type defeats the check. If a
 * table genuinely has no shape worth declaring — a partition, a sequence
 * counter — say so in the comment beside it.
 */
const KNOWN_UNTYPED = new Map([
  // AR ledger — the largest gap, all read through inline row generics.
  ["ar_accounts", "AR account master; read by ara.ts and the AR routes"],
  ["ar_city_ledger", "city ledger entries; the write-off and transfer handlers"],
  ["ar_disputes", "dispute register"],
  ["ar_aging_snapshots", "aging run output"],
  ["ar_cash_applications", "payment-to-invoice application"],
  ["ar_dunning_events", "dunning ladder history"],
  ["folio_windows", "folio window routing"],
  ["invoice_sequences", "per-property invoice numbering counter"],
  // Elsewhere.
  ["walk_history", "walked-guest register"],
  ["payment_gateway_webhooks", "raw gateway callbacks"],
  ["overbooking_config", "no reader yet"],
  ["tenant_access_audit", "partitioned access log; no reader yet"],
]);

/** Partition shards and parse artefacts, which are not shapes of their own. */
const IGNORED = /(_p\d+$|_default$|_partitioned$|_$)/;

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
};

const tables = new Map();
for (const file of walk(TABLES_DIR).filter((f) => f.endsWith(".sql"))) {
  // Line comments are stripped first: three of these files discuss "the
  // CREATE TABLE parser" or "the canonical CREATE TABLE scripts" in prose, and
  // reading those as DDL invented tables called `parser` and `scripts`.
  const sql = readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  // The optional qualifier is any schema, not just `public` — inventory lives
  // in `availability.room_availability`, and matching only `public.` took the
  // qualifier for the table name.
  for (const match of sql.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[a-z_][a-z0-9_]*\.)?([a-z_][a-z0-9_]*)\s*\(/gi,
  )) {
    const table = match[1].toLowerCase();
    if (!tables.has(table)) tables.set(table, file);
  }
}

/** Every `export const X = …` / `export type X` / `export interface X` in schema/. */
const schemaExports = new Set();
for (const file of walk(SCHEMA_SRC).filter((f) => f.endsWith(".ts"))) {
  for (const match of readFileSync(file, "utf8").matchAll(
    /export\s+(?:const|type|interface)\s+([A-Za-z0-9_]+)/g,
  )) {
    schemaExports.add(match[1]);
  }
}

const pascal = (snake) =>
  snake
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const singular = (word) => {
  // `-ches`/`-shes`/`-xes` before the bare `-s`, or `command_batches` singularises
  // to `command_batche` and the type named after it is never found.
  for (const [suffix, replacement] of [
    ["ies", "y"],
    ["ches", "ch"],
    ["shes", "sh"],
    ["xes", "x"],
    ["ses", "s"],
    ["s", ""],
  ]) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length) + replacement;
    }
  }
  return word;
};

const isCovered = (table) => {
  const plural = pascal(table);
  const single = pascal(singular(table));
  return [
    `${plural}Schema`,
    `${single}Schema`,
    `${plural}RowSchema`,
    `${single}RowSchema`,
    `${plural}Row`,
    `${single}Row`,
    plural,
    single,
  ].some((form) => schemaExports.has(form));
};

const missing = [];
const staleAllowances = [];

for (const [table, file] of [...tables].sort()) {
  if (IGNORED.test(table)) continue;
  const covered = isCovered(table);
  if (!covered && !KNOWN_UNTYPED.has(table)) missing.push({ table, file });
  if (covered && KNOWN_UNTYPED.has(table)) staleAllowances.push(table);
}

if (missing.length > 0) {
  console.error("\nTable with no type in schema/:\n");
  for (const { table, file } of missing) {
    console.error(`  ${table}  (${file})`);
  }
  console.error(
    `\nSchema-first: the shape of a table belongs in schema/ so every reader\n` +
      `shares one definition. Declare it there — a row type beside\n` +
      `schema/src/api/reservation-rows.ts, or a zod object if it is validated at\n` +
      `an API boundary — and import it. Do not add it to KNOWN_UNTYPED in\n` +
      `${import.meta.url.split("/").pop()}; that list is the debt this check is\n` +
      `paying down, and it may only shrink.\n`,
  );
  process.exit(1);
}

if (staleAllowances.length > 0) {
  console.error(
    `\nThese tables now have a type in schema/ and should be removed from\n` +
      `KNOWN_UNTYPED, so the list keeps reflecting the real debt:\n`,
  );
  for (const table of staleAllowances) console.error(`  ${table}`);
  console.error("");
  process.exit(1);
}

const counted = [...tables.keys()].filter((table) => !IGNORED.test(table));
console.log(
  `Schema-first tables OK — ${counted.length} tables, ` +
    `${counted.length - KNOWN_UNTYPED.size} typed in schema/, ` +
    `${KNOWN_UNTYPED.size} known untyped (see KNOWN_UNTYPED).`,
);
