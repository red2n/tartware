#!/usr/bin/env tsx
/**
 * SQL Contract Check
 *
 * Binds the SQL embedded in `Apps/` to the schema `scripts/tables/` creates.
 * Every table and column named in a query must exist, or the query fails at
 * runtime with 42P01 (undefined_table) / 42703 (undefined_column) — errors no
 * unit test catches, because service tests mock the database by matching SQL
 * strings rather than executing them.
 *
 * The catalog is built by parsing DDL rather than by connecting to Postgres, so
 * this runs in CI with no database. It is kept faithful to what a real database
 * ends up with by replaying the pieces `setup-database.sh` applies on top of the
 * CREATE TABLE statements — see UNIVERSAL_COLUMNS.
 *
 * Known violations live in sql-contract-baseline.json so this can be adopted
 * without fixing the entire backlog first. New violations fail the build; fixing
 * a baselined one also fails, with instructions to delete the stale entry, so
 * the baseline can only shrink.
 *
 * Run: npx tsx scripts/sql-contract-check.ts
 * Exit 0 = no violations outside the baseline.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const TABLES_DIR = join(ROOT, "scripts", "tables");
const MANIFEST = join(TABLES_DIR, "00-create-all-tables.sql");
const MIGRATIONS_DIR = join(ROOT, "scripts", "migrations");
const APPS = join(ROOT, "Apps");
const BASELINE = join(__dirname, "sql-contract-baseline.json");

/**
 * Columns 99_enforce_tenant_soft_delete.sql adds to every table in a DO block.
 * Dynamic SQL is invisible to a static parser, so they are asserted here; the
 * script is the reason a table can be queried for `is_deleted` despite no
 * CREATE TABLE ever mentioning it.
 */
const UNIVERSAL_COLUMNS = ["tenant_id", "is_deleted", "deleted_at", "deleted_by"];

/**
 * Set-returning functions that appear where a table name would. Most are caught
 * by the trailing "(", but LATERAL and the bare forms need naming.
 */
const SET_RETURNING_FUNCTIONS = new Set([
  "generate_series", "unnest", "jsonb_array_elements", "json_array_elements",
  "jsonb_array_elements_text", "json_array_elements_text", "jsonb_each",
  "json_each", "jsonb_to_recordset", "json_to_recordset", "regexp_split_to_table",
  "lateral", "dual", "only",
]);

/**
 * Fills `${...}` interpolations. Any character outside [a-z_0-9] works; a
 * blank would let `UPDATE ${table} ${alias} SET` parse as a table named "SET".
 */
const SENTINEL = "\u0001";

/** Leading words that begin a table constraint rather than a column. */
const CONSTRAINT_KEYWORDS = new Set([
  "constraint", "primary", "foreign", "unique", "check", "exclude", "like",
]);

type Violation = {
  kind: "missing-table" | "wrong-schema" | "missing-column";
  file: string;
  line: number;
  detail: string;
};

// ─── DDL catalog ─────────────────────────────────────────────────────────────

/** table name -> { schema, columns } */
const catalog = new Map<string, { schema: string; columns: Set<string> }>();

/** Split a CREATE TABLE body on top-level commas, ignoring commas in parens. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** Read the balanced parenthesised body starting at `open`. */
function readBalanced(text: string, open: number): { body: string; end: number } {
  let depth = 1;
  let i = open;
  while (i < text.length && depth > 0) {
    i++;
    if (text[i] === "(") depth++;
    else if (text[i] === ")") depth--;
  }
  return { body: text.slice(open + 1, i), end: i };
}

/** Strip `-- line` and block comments so they cannot be read as SQL. */
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function parseCreateTables(sql: string): void {
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:([a-z_0-9]+)\.)?([a-z_0-9]+)\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const schema = (m[1] ?? "public").toLowerCase();
    const table = m[2]!.toLowerCase();
    const { body, end } = readBalanced(sql, re.lastIndex - 1);
    re.lastIndex = end;

    const columns = new Set<string>(UNIVERSAL_COLUMNS);
    for (const part of splitTopLevel(body)) {
      const token = part.trim().split(/\s+/)[0]?.toLowerCase();
      if (!token || !/^[a-z_][a-z_0-9]*$/.test(token)) continue;
      if (CONSTRAINT_KEYWORDS.has(token)) continue;
      columns.add(token);
    }
    catalog.set(table, { schema, columns });
  }
}

function parseAlterAddColumn(sql: string): void {
  const re =
    /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:[a-z_0-9]+\.)?([a-z_0-9]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_0-9]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    catalog.get(m[1]!.toLowerCase())?.columns.add(m[2]!.toLowerCase());
  }
}

function buildCatalog(): void {
  // The manifest is the source of truth: a table script it does not include
  // creates nothing, so it defines nothing.
  const manifest = readFileSync(MANIFEST, "utf-8");
  const includes = [...manifest.matchAll(/^\\ir\s+(\S+)/gm)].map((m) => m[1]!);

  const sqlFiles = includes.map((p) => join(TABLES_DIR, p)).filter(existsSync);
  for (const file of sqlFiles) parseCreateTables(stripSqlComments(readFileSync(file, "utf-8")));
  // Second pass: an ALTER may target a table created by a later include.
  for (const file of sqlFiles) parseAlterAddColumn(stripSqlComments(readFileSync(file, "utf-8")));

  if (existsSync(MIGRATIONS_DIR)) {
    for (const name of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"))) {
      parseAlterAddColumn(stripSqlComments(readFileSync(join(MIGRATIONS_DIR, name), "utf-8")));
    }
  }
}

// ─── Extracting SQL from TypeScript ──────────────────────────────────────────

/**
 * Template literals are where every query in this codebase lives. Restricting
 * the scan to them keeps prose out: a comment saying "update the room from the
 * booking" would otherwise parse as `UPDATE the` / `FROM booking`.
 */
function extractTemplateLiterals(source: string): { sql: string; offset: number }[] {
  const out: { sql: string; offset: number }[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    // Comments are skipped wholesale: a JSDoc block illustrating
    // `pool.query('UPDATE users SET ...')` is documentation, not a query, and
    // an apostrophe or backtick inside prose would derail the scanner.
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      i++;
      while (i < source.length && source[i] !== ch) i += source[i] === "\\" ? 2 : 1;
      i++;
      continue;
    }
    if (ch !== "`") {
      i++;
      continue;
    }

    const start = ++i;
    let literal = "";
    while (i < source.length && source[i] !== "`") {
      if (source[i] === "\\") {
        literal += "  ";
        i += 2;
        continue;
      }
      // Interpolations are filled with a non-identifier sentinel: blanks would
      // let `UPDATE ${table} ${alias} SET` read as a table named "SET".
      if (source[i] === "$" && source[i + 1] === "{") {
        let depth = 1;
        const from = i;
        i += 2;
        while (i < source.length && depth > 0) {
          if (source[i] === "{") depth++;
          else if (source[i] === "}") depth--;
          i++;
        }
        literal += SENTINEL.repeat(i - from);
        continue;
      }
      literal += source[i];
      i++;
    }
    if (/\b(SELECT|INSERT|UPDATE|DELETE)\b/i.test(literal)) out.push({ sql: literal, offset: start });
    i++;
  }
  return out;
}

/**
 * Blank out functions that take a SQL keyword as an argument — EXTRACT(DOW FROM
 * col), SUBSTRING(s FROM 2), TRIM(BOTH ' ' FROM s). Their `FROM` is not a table
 * reference, and `EXTRACT(DOW FROM d.calendar_date)` otherwise reads as a query
 * against a table `calendar_date` in a schema `d`. Spaces preserve offsets so
 * reported line numbers stay correct.
 */
function neutralizeKeywordFunctions(sql: string): string {
  const re = /\b(?:EXTRACT|SUBSTRING|TRIM|OVERLAY|POSITION)\s*\(/gi;
  let out = sql;
  let m: RegExpExecArray | null;
  while ((m = re.exec(out))) {
    const { end } = readBalanced(out, re.lastIndex - 1);
    out = out.slice(0, m.index) + " ".repeat(end - m.index + 1) + out.slice(end + 1);
    re.lastIndex = m.index;
  }

  const blank = (s: string) => " ".repeat(s.length);
  return (
    out
      // A quoted SQL value is data, not syntax: 'Auto-transferred from folio'
      // would otherwise read as a reference to a table named "folio".
      .replace(/'(?:[^']|'')*'/g, blank)
      // `-- note` inside a query would otherwise be read as prose SQL.
      .replace(/--[^\n]*/g, blank)
      // ON CONFLICT ... DO UPDATE SET — "SET" is not a table.
      .replace(/\bDO\s+UPDATE\b/gi, blank)
      // Row locks: FOR UPDATE [OF x] [SKIP LOCKED | NOWAIT].
      .replace(/\bFOR\s+(?:NO\s+KEY\s+)?UPDATE\b/gi, blank)
  );
}

/** CTE and subquery aliases defined inside one literal are not tables. */
function localAliases(sql: string): Set<string> {
  const names = new Set<string>();
  for (const m of sql.matchAll(/(?:WITH|,)\s+([a-z_][a-z_0-9]*)\s+AS\s*(?:MATERIALIZED\s*)?\(/gi)) {
    names.add(m[1]!.toLowerCase());
  }
  return names;
}

// ─── Checks ──────────────────────────────────────────────────────────────────

const violations: Violation[] = [];

function checkLiteral(file: string, rawSql: string, lineAt: (pos: number) => number): void {
  const sql = neutralizeKeywordFunctions(rawSql);
  const aliases = localAliases(sql);

  // (A) table references
  for (const m of sql.matchAll(
    /\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE)\s+(?:([a-z_0-9]+)\.)?([a-z_][a-z_0-9]*)/gi,
  )) {
    const schema = m[1]?.toLowerCase();
    const table = m[2]!.toLowerCase();
    if (!schema && aliases.has(table)) continue;
    const entry = catalog.get(table);
    if (!entry) {
      // Bare names are checked too — command_outbox, travel_agents,
      // gl_journal_entries and channel_sync_logs all reached production as
      // unqualified references. Set-returning functions are excluded by name,
      // and a following "(" means a function call rather than a table.
      const isCall = sql[m.index! + m[0].length] === "(";
      if (!isCall && !SET_RETURNING_FUNCTIONS.has(table)) {
        violations.push({
          kind: "missing-table",
          file,
          line: lineAt(m.index!),
          detail: `${schema ? `${schema}.` : ""}${table} does not exist`,
        });
      }
      continue;
    }
    const effective = schema ?? "public";
    if (effective !== entry.schema) {
      violations.push({
        kind: "wrong-schema",
        file,
        line: lineAt(m.index!),
        detail: `${effective}.${table} does not exist — the table is ${entry.schema}.${table}`,
      });
    }
  }

  // (B) INSERT INTO <t> (cols)
  for (const m of sql.matchAll(
    /INSERT\s+INTO\s+(?:[a-z_0-9]+\.)?([a-z_0-9]+)\s*\(([^)]*)\)/gi,
  )) {
    const entry = catalog.get(m[1]!.toLowerCase());
    if (!entry) continue;
    const raw = m[2]!;
    if (/\bSELECT\b/i.test(raw)) continue;
    for (const col of raw.split(",").map((c) => c.trim().toLowerCase())) {
      if (!/^[a-z_][a-z_0-9]*$/.test(col)) continue;
      if (!entry.columns.has(col)) {
        violations.push({
          kind: "missing-column",
          file,
          line: lineAt(m.index!),
          detail: `${m[1]!.toLowerCase()}.${col} does not exist (INSERT)`,
        });
      }
    }
  }

  // (C) UPDATE <t> SET col = ...
  for (const m of sql.matchAll(/UPDATE\s+(?:[a-z_0-9]+\.)?([a-z_0-9]+)\s+SET\s/gi)) {
    const table = m[1]!.toLowerCase();
    const entry = catalog.get(table);
    if (!entry) continue;
    const tail = sql.slice(m.index! + m[0].length);
    const assignments = tail.split(/\bWHERE\b|\bRETURNING\b|\bFROM\b/i)[0]!;
    const seen = new Set<string>();
    for (const a of assignments.matchAll(/(?:^|,)\s*([a-z_][a-z_0-9]*)\s*=/gi)) {
      const col = a[1]!.toLowerCase();
      if (seen.has(col)) continue;
      seen.add(col);
      if (!entry.columns.has(col)) {
        violations.push({
          kind: "missing-column",
          file,
          line: lineAt(m.index!),
          detail: `${table}.${col} does not exist (UPDATE SET)`,
        });
      }
    }
  }
}

function walkTs(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "coverage") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkTs(full, out);
    else if (full.endsWith(".ts") && !full.endsWith(".d.ts")) out.push(full);
  }
}

// ─── Baseline ────────────────────────────────────────────────────────────────

const key = (v: Violation) => `${v.file}\t${v.kind}\t${v.detail}`;

function main(): void {
  buildCatalog();
  if (catalog.size < 100) {
    console.error(`sql-contract-check: parsed only ${catalog.size} tables — the DDL layout changed.`);
    process.exit(2);
  }

  const files: string[] = [];
  walkTs(APPS, files);
  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    const rel = relative(ROOT, file);
    for (const { sql, offset } of extractTemplateLiterals(source)) {
      const lineAt = (pos: number) => source.slice(0, offset + pos).split("\n").length;
      checkLiteral(rel, sql, lineAt);
    }
  }

  // `--update-baseline` is for adopting the check on a codebase with a known
  // backlog, and for pruning entries as they are fixed. It is deliberately not
  // a way to silence a new violation: CI never passes this flag.
  if (process.argv.includes("--update-baseline")) {
    const entries = [...new Set(violations.map(key))].sort();
    writeFileSync(
      BASELINE,
      `${JSON.stringify(
        {
          $comment:
            "Known SQL contract violations, recorded so the check can be adopted incrementally. " +
            "Entries are 'file<TAB>kind<TAB>detail'. Fix them and run with --update-baseline to prune; " +
            "never add an entry to silence a new violation.",
          generated: new Date().toISOString().slice(0, 10),
          violations: entries,
        },
        null,
        2,
      )}\n`,
    );
    console.log(`sql-contract-check: wrote ${entries.length} baseline entries to ${relative(ROOT, BASELINE)}`);
    return;
  }

  const baseline: string[] = existsSync(BASELINE)
    ? (JSON.parse(readFileSync(BASELINE, "utf-8")).violations as string[])
    : [];
  const baselineSet = new Set(baseline);
  const found = new Set(violations.map(key));

  const fresh = violations.filter((v) => !baselineSet.has(key(v)));
  const stale = baseline.filter((b) => !found.has(b));

  console.log(
    `sql-contract-check: ${catalog.size} tables, ${files.length} files, ` +
      `${violations.length} violations (${baseline.length} baselined, ${fresh.length} new)`,
  );

  if (fresh.length) {
    console.error(`\n✗ ${fresh.length} SQL contract violation(s) not in the baseline:\n`);
    for (const v of fresh) console.error(`  ${v.file}:${v.line}\n      ${v.detail}`);
    console.error(
      `\nThese queries fail at runtime (42P01/42703). Fix the query, or add the\n` +
        `table/column to scripts/tables/ — do not add new entries to the baseline.\n`,
    );
  }

  if (stale.length) {
    console.error(`\n✗ ${stale.length} baseline entr(ies) no longer reproduce — delete them:\n`);
    for (const s of stale) console.error(`  ${s.split("\t")[0]}  ${s.split("\t")[2]}`);
    console.error("");
  }

  if (fresh.length || stale.length) process.exit(1);
  console.log("✓ no SQL contract violations outside the baseline");
}

main();
