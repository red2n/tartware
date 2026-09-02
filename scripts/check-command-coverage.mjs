#!/usr/bin/env node
/**
 * Every catalogued command must be exercised by a suite that actually runs.
 *
 * The flow guard proves a command is *wired up* — handler, catalogue row,
 * manifest claim, payload validator, a route. It has never asked whether
 * anything ever calls it. On 2026-09-01 the answer was that 128 of 202
 * catalogued commands were driven by no end-to-end suite at all: they were
 * proven dispatchable and never once dispatched. A command with a green flow
 * guard and no exercise is a feature nobody has run since it was written.
 *
 * Two subtleties this measures rather than assumes:
 *
 * 1. **A command can be exercised without its name appearing.** The gateway
 *    forwards `/v1/tenants/:id/reservations/:id/check-in` to
 *    `reservation.check_in`, so the route→command map in `Apps/api-gateway/src/
 *    routes/*.ts` is read and the suites are scanned for those paths too.
 * 2. **A suite nobody invokes proves nothing.** `test-stay-lifecycle.sh` and
 *    `test-ws04-lifecycle.sh` were the only coverage of nine commands and were
 *    called by nothing — not by the multi-tenant suite, not by package.json.
 *    Only suites reachable from the entry points below count.
 *
 * Run: node scripts/check-command-coverage.mjs
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CATALOG = "scripts/tables/01-core/10_command_center.sql";
const GATEWAY_ROUTES = "Apps/api-gateway/src/routes";

/**
 * The suites an E2E run actually executes, directly or through
 * `run_domain_suite`. Adding a suite here is how new coverage counts; adding
 * one that nothing invokes is the mistake this check exists to catch.
 */
const RUNNING_SUITES = [
  "executables/test-accounts-realdata/test-multi-tenant.sh",
  "executables/test-accounts-realdata/test-accounts-realdata.sh",
  "executables/test-accounts-realdata/test-stay-lifecycle.sh",
  "executables/test-accounts-realdata/test-ws04-lifecycle.sh",
  "http_test/smoke-events.sh",
  "http_test/smoke-operations.sh",
];

/**
 * Commands no E2E suite drives, as of 2026-09-01 — the debt, counted.
 *
 * **This list may only shrink.** A new command must arrive with a suite that
 * calls it, or this check fails; that is the whole point. Nothing here is
 * blessed — each entry is a command the product ships, the gateway routes and
 * nobody has ever run end to end.
 *
 * The shape of it is worth reading rather than scrolling past: a third is
 * revenue management (compset, forecasting, pace), a quarter is billing's
 * deposit/AR long tail, and twenty are reservation operations a front desk does
 * daily — deposits, quotes, walk-ins, registration cards, waitlist offers,
 * group check-in and rooming lists.
 */
const KNOWN_UNEXERCISED = new Set([
  "analytics.metric.ingest",
  "analytics.report.schedule",
  "ar.aging.compute",
  "ar.dispute.escalate",
  "ar.dispute.raise",
  "ar.dispute.resolve",
  "ar.dunning.escalate",
  "ar.dunning.suppress",
  "ar.dunning.trigger",
  "ar.payment.apply",
  "ar.payment.unapply",
  "billing.ar.age",
  "billing.deposit.record",
  "billing.deposit.refund",
  "billing.deposit.transfer",
  "billing.deposit.waive",
  "billing.fiscal_period.lock",
  "billing.fiscal_period.reopen",
  "billing.folio_window.create",
  "billing.group.add_reservation",
  "billing.group.checkout",
  "billing.group.setup",
  "billing.payment.apply",
  "billing.pricing.bulk_recommend",
  "billing.pricing.evaluate",
  "billing.routing_rule.clone_template",
  "billing.routing_rule.create",
  "billing.routing_rule.delete",
  "billing.routing_rule.update",
  "billing.suspense.resolve",
  "billing.suspense.write_off",
  "billing.tax_config.delete",
  "billing.tax_config.update",
  "commission.approve",
  "commission.calculate",
  "commission.mark_paid",
  "commission.statement.generate",
  "group.billing.setup",
  "group.check_in",
  "group.cutoff_enforce",
  "group.upload_rooming_list",
  "guest.gdpr.erase",
  "guest.merge",
  "guest.preference.update",
  "guest.update_contact",
  "guest.update_profile",
  "housekeeping.task.add_note",
  "housekeeping.task.bulk_status",
  "housekeeping.task.reassign",
  "housekeeping.task.reopen",
  "integration.mapping.update",
  "integration.ota.content_sync",
  "integration.ota.rate_push",
  "integration.ota.sync_request",
  "integration.webhook.retry",
  "loyalty.points.expire_sweep",
  "metasearch.click.record",
  "metasearch.config.create",
  "metasearch.config.update",
  "notification.automated.create",
  "notification.automated.delete",
  "notification.automated.update",
  "notification.send",
  "operations.asset.update",
  "operations.inventory.adjust",
  "operations.schedule.create",
  "operations.schedule.update",
  "reservation.batch_no_show",
  "reservation.expire",
  "reservation.reinstate",
  "reservation.waitlist_expire_sweep",
  "reservation.walk_guest",
  "revenue.booking_pace.snapshot",
  "revenue.competitive_response.configure",
  "revenue.competitor.auto_collect",
  "revenue.competitor.bulk_import",
  "revenue.competitor.configure_compset",
  "revenue.competitor.record",
  "revenue.daily_close.process",
  "revenue.demand.import_events",
  "revenue.demand.update",
  "revenue.forecast.adjust",
  "revenue.forecast.compute",
  "revenue.forecast.evaluate",
  "revenue.goal.create",
  "revenue.goal.delete",
  "revenue.goal.track_actual",
  "revenue.goal.update",
  "revenue.group.evaluate",
  "revenue.hurdle_rate.calculate",
  "revenue.hurdle_rate.set",
  "revenue.pricing_rule.activate",
  "revenue.pricing_rule.create",
  "revenue.pricing_rule.deactivate",
  "revenue.pricing_rule.delete",
  "revenue.pricing_rule.update",
  "revenue.recommendation.apply",
  "revenue.recommendation.approve",
  "revenue.recommendation.bulk_approve",
  "revenue.recommendation.generate",
  "revenue.recommendation.reject",
  "revenue.restriction.bulk_set",
  "revenue.restriction.remove",
  "revenue.restriction.set",
  "rooms.features.update",
  "rooms.housekeeping_status.update",
  "rooms.inventory.release",
  "rooms.move",
  "rooms.out_of_order",
  "rooms.out_of_service",
]);

const readCatalog = () => {
  const sql = readFileSync(CATALOG, "utf8");
  const start = sql.indexOf("WITH seed_commands(");
  if (start < 0) {
    console.error(`${CATALOG}: seed_commands CTE not found — catalog layout changed`);
    process.exit(1);
  }
  return [
    ...new Set(
      [...sql.slice(start).matchAll(/\(\s*'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'\s*,/g)].map(
        (m) => m[1],
      ),
    ),
  ].sort();
};

/** Every `commandName: "x.y"` in the gateway, paired with the route above it. */
const readRouteMap = () => {
  const pairs = [];
  for (const file of readdirSync(GATEWAY_ROUTES).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(GATEWAY_ROUTES, file), "utf8");
    let path = null;
    for (const m of src.matchAll(/"(\/v1\/[^"]+)"|commandName:\s*"([a-z0-9_.]+)"/g)) {
      if (m[1]) path = m[1];
      else if (m[2] && path) pairs.push([path, m[2]]);
    }
  }
  return pairs;
};

const catalog = readCatalog();
const suiteText = RUNNING_SUITES.filter((f) => existsSync(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const exercised = new Set(
  catalog.filter((cmd) =>
    new RegExp(`(?<![\\w.])${cmd.replace(/\./g, "\\.")}(?![\\w.])`).test(suiteText),
  ),
);
for (const [path, cmd] of readRouteMap()) {
  const segments = path.split("/").filter((s) => s && !s.startsWith(":"));
  if (segments.length >= 2 && suiteText.includes(segments.slice(-2).join("/"))) {
    exercised.add(cmd);
  }
}

const uncovered = catalog.filter((cmd) => !exercised.has(cmd));
const undeclared = uncovered.filter((cmd) => !KNOWN_UNEXERCISED.has(cmd));
const stale = [...KNOWN_UNEXERCISED].filter((cmd) => exercised.has(cmd)).sort();

if (undeclared.length > 0) {
  console.error("\nCatalogued command that no running E2E suite exercises:\n");
  for (const cmd of undeclared) console.error(`  ${cmd}`);
  console.error(
    `\nThe flow guard proves a command is wired up; it does not prove anything ever\n` +
      `calls it. Drive it from a suite in RUNNING_SUITES — and if you add a new suite,\n` +
      `make sure something invokes it: two lifecycle suites sat in the repo for weeks\n` +
      `as the only coverage of nine commands, called by nothing.\n\n` +
      `Do not add it to KNOWN_UNEXERCISED in scripts/check-command-coverage.mjs; that\n` +
      `list is the debt this check is paying down, and it may only shrink.\n`,
  );
  process.exit(1);
}

if (stale.length > 0) {
  console.error(
    `\nThese commands are now exercised and should be removed from\n` +
      `KNOWN_UNEXERCISED, so the list keeps reflecting the real debt:\n`,
  );
  for (const cmd of stale) console.error(`  ${cmd}`);
  console.error("");
  process.exit(1);
}

const pct = ((exercised.size / catalog.length) * 100).toFixed(0);
console.log(
  `Command coverage OK — ${exercised.size}/${catalog.length} commands (${pct}%) driven by ` +
    `${RUNNING_SUITES.length} running suites, ${uncovered.length} known unexercised.`,
);
