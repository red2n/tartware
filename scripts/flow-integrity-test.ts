#!/usr/bin/env tsx
/**
 * PMS Flow Integrity Test System
 *
 * Validates all 12 PMS flows have complete wiring:
 * - Command schemas exist in @tartware/schemas
 * - Command handlers registered in service consumers
 * - Cross-flow event consumers wired
 * - Critical SQL tables present
 * - Critical gates implemented in code
 *
 * Run: npx tsx scripts/flow-integrity-test.ts
 * Exit code 0 = all checks pass, non-zero = failures detected
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Imported from source, not from "@tartware/schemas": this script runs inside
// `pnpm run check`, which happens *before* the build, so a workspace import
// would resolve to a dist that may not exist yet. That is the same trap the
// eslint type-aware rules hit — green locally, red in CI.
import { FLOW_REGISTRY } from "../schema/src/flows/flow-registry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APPS = join(ROOT, "Apps");
const SCHEMA_SRC = join(ROOT, "schema", "src");
const SCRIPTS = join(ROOT, "scripts", "tables");

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckResult {
  flow: string;
  check: string;
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
}

const results: CheckResult[] = [];

function pass(flow: string, check: string, detail: string) {
  results.push({ flow, check, status: "PASS", detail });
}
function fail(flow: string, check: string, detail: string) {
  results.push({ flow, check, status: "FAIL", detail });
}
function warn(flow: string, check: string, detail: string) {
  results.push({ flow, check, status: "WARN", detail });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileContains(filePath: string, pattern: string | RegExp): boolean {
  if (!existsSync(filePath)) return false;
  const content = readFileSync(filePath, "utf-8");
  if (typeof pattern === "string") return content.includes(pattern);
  return pattern.test(content);
}

function dirContainsFileWithContent(dirPath: string, searchStr: string | RegExp): boolean {
  if (!existsSync(dirPath)) return false;
  const files = readdirSync(dirPath, { recursive: true });
  for (const f of files) {
    const full = join(dirPath, f.toString());
    if (full.endsWith(".ts") && fileContains(full, searchStr)) return true;
  }
  return false;
}

// ─── Flow 1: Property Setup ─────────────────────────────────────────────────

function checkFlow1() {
  const flow = "Flow 1: Property Setup";

  // Command handlers in rooms-service
  const consumer = join(APPS, "rooms-service/src/commands/command-center-consumer.ts");
  const commands = [
    "rooms.status.update",
    "rooms.out_of_order",
    "rooms.out_of_service",
    "rooms.inventory.block",
    "rooms.inventory.release",
  ];
  for (const cmd of commands) {
    if (fileContains(consumer, cmd)) {
      pass(flow, `Handler: ${cmd}`, "Registered in rooms-service consumer");
    } else {
      fail(flow, `Handler: ${cmd}`, "NOT found in rooms-service consumer");
    }
  }

  // Tables
  const roomTypesSql = join(SCRIPTS, "02-inventory/06_room_types.sql");
  if (existsSync(roomTypesSql)) {
    pass(flow, "Table: room_types", "SQL file exists");
  } else {
    fail(flow, "Table: room_types", "SQL file missing");
  }
}

// ─── Flow 2: Rate & Pricing ─────────────────────────────────────────────────

function checkFlow2() {
  const flow = "Flow 2: Rate & Pricing";

  // Revenue service commands
  const revenueCommandsDir = join(APPS, "revenue-service/src/commands");
  if (dirContainsFileWithContent(revenueCommandsDir, "revenue.pricing_rule")) {
    pass(flow, "Handler: revenue.pricing_rule.*", "Found in revenue-service");
  } else {
    fail(flow, "Handler: revenue.pricing_rule.*", "NOT found in revenue-service");
  }

  // Rate tables
  const ratesSql = join(SCRIPTS, "02-inventory/08_rates.sql");
  if (existsSync(ratesSql)) {
    pass(flow, "Table: rates", "SQL file exists");
  } else {
    fail(flow, "Table: rates", "SQL file missing");
  }
}

// ─── Flow 3: Guest Profile ───────────────────────────────────────────────────

function checkFlow3() {
  const flow = "Flow 3: Guest Profile";

  // Guest commands
  const guestConsumer = join(APPS, "guests-service/src/commands/command-center-consumer.ts");
  const commands = ["guest.register", "guest.merge", "guest.set_blacklist"];
  for (const cmd of commands) {
    if (fileContains(guestConsumer, cmd)) {
      pass(flow, `Handler: ${cmd}`, "Registered in guests-service consumer");
    } else {
      fail(flow, `Handler: ${cmd}`, "NOT found in guests-service consumer");
    }
  }

  // The blacklist gate is verified by checkDeclaredControls, from the evidence
  // on its registry declaration — not hand-written here any more.
}

// ─── Flow 4: Reservation Lifecycle ──────────────────────────────────────────

function checkFlow4() {
  const flow = "Flow 4: Reservation Lifecycle";

  const consumer = join(
    APPS,
    "reservations-command-service/src/commands/command-center-consumer.ts",
  );
  const commands = [
    "reservation.create",
    "reservation.modify",
    "reservation.cancel",
    "reservation.check_in",
    "reservation.check_out",
    "reservation.no_show",
    "reservation.walk_guest",
    "reservation.walkin_checkin",
  ];
  for (const cmd of commands) {
    if (fileContains(consumer, cmd)) {
      pass(flow, `Handler: ${cmd}`, "Registered");
    } else {
      fail(flow, `Handler: ${cmd}`, "NOT found");
    }
  }
}

// ─── Flow 5: Check-in ───────────────────────────────────────────────────────

function checkFlow5() {
  const flow = "Flow 5: Check-in";

  // Check-in validates room status
  const checkinTs = join(
    APPS,
    "reservations-command-service/src/services/reservation-commands/checkin-checkout.ts",
  );
  if (fileContains(checkinTs, /OUT_OF_ORDER|room.*status/)) {
    pass(flow, "Gate: room status validation", "Implemented in check-in handler");
  } else {
    warn(flow, "Gate: room status validation", "Pattern not found — verify manually");
  }

  // Folio creation on check-in
  const eventHandler = join(
    APPS,
    "reservations-command-service/src/services/reservation-event-handler.ts",
  );
  if (fileContains(eventHandler, "folio")) {
    pass(flow, "Side-effect: folio creation", "Referenced in event handler");
  } else {
    warn(flow, "Side-effect: folio creation", "Not found in event handler");
  }
}

// ─── Flow 6: In-stay / Folio ────────────────────────────────────────────────

function checkFlow6() {
  const flow = "Flow 6: In-stay / Folio";

  const billingConsumer = join(
    APPS,
    "billing-service/src/commands/command-center-consumer.ts",
  );
  const commands = [
    "billing.charge.post",
    "billing.folio.split",
    "billing.folio.transfer",
    "billing.routing_rule.create",
  ];
  for (const cmd of commands) {
    if (fileContains(billingConsumer, cmd)) {
      pass(flow, `Handler: ${cmd}`, "Registered in billing-service");
    } else {
      fail(flow, `Handler: ${cmd}`, "NOT found in billing-service");
    }
  }
}

// ─── Flow 7: Checkout ───────────────────────────────────────────────────────

function checkFlow7() {
  const flow = "Flow 7: Checkout";

  // checkout handler exists
  const consumer = join(
    APPS,
    "reservations-command-service/src/commands/command-center-consumer.ts",
  );
  if (fileContains(consumer, "reservation.check_out")) {
    pass(flow, "Handler: reservation.check_out", "Registered");
  } else {
    fail(flow, "Handler: reservation.check_out", "NOT found");
  }

  // AR city ledger transfer event consumer
  const arConsumer = join(APPS, "billing-service/src/consumers/ar-event-consumer.ts");
  if (fileContains(arConsumer, "ar.city_ledger.transfer")) {
    pass(flow, "Cross-flow: checkout → AR city ledger transfer", "Wired in ar-event-consumer");
  } else {
    fail(flow, "Cross-flow: checkout → AR city ledger transfer", "NOT wired");
  }

  // Housekeeping task auto-creation
  const hkConsumer = join(
    APPS,
    "housekeeping-service/src/consumers/reservation-event-consumer.ts",
  );
  if (existsSync(hkConsumer) && fileContains(hkConsumer, "CHECKOUT_CLEAN")) {
    pass(flow, "Cross-flow: checkout → housekeeping task", "Wired in reservation-event-consumer");
  } else {
    fail(flow, "Cross-flow: checkout → housekeeping task", "NOT wired");
  }
}

// ─── Flow 8: Housekeeping ───────────────────────────────────────────────────

function checkFlow8() {
  const flow = "Flow 8: Housekeeping";

  const consumer = join(APPS, "housekeeping-service/src/commands/command-center-consumer.ts");
  const commands = [
    "housekeeping.task.create",
    "housekeeping.task.assign",
    "housekeeping.task.complete",
    "housekeeping.task.reassign",
  ];
  for (const cmd of commands) {
    if (fileContains(consumer, cmd)) {
      pass(flow, `Handler: ${cmd}`, "Registered");
    } else {
      fail(flow, `Handler: ${cmd}`, "NOT found");
    }
  }

  // Event consumer from reservation events
  const index = join(APPS, "housekeeping-service/src/index.ts");
  if (fileContains(index, "startReservationEventConsumer")) {
    pass(flow, "Event consumer: reservation events", "Wired in index.ts");
  } else {
    fail(flow, "Event consumer: reservation events", "NOT wired in index.ts");
  }
}

// ─── Flow 9: Maintenance / OOO ──────────────────────────────────────────────

function checkFlow9() {
  const flow = "Flow 9: Maintenance / OOO";

  const roomsConsumer = join(APPS, "rooms-service/src/commands/command-center-consumer.ts");
  if (fileContains(roomsConsumer, "rooms.out_of_order")) {
    pass(flow, "Handler: rooms.out_of_order", "Registered in rooms-service");
  } else {
    fail(flow, "Handler: rooms.out_of_order", "NOT found");
  }

  // Maintenance is REST on housekeeping-service, not a command.
  //
  // This asserted a handler for `operations.maintenance.*` in the housekeeping
  // consumer. There is no such command: not in the catalogue, not in the
  // validator map, not in any consumer — a work order is raised over
  // `/v1/maintenance/requests` and moved with assign / complete / escalate.
  // So the check failed against a handler nobody ever built, which is the whole
  // argument for putting this script in `pnpm run check`: it had been red for
  // long enough that nobody knew.
  //
  // The commands were in fact retired on 2026-08-18 along with `inventory.*`,
  // because plain HTTP was already the live path — see
  // ui-gaps/17-command-reachability.md, and the note in
  // flow-command-catalog.test.ts that records the same removal. Everything was
  // updated except this file. Same resolution as `reservation.mobile_checkin.*`
  // in the flow registry: when a capability is REST, assert the REST surface
  // rather than invent a command for it.
  const maintenanceRoutes = join(APPS, "housekeeping-service/src/routes/maintenance.ts");
  const maintenanceVerbs = [
    "/v1/maintenance/requests",
    "/v1/maintenance/requests/:requestId/assign",
    "/v1/maintenance/requests/:requestId/complete",
    "/v1/maintenance/requests/:requestId/escalate",
  ];
  const missingVerbs = maintenanceVerbs.filter(
    (route) => !fileContains(maintenanceRoutes, route),
  );
  if (missingVerbs.length === 0) {
    pass(flow, "REST: maintenance work orders", "raise / assign / complete / escalate on housekeeping-service");
  } else {
    fail(flow, "REST: maintenance work orders", `missing ${missingVerbs.join(", ")}`);
  }
}

// ─── Flow 10: Night Audit ───────────────────────────────────────────────────

function checkFlow10() {
  const flow = "Flow 10: Night Audit";

  // Night audit command handler
  const billingConsumer = join(APPS, "billing-service/src/commands/command-center-consumer.ts");
  if (fileContains(billingConsumer, "billing.night_audit")) {
    pass(flow, "Handler: billing.night_audit.execute", "Registered");
  } else {
    fail(flow, "Handler: billing.night_audit.execute", "NOT found");
  }

  // Pre-condition checks
  const nightAudit = join(
    APPS,
    "billing-service/src/services/billing-commands/night-audit.ts",
  );
  if (fileContains(nightAudit, "NIGHT_AUDIT_PRECONDITIONS_FAILED")) {
    pass(flow, "Gate: pre-condition validation", "Implemented");
  } else {
    fail(flow, "Gate: pre-condition validation", "NOT implemented");
  }

  // Room charges posting (not a stub)
  if (fileContains(nightAudit, "postRoomChargesAndTaxes")) {
    pass(flow, "Step: post room charges", "Function exists");
  } else {
    fail(flow, "Step: post room charges", "Function missing");
  }

  // Auto-cancel tentatives
  if (fileContains(nightAudit, "AUTO_DEPOSIT_DEADLINE")) {
    pass(flow, "Step: auto-cancel tentatives", "Implemented");
  } else {
    fail(flow, "Step: auto-cancel tentatives", "NOT implemented");
  }

  // Dunning trigger dispatch
  const araHook = join(
    APPS,
    "billing-service/src/services/billing-commands/ara-night-audit-hook.ts",
  );
  if (fileContains(araHook, "dispatchArDunningTrigger")) {
    pass(flow, "Step: dunning trigger after aging", "Implemented");
  } else {
    fail(flow, "Step: dunning trigger after aging", "NOT implemented");
  }

  // Business date advance
  if (fileContains(nightAudit, "business_date = ($3::date + INTERVAL '1 day')")) {
    pass(flow, "Step: advance business date", "Implemented");
  } else {
    fail(flow, "Step: advance business date", "NOT found");
  }
}

// ─── Flow 11: Group & Events ────────────────────────────────────────────────

function checkFlow11() {
  const flow = "Flow 11: Group & Events";

  const consumer = join(
    APPS,
    "reservations-command-service/src/commands/command-center-consumer.ts",
  );
  const commands = [
    "group.create",
    "group.add_rooms",
    "group.upload_rooming_list",
    "group.check_in",
  ];
  for (const cmd of commands) {
    if (fileContains(consumer, cmd)) {
      pass(flow, `Handler: ${cmd}`, "Registered");
    } else {
      fail(flow, `Handler: ${cmd}`, "NOT found");
    }
  }

  // Group billing in billing-service (may be in accounts consumer)
  const billingConsumer = join(APPS, "billing-service/src/commands/command-center-consumer.ts");
  const accountsConsumer = join(
    APPS,
    "billing-service/src/commands/accounts-command-center-consumer.ts",
  );
  if (fileContains(billingConsumer, "billing.group") || fileContains(accountsConsumer, "billing.group")) {
    pass(flow, "Handler: billing.group.*", "Registered in billing-service");
  } else {
    fail(flow, "Handler: billing.group.*", "NOT found");
  }
}

// ─── Flow 12: AR & Billing ──────────────────────────────────────────────────

function checkFlow12() {
  const flow = "Flow 12: AR & Billing";

  const billingConsumer = join(APPS, "billing-service/src/commands/command-center-consumer.ts");
  const accountsConsumer = join(
    APPS,
    "billing-service/src/commands/accounts-command-center-consumer.ts",
  );
  const commands = ["ar.city_ledger", "ar.aging.compute", "ar.dunning", "ar.payment"];
  for (const cmd of commands) {
    if (fileContains(billingConsumer, cmd) || fileContains(accountsConsumer, cmd)) {
      pass(flow, `Handler: ${cmd}.*`, "Registered");
    } else {
      fail(flow, `Handler: ${cmd}.*`, "NOT found");
    }
  }

  // Dunning rules table
  const dunningRulesSql = join(SCRIPTS, "04-financial/88_ar_dunning_rules.sql");
  if (existsSync(dunningRulesSql)) {
    pass(flow, "Table: ar_dunning_rules", "SQL file exists");
  } else {
    fail(flow, "Table: ar_dunning_rules", "SQL file missing");
  }
}

// ─── Flow 13: Ledger Control ────────────────────────────────────────────────

/**
 * The commands that reverse, forgive or reopen a posted entry, and the control
 * in front of the five that undo a completed accounting control.
 *
 * The registry can require a gate and a manifest can claim it; neither knows
 * whether the code still enforces one. That matters more here than anywhere
 * else, because removing dual control breaks nothing observable — a write-off
 * still writes off, and every test of its behaviour stays green. This asserts
 * the three pieces that have to be present for the claim to be true: the
 * declaration, the deferral inside the accept path, and a way for the second
 * person to release what was deferred.
 */
function checkFlow13() {
  const flow = "Flow 13: Ledger Control";

  // The five declarations, the deferral inside acceptCommand and the release
  // path are all verified by checkDeclaredControls now — they are the evidence
  // on the five dual_control entries in the registry. Hand-writing them here
  // was how three of nine declared gates ended up verified by nothing: the
  // check had to be remembered separately from the declaration.

  // Where the deferred command waits.
  const approvalsSql = join(SCRIPTS, "04-financial/80_approval_requests.sql");
  if (fileContains(approvalsSql, "command_name") && fileContains(approvalsSql, "dispatched_command_id")) {
    pass(flow, "Table: approval_requests carries the deferred command", "command_name + dispatched_command_id");
  } else {
    fail(
      flow,
      "Table: approval_requests carries the deferred command",
      "columns missing — a released approval cannot say what it dispatched",
    );
  }
}

// ─── Cross-Flow Structural Checks ───────────────────────────────────────────

function checkCrossFlow() {
  const flow = "Cross-Flow";

  // flow_approvals table
  const approvalsSql = join(SCRIPTS, "01-core/23_flow_approvals.sql");
  if (existsSync(approvalsSql)) {
    pass(flow, "Table: flow_approvals", "Universal approval table exists");
  } else {
    fail(flow, "Table: flow_approvals", "SQL file missing — gate bypasses cannot be logged");
  }

  // flow_approvals schema
  const schemaFile = join(SCHEMA_SRC, "schemas/01-core/flow-approvals.ts");
  if (existsSync(schemaFile)) {
    pass(flow, "Schema: FlowApprovalSchema", "Zod schema exists");
  } else {
    fail(flow, "Schema: FlowApprovalSchema", "Schema file missing");
  }

  // Command validators registry
  const validatorsFile = join(SCHEMA_SRC, "command-validators.ts");
  if (existsSync(validatorsFile)) {
    pass(flow, "Command validators registry", "File exists");
  } else {
    warn(flow, "Command validators registry", "File not found — commands may lack validation");
  }
}

// ─── Run All Checks ─────────────────────────────────────────────────────────

checkFlow1();
checkFlow2();
checkFlow3();
checkFlow4();
checkFlow5();
checkFlow6();
checkFlow7();
checkFlow8();
checkFlow9();
checkFlow10();
checkFlow11();
checkFlow12();
checkFlow13();
checkCrossFlow();

// ─── Cross-validation: manifest compliance ──────────────────────────────────
// Bridge the file-pattern checks above with the registry-based contract system.
// Import all service flow manifests and run the system-wide validateFlowCompliance.

/**
 * Every control the registry declares, verified against the code that enforces it.
 *
 * This replaces the two hand-written gate checks that used to live inside
 * `checkFlow3` and `checkFlow13`. Hand-writing them is why only 2 of 9 declared
 * gates were verified: the check had to be remembered separately from the
 * declaration, and for the three night-audit gates nobody did. Now the
 * declaration carries its own evidence and this loop reads all of it, so adding
 * a gate to the registry cannot leave it unverified — `evidence` is a required
 * field, so a new declaration will not compile without one.
 *
 * One result per control rather than per token: a control is enforced or it is
 * not, and the failure detail names the token that went missing.
 */
function checkDeclaredControls() {
	const flow = "Cross-Flow";

	for (const requirement of Object.values(FLOW_REGISTRY)) {
		for (const control of requirement.requiredGates ?? []) {
			const kind = control.kind ?? "gate";
			const label = `${kind === "record" ? "Record" : "Gate"}: ${control.gateName} on ${control.guardsCommand}`;
			const missing: string[] = [];

			for (const evidence of control.evidence) {
				const full = join(ROOT, evidence.file);
				if (!existsSync(full)) {
					missing.push(`${evidence.file} (file not found)`);
				} else if (!fileContains(full, evidence.token)) {
					missing.push(`${evidence.token} in ${evidence.file}`);
				}
			}

			if (missing.length === 0) {
				pass(
					flow,
					label,
					`${control.evidence.length} evidence token(s) present`,
				);
			} else {
				fail(
					flow,
					label,
					`declared but NOT enforced — missing ${missing.join("; ")}`,
				);
			}
		}
	}
}

/**
 * The inverse: no control may be enforced without being declared.
 *
 * `flow_approvals.gate_name` is a free-text column, so before this the only
 * thing deciding its vocabulary was whatever string a handler happened to pass.
 * Seven names were written by the reservation service and none of them appeared
 * in the registry, which meant the audit trail recorded controls the system had
 * no declared knowledge of.
 *
 * Manifests are excluded because a *claim* is not enforcement — the same reason
 * the dispatchability scan excludes them.
 */
function checkNoUndeclaredControls() {
	const flow = "Cross-Flow";

	const declared = new Set<string>();
	for (const requirement of Object.values(FLOW_REGISTRY)) {
		for (const control of requirement.requiredGates ?? []) {
			declared.add(control.gateName);
		}
	}

	const found = new Map<string, string>();
	const walk = (dir: string): void => {
		if (!existsSync(dir)) return;
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else if (
				entry.name.endsWith(".ts") &&
				entry.name !== "flow-manifest.ts"
			) {
				const content = readFileSync(full, "utf-8");
				for (const match of content.matchAll(
					/gate_?[Nn]ame:\s*"([a-z0-9_]+)"/g,
				)) {
					const name = match[1];
					if (name && !found.has(name)) found.set(name, relative(ROOT, full));
				}
			}
		}
	};
	for (const service of readdirSync(APPS, { withFileTypes: true })) {
		if (service.isDirectory()) walk(join(APPS, service.name, "src"));
	}

	const undeclared = [...found.entries()].filter(
		([name]) => !declared.has(name),
	);
	if (undeclared.length === 0) {
		pass(
			flow,
			"Every enforced control is declared",
			`${found.size} gate name(s) in Apps/, all in FLOW_REGISTRY`,
		);
	} else {
		for (const [name, file] of undeclared) {
			fail(
				flow,
				`Undeclared control: ${name}`,
				`written to flow_approvals by ${file}, declared by no flow`,
			);
		}
	}
}

function checkManifestCompliance() {
  const manifestPaths = [
    join(APPS, "billing-service", "src", "flow-manifest.ts"),
    join(APPS, "reservations-command-service", "src", "flow-manifest.ts"),
    join(APPS, "rooms-service", "src", "flow-manifest.ts"),
    join(APPS, "housekeeping-service", "src", "flow-manifest.ts"),
    join(APPS, "revenue-service", "src", "flow-manifest.ts"),
    join(APPS, "guests-service", "src", "flow-manifest.ts"),
    join(APPS, "notification-service", "src", "flow-manifest.ts"),
  ];

  // Check all manifest files exist
  const missingManifests = manifestPaths.filter((p) => !existsSync(p));
  if (missingManifests.length > 0) {
    for (const m of missingManifests) {
      fail("MANIFEST", "manifest-exists", `Missing flow-manifest.ts: ${m}`);
    }
  } else {
    pass(
      "MANIFEST",
      "all-manifests-exist",
      `All ${manifestPaths.length} service flow manifests found`,
    );
  }

  // Check each manifest exports FLOW_MANIFEST
  for (const mp of manifestPaths) {
    if (existsSync(mp)) {
      if (fileContains(mp, "FLOW_MANIFEST")) {
        pass("MANIFEST", `exports-FLOW_MANIFEST`, `${mp.split("/src/")[0]?.split("/").pop()} exports FLOW_MANIFEST`);
      } else {
        fail("MANIFEST", `exports-FLOW_MANIFEST`, `${mp} does not export FLOW_MANIFEST`);
      }
    }
  }

  // Check each manifest imports from @tartware/schemas
  for (const mp of manifestPaths) {
    if (existsSync(mp)) {
      if (fileContains(mp, "@tartware/schemas")) {
        pass("MANIFEST", `uses-schema-types`, `${mp.split("/src/")[0]?.split("/").pop()} imports from @tartware/schemas`);
      } else {
        warn("MANIFEST", `uses-schema-types`, `${mp} does not import from @tartware/schemas`);
      }
    }
  }
}

checkDeclaredControls();
checkNoUndeclaredControls();
checkManifestCompliance();

// ─── Report ─────────────────────────────────────────────────────────────────

const passes = results.filter((r) => r.status === "PASS");
const failures = results.filter((r) => r.status === "FAIL");
const warnings = results.filter((r) => r.status === "WARN");

console.log("\n══════════════════════════════════════════════════════");
console.log("  PMS FLOW INTEGRITY TEST REPORT");
console.log("══════════════════════════════════════════════════════\n");

if (failures.length > 0) {
  console.log("❌ FAILURES:\n");
  for (const f of failures) {
    console.log(`  [FAIL] ${f.flow} | ${f.check}`);
    console.log(`         → ${f.detail}\n`);
  }
}

if (warnings.length > 0) {
  console.log("⚠️  WARNINGS:\n");
  for (const w of warnings) {
    console.log(`  [WARN] ${w.flow} | ${w.check}`);
    console.log(`         → ${w.detail}\n`);
  }
}

console.log("──────────────────────────────────────────────────────");
console.log(
  `  Total: ${results.length} | ✅ Pass: ${passes.length} | ❌ Fail: ${failures.length} | ⚠️  Warn: ${warnings.length}`,
);
console.log("──────────────────────────────────────────────────────\n");

if (failures.length > 0) {
  console.log("🚨 FLOW INTEGRITY CHECK FAILED — fix the above issues before deploying.\n");
  process.exit(1);
} else {
  console.log("✅ All flow integrity checks passed.\n");
  process.exit(0);
}
