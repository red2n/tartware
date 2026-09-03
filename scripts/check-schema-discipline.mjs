#!/usr/bin/env node
/**
 * PURE DEV MODE — one source of truth for the schema.
 *
 * The product has no client, no QA environment and no data anyone could not
 * recreate, and `./executables/tartware.sh db setup` rebuilds everything from
 * `scripts/tables/` in under a minute. In that situation a migration buys
 * nothing and costs the one thing that matters: it makes the schema have two
 * descriptions instead of one.
 *
 * That is not a hypothetical cost. `scripts/migrations/` held twelve files that
 * `setup-database.sh` never ran and no `schema_migrations` table ever tracked —
 * documentation shaped like executable code. They happened to agree with the
 * base DDL on the day they were deleted, and answering *whether* they agreed
 * took a column-by-column query against a freshly built database, because
 * reading them could not settle it. Two sources of truth for one schema is the
 * same defect as a control that is correct in one path and absent in the path
 * beside it, which is the defect this repo has spent a fortnight removing.
 *
 * So: **a schema change edits the `CREATE TABLE`.** This check enforces that in
 * two directions.
 *
 *   1. `scripts/migrations/` may not come back.
 *   2. No new `ALTER TABLE … ADD/DROP/ALTER COLUMN` — a column bolted on after
 *      the CREATE is a migration living inside the base DDL.
 *
 * **When this rule should be lifted.** The day there is a real deployment
 * holding data someone would miss, cut the base DDL as baseline v1 and start a
 * migration chain from there. That is a deliberate decision with a date on it,
 * not something that should happen because one file quietly reintroduced the
 * pattern. Until then, `db setup` is the upgrade path.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SCRIPTS = join(ROOT, "scripts");

/** `ALTER TABLE … ADD/DROP/ALTER COLUMN`, the migration-shaped statement. */
const COLUMN_MUTATION = /ALTER\s+TABLE[\s\S]{0,120}?\b(ADD|DROP|ALTER)\s+COLUMN\b/i;

/**
 * Directories whose whole job is to alter tables after they exist.
 *
 * `constraints/` adds every foreign key in the product — 119 files of
 * `ALTER TABLE … ADD CONSTRAINT`, which is how a schema with circular
 * references has to be built and is not a column mutation anyway.
 */
const EXEMPT_DIRS = ["constraints"];

/**
 * Files that alter columns as a *pattern* across every table rather than
 * bolting one onto a named table. Permanently exempt: folding these into the
 * CREATE TABLEs would mean hand-copying the same two columns into 253 files and
 * would lose the property that makes them correct — that they apply to
 * everything, including a table added tomorrow.
 */
const PATTERN_SCRIPTS = new Set(["tables/99_enforce_tenant_soft_delete.sql"]);

/**
 * Columns bolted on after their CREATE TABLE, inherited rather than introduced.
 *
 * This list may only shrink. Fold the columns into the table's own CREATE and
 * delete the entry; a stale entry fails this check, so it cannot rot into a
 * permanent exemption the way an unreviewed allowlist does.
 */
const UNFOLDED_COLUMNS = new Set([
  "tables/01-core/01_tenants.sql",
  "tables/01-core/03_user_tenant_associations.sql",
  "tables/01-core/05_guests.sql",
  "tables/02-inventory/07_rooms.sql",
  "tables/02-inventory/52_competitor_rates.sql",
  "tables/02-inventory/54_pricing_rules.sql",
  "tables/02-inventory/57_rate_restrictions.sql",
  "tables/02-inventory/93_travel_agent_commissions.sql",
  "tables/02-inventory/98_event_bookings.sql",
  "tables/03-bookings/10_reservations.sql",
  "tables/03-bookings/12_reservations_constraints.sql",
  "tables/03-bookings/12_reservations_constraints_down.sql",
  "tables/03-bookings/32_booking_sources.sql",
  "tables/03-bookings/43_guest_feedback.sql",
  "tables/03-bookings/92_reservation_guard_locks.sql",
  "tables/04-financial/13_invoices.sql",
  "tables/04-financial/25_folios.sql",
  "tables/04-financial/26_charge_postings.sql",
  "tables/06-integrations/49_channel_sync_logs.sql",
  "tables/06-integrations/88_webhook_subscriptions.sql",
  "tables/08-settings/10_settings_categories.sql",
  "tables/08-settings/11_settings_sections.sql",
  "tables/08-settings/12_settings_definitions.sql",
  "tables/08-settings/13_settings_options.sql",
]);

const sqlFiles = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXEMPT_DIRS.includes(entry.name)) continue;
      walk(full);
    } else if (entry.name.endsWith(".sql")) {
      sqlFiles.push(full);
    }
  }
};
walk(SCRIPTS);

const failures = [];

// ── 1. The directory may not come back ──────────────────────────────────────
const migrationsDir = join(SCRIPTS, "migrations");
if (existsSync(migrationsDir) && statSync(migrationsDir).isDirectory()) {
  const held = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  if (held.length > 0) {
    failures.push(
      `scripts/migrations/ is back, holding ${held.length} file(s).\n` +
        `  In PURE DEV mode a schema change edits the CREATE TABLE and \`db setup\`\n` +
        `  rebuilds. If this product now has data worth migrating, that is a\n` +
        `  decision to take deliberately — cut a baseline and say so here.`,
    );
  }
}

// ── 2. No new column bolted on after its CREATE TABLE ───────────────────────
const offenders = [];
const seen = new Set();
for (const file of sqlFiles) {
  const rel = relative(SCRIPTS, file);
  if (PATTERN_SCRIPTS.has(rel)) continue;
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  // Comments describing the pattern are not the pattern.
  const code = source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  if (!COLUMN_MUTATION.test(code)) continue;
  seen.add(rel);
  if (!UNFOLDED_COLUMNS.has(rel)) offenders.push(rel);
}

if (offenders.length > 0) {
  failures.push(
    `A column is added after its own CREATE TABLE — a migration inside the base DDL:\n` +
      offenders.map((f) => `    scripts/${f}`).join("\n") +
      `\n  Put the column in the table's CREATE TABLE body instead. \`db setup\`\n` +
      `  rebuilds from scratch, so there is nothing an ALTER preserves.`,
  );
}

// ── 3. The paydown list may only shrink ─────────────────────────────────────
const stale = [...UNFOLDED_COLUMNS].filter((f) => !seen.has(f)).sort();
if (stale.length > 0) {
  failures.push(
    `UNFOLDED_COLUMNS names ${stale.length} file(s) that no longer bolt on a column:\n` +
      stale.map((f) => `    scripts/${f}`).join("\n") +
      `\n  Good — delete them from the list in ${relative(ROOT, new URL(import.meta.url).pathname)}.\n` +
      `  The list failing when it goes stale is what keeps it shrinking.`,
  );
}

if (failures.length > 0) {
  console.error("\nSchema discipline (PURE DEV mode):\n");
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `Schema discipline OK — ${sqlFiles.length} SQL files, no migrations directory, ` +
    `${UNFOLDED_COLUMNS.size} file(s) still to fold.`,
);
