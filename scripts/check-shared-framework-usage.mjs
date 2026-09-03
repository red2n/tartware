#!/usr/bin/env node
/**
 * Fail if service code hand-rolls something a shared framework already owns.
 *
 * A shared package only pays off when every service actually goes through it.
 * KafkaJS clients drifted exactly this way: `@tartware/command-consumer-utils`
 * exposed `createKafkaClient()`, two services used it, and five others called
 * `new Kafka(...)` directly — which is how unformatted KafkaJS JSON ended up
 * interleaved with the pino output. A convention nobody checks is a convention
 * the next change forgets, so this asserts it instead.
 *
 * Add a rule here whenever a shared entry point becomes the only right way to
 * do something. Keep `allow` lists tight and justified.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * @typedef {object} FrameworkRule
 * @property {string} id            Short slug, shown on failure.
 * @property {RegExp} pattern       Matched per line against tracked TypeScript sources.
 * @property {string[]} allow       Exact repo-relative paths (or path prefixes) permitted to match.
 * @property {string} use           The shared entry point callers must go through instead.
 * @property {string} why           Why the shared entry point exists — the cost of bypassing it.
 * @property {(line: string) => boolean} [ignore]  Lines that match the pattern but are fine.
 */

/** Type-only imports pull no runtime code, so they never bypass a framework. */
const isTypeOnlyImport = (line) => {
  const trimmed = line.trim();
  if (/^import\s+type\s/.test(trimmed)) return true;
  const braces = trimmed.match(/^import\s*\{([^}]*)\}/);
  if (!braces) return false;
  return braces[1]
    .split(",")
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .every((specifier) => specifier.startsWith("type "));
};

/** @type {FrameworkRule[]} */
const RULES = [
  {
    id: "kafka-client",
    pattern: /\bnew Kafka\s*\(/,
    allow: ["Apps/command-consumer-utils/src/producer.ts"],
    use: 'createKafkaClient() from "@tartware/command-consumer-utils/producer"',
    why:
      "the factory routes KafkaJS' own logs through the service logger; a raw client " +
      "prints unformatted JSON to stdout and skips redaction and OTLP export",
  },
  {
    id: "actor-resolution",
    pattern: /\bconst resolveActorId\s*=|\bconst SYSTEM_ACTOR(_ID)?\s*=/,
    // command-utils re-exports the sentinel; @tartware/config defines it, and cannot
    // import from command-consumer-utils (which depends on config) without a cycle.
    allow: ["Apps/command-consumer-utils/src/command-utils.ts", "Apps/config/src/audit.ts"],
    use: 'resolveActorId() / SYSTEM_ACTOR_ID from "@tartware/command-consumer-utils/command-utils"',
    why:
      "local copies skipped UUID validation and fell back to strings like \"COMMAND_CENTER\", " +
      "which Postgres rejects on the UUID audit columns (22P02) and which disagree with the " +
      "seeded system.actor row every other service writes",
  },
  {
    id: "approval-role-literal",
    // `roleAtApproval:` / `role_at_approval:` followed by a quoted string.
    // A real role always arrives through a resolver or a membership lookup.
    pattern: /\brole_?[Aa]t_?[Aa]pproval\s*:\s*["'`]/,
    allow: [],
    use: 'resolveActorRole(initiatedBy) from "@tartware/command-consumer-utils/command-utils", or the membership role on the request',
    why:
      "flow_approvals.role_at_approval documents itself as a snapshot of the approver's role, " +
      "and every command-path writer passed a literal instead — \"FORCE_OVERRIDE\", \"GM_OVERRIDE\", " +
      "\"REVERSAL\" — none of which is a role the product defines. The real role rides the command " +
      "envelope as initiatedBy.role the whole way to the consumer, so an override trail that cannot " +
      "say what authority a bypass was made under was throwing away data it already had. Use the " +
      "`forced` flag to record that a gate was bypassed",
  },
  {
    id: "command-required-role",
    // A role literal handed to the command path — `requiredRole: "MANAGER"`, or
    // `minRole` on a scope that guards command submissions. Both were the same
    // single level for all 202 commands, which is A02.
    pattern: /\brequiredRole\s*:\s*["'`]/,
    allow: [],
    use: 'the per-command floor in COMMAND_MIN_ROLE (schema/src/api/command-permissions.ts), applied inside acceptCommand; COMMAND_AUTHORITY_FLOOR for a route-level membership gate',
    why:
      "every command write in the gateway passed requiredRole: \"MANAGER\", so the clerk who checks " +
      "a guest in held the same authority as the one who writes off bad debt, and there was no way " +
      "to express an override as a distinct right. A literal here re-establishes a second, coarser " +
      "ladder in front of the declared one and silently wins whenever it is stricter",
  },
  {
    id: "approval-grant",
    // `approvalGrant:` on an accept-command input. It is the token that
    // satisfies dual control inside acceptCommand, so anywhere it can be built
    // from caller input the control is a caller-set boolean again.
    pattern: /\bapprovalGrant\s*:/,
    allow: [
      // The one place a grant is legitimately minted: after a second person's
      // decision has been evaluated against a locked row.
      "Apps/api-gateway/src/command-center/command-approval-service.ts",
    ],
    use: "approveCommandRequest() in Apps/api-gateway/src/command-center/command-approval-service.ts",
    why:
      "a command in COMMAND_DUAL_CONTROL is deferred to approval_requests unless the accept " +
      "input already carries an approval grant. Building that grant anywhere else — from a " +
      "request body, from a handler, from a flag — waives the second signature on the caller's " +
      "own authority, which is the force: true problem the finding exists to remove",
  },
  {
    id: "reservation-status-literal",
    // A TypeScript array or Set of reservation statuses — the shape every
    // lifecycle guard used before A10: ["PENDING", "CONFIRMED"] in the handler,
    // new Set(["CHECKED_IN"]) in the screen. Two or more in a row is the
    // giveaway; one status compared with === is left alone, because that is
    // usually a display branch rather than a movement rule.
    //
    // Double quotes only, deliberately. Roughly forty read-side SQL filters
    // ("... WHERE status IN ('CONFIRMED', 'CHECKED_IN')") say which bookings a
    // report counts, not where one may move, and converting them would be
    // wrong. Biome quotes every TS string double, and every SQL literal in this
    // repo is single-quoted inside a template, so the quote style separates the
    // two cleanly.
    pattern:
      /"(?:INQUIRY|QUOTED|PENDING|CONFIRMED|WAITLISTED|CHECKED_IN|CHECKED_OUT|CANCELLED|NO_SHOW|EXPIRED)"\s*,\s*"(?:INQUIRY|QUOTED|PENDING|CONFIRMED|WAITLISTED|CHECKED_IN|CHECKED_OUT|CANCELLED|NO_SHOW|EXPIRED)"/,
    // Scope note: this script scans Apps/*/src only, so the declaration in
    // schema/ needs no exemption and the pms-ui half of the old drift is not
    // covered here — that side rests on the shared import plus review.
    allow: [
      // A charge precondition, not a movement: a cancellation penalty is
      // postable against a booking that is already CANCELLED or NO_SHOW, and
      // posting it moves nothing. Its sibling billing.no_show_charge *does*
      // move the reservation, and reads the transition table instead.
      "Apps/billing-service/src/services/billing-commands/cancellation-penalty.ts",
    ],
    use: 'reservationStatusesFor("<command>") or classifyReservationCommandTransition() from "@tartware/schemas"',
    why:
      "the reservation lifecycle was eight literal arrays across the command handlers plus a " +
      "second, differently-worded set in pms-ui, and they had already drifted: the screen offered " +
      "Cancel on a WAITLISTED booking the service refused and hid it on the INQUIRY and QUOTED " +
      "bookings it accepted, while reservation.modify wrote any status it was handed and " +
      "reservation.mass_update did it 500 at a time. RESERVATION_COMMAND_TRANSITIONS is the one " +
      "ordering both ends read",
  },
  {
    id: "command-error",
    pattern: /class \w*(Command|Event)Error extends Error\b/,
    allow: ["Apps/command-consumer-utils/src/command-utils.ts"],
    use: 'a subclass of CommandError from "@tartware/command-consumer-utils/command-utils"',
    why:
      "the consumer's retry predicate reads `retryable` off the error; a command error that " +
      "extends bare Error has no such field, so a deterministic rejection is retried through " +
      "the whole backoff ladder and stalls its partition before reaching the DLQ anyway",
  },
  {
    id: "fetch-timeout",
    // `fetch(` on a line that carries no signal, and no signal on the following
    // few lines either — options objects are usually written multi-line.
    pattern: /\bfetch\(/,
    allow: [
      // Proxies a server-sent-events stream, which is meant to stay open.
      "Apps/api-gateway/src/routes/misc-routes.ts",
    ],
    use: "AbortSignal.timeout(ms) on the request",
    why:
      "a fetch with no deadline waits as long as the peer does; billing's startup " +
      "settings load hung its readiness on an unresponsive core-service that way",
    satisfied: /AbortSignal\.timeout|signal:/,
  },
  {
    id: "pino-logger",
    pattern: /from ["']pino["']|require\(["']pino["']\)/,
    allow: ["Apps/telemetry/src/", "Apps/candidate-pipeline/src/__tests__/"],
    use: 'createServiceLogger() from "@tartware/telemetry"',
    why:
      "the shared logger owns level/pretty env handling, redaction of sensitive keys " +
      "and the OTLP log stream; a bare pino instance has none of it",
    ignore: isTypeOnlyImport,
  },
];

/**
 * The text of a call that starts on `lines[start]`, up to its closing paren.
 * Bounded so a malformed file cannot make this run away.
 */
const callText = (lines, start, maxLines = 80) => {
  let depth = 0;
  const collected = [];
  for (let i = start; i < Math.min(lines.length, start + maxLines); i++) {
    collected.push(lines[i]);
    for (const char of lines[i]) {
      if (char === "(") depth++;
      else if (char === ")") depth--;
    }
    if (i > start && depth <= 0) break;
  }
  return collected.join("\n");
};

const isAllowed = (file, rule) =>
  rule.allow.some((entry) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry));

const tracked = spawnSync("git", ["ls-files", "Apps/*/src/**/*.ts", "Apps/*/src/*.ts"], {
  encoding: "utf8",
})
  .stdout.split("\n")
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));

const violations = [];

for (const file of tracked) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue; // deleted but still indexed
  }

  const lines = source.split("\n");
  for (const rule of RULES) {
    if (isAllowed(file, rule)) continue;
    lines.forEach((line, index) => {
      if (line.trimStart().startsWith("*")) return; // doc comment referencing the pattern
      if (rule.ignore?.(line)) return;
      if (rule.pattern.test(line)) {
        if (rule.satisfied) {
          // Some rules are satisfied by something inside the call rather than on
          // its first line — a request's options object can run for twenty
          // lines. Read to the closing paren rather than guessing a window.
          if (rule.satisfied.test(callText(lines, index))) return;
        }
        violations.push({ file, line: index + 1, rule, source: line.trim() });
      }
    });
  }
}

// A `force` flag that waives a control must cost something. Every site that
// records a bypass — `forced: true` on a flow_approvals write — has to have
// asked whether the acting role is entitled to make it, which is
// `assertForcedOverrideAuthority` (a force flag) or `assertOverrideAuthority`
// (an explicit override field). Both read the reason code's `approval_level`.
//
// This is a file-level check on purpose. The assertion runs *before* the
// refusals it authorises — room move resolves its code first so one check
// covers three gates — so it is never inside the recordFlowApproval call and a
// line-scoped rule with a forward-reading `satisfied` cannot see it.
//
// It is written because the sweep was missed once already. A08 put the check on
// room move and the three reversals and stopped, leaving check-in and check-out
// — `reservation_status_check`, `deposit_required_check` and
// `folio_settlement_check`, the only three controls the flow registry declares
// as `kind: "gate"` rather than "record" — writing a forced row on nobody's
// authority, each with a hardcoded reason code that had no row in the table.
// Nothing failed, no test noticed, and the register read as closed.
const FORCED_WRITE = /\bforced\s*:\s*(true|Boolean\()/;
const AUTHORITY_ASSERT = /\bassert(Forced)?OverrideAuthority\s*\(/;

const unauthorizedForcedWrites = [];
for (const file of tracked) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  // Only files that actually write the row; a type declaring `forced` is not one.
  if (!source.includes("recordFlowApproval")) continue;
  const lines = source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("*") && !line.trimStart().startsWith("//"));
  if (!lines.some((line) => FORCED_WRITE.test(line))) continue;
  if (AUTHORITY_ASSERT.test(source)) continue;
  unauthorizedForcedWrites.push(file);
}

if (unauthorizedForcedWrites.length > 0) {
  console.error("\nA bypass is recorded without being authorized:\n");
  for (const file of unauthorizedForcedWrites) {
    console.error(`  ${file}  writes forced: true to flow_approvals and asserts no authority`);
  }
  console.error(
    `\nCall assertForcedOverrideAuthority(reason, actorRole, { commandName, gateName })\n` +
      `from "@tartware/command-consumer-utils/command-utils" before the refusal the\n` +
      `force waives — or assertOverrideAuthority for an explicit override field.\n` +
      `Resolve the reason code first, once per command, so one check covers every\n` +
      `gate that command can force past.\n\n` +
      `Logging a bypass is not controlling it: flow_approvals records that someone\n` +
      `forced something, and without this it cannot say they were allowed to.\n`,
  );
  process.exit(1);
}

// An authority gate must be able to see a supervisor's step-up.
//
// `assertOverrideAuthority` and `assertForcedOverrideAuthority` decide whether
// the acting role clears the reason code's `approval_level`. Since step-up they
// also accept the supervisor's grant from the envelope — and a call site that
// omits it silently answers the *old* question: it measures the session that
// happens to be open and refuses an override a manager physically authorised at
// the terminal. That failure is quiet, looks like a working control, and is
// exactly the shape of A08's first sweep, which added the check to four of eight
// sites and reported itself complete.
//
// Line-scoped rather than file-level, unlike `forced-override-authority` above:
// the property sits inside the call's own context object, so it is visible in
// the three lines that follow the assert.
const STEP_UP_BLIND_ASSERTS = [];
for (const file of tracked) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!AUTHORITY_ASSERT.test(source)) continue;
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (!AUTHORITY_ASSERT.test(lines[i])) continue;
    // The context object closes within a few lines at every existing site.
    const window = lines.slice(i, i + 8).join("\n");
    if (/\bstepUp\s*:/.test(window)) continue;
    STEP_UP_BLIND_ASSERTS.push(`${file}:${i + 1}`);
  }
}

if (STEP_UP_BLIND_ASSERTS.length > 0) {
  console.error("\nAn authority gate cannot see a supervisor's step-up:\n");
  for (const site of STEP_UP_BLIND_ASSERTS) {
    console.error(`  ${site}  asserts authority without passing stepUp`);
  }
  console.error(
    `\nPass the grant from the command envelope:\n` +
      `  assertOverrideAuthority(reason, actorRole, {\n` +
      `    commandName, gateName, stepUp: options.stepUp,\n` +
      `  })\n\n` +
      `Without it the gate measures the session that happens to be open and\n` +
      `refuses an override a supervisor authorised in person — a control that\n` +
      `looks like it works and is wrong in the direction nobody reports.\n`,
  );
  process.exit(1);
}

// Every subpath a workspace package exports must resolve to the *same* copy of
// that package as every other subpath, or a class crosses a module boundary and
// stops being itself.
//
// This is not theoretical. Services run from source through tsx and reach their
// siblings by specifier, so a tsconfig path of the form
// "@tartware/pkg/*": ["../../pkg/src/*"] silently misses any export whose file
// name differs from its export name — `/lifecycle` for consumer-lifecycle.ts,
// `/idempotency` for idempotency-repository.ts, `/batch` for batch-runner.ts.
// Those three fell through to dist while their neighbours resolved to src, which
// gave every consumer two CommandError classes and made
// `error instanceof CommandError` false for errors the retry policy was written
// to recognise. Deterministic failures then burned the full backoff ladder and
// stalled their partition — with a DLQ entry whose own JSON read
// "retryable": false. Nothing failed loudly and every unit test passed.
const unmappedSubpaths = [];
for (const pkgJson of readdirSync("Apps", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `Apps/${entry.name}/package.json`)
  .filter((file) => existsSync(file))) {
  let meta;
  try {
    meta = JSON.parse(readFileSync(pkgJson, "utf8"));
  } catch {
    continue;
  }
  const pkgDir = pkgJson.replace(/\/package\.json$/, "");
  for (const [subpath, target] of Object.entries(meta.exports ?? {})) {
    if (subpath === ".") continue;
    const importTarget = typeof target === "string" ? target : target?.import;
    if (typeof importTarget !== "string") continue;
    const sub = subpath.replace(/^\.\//, "");
    // What the `/*` wildcard in a consumer's tsconfig would resolve to.
    if (!existsSync(`${pkgDir}/src/${sub}.ts`)) {
      unmappedSubpaths.push({ pkg: meta.name, subpath, file: importTarget });
    }
  }
}

// `tracked` is source files only, so the tsconfigs are read directly — the
// first version of this check filtered them out of `tracked` and asserted
// nothing at all, which is the failure mode it exists to catch.
const consumersWithWildcard = readdirSync("Apps", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `Apps/${entry.name}/tsconfig.json`)
  .filter((file) => existsSync(file))
  .map((file) => ({ file, text: readFileSync(file, "utf8") }));

const missingExplicitPath = [];
for (const { pkg, subpath } of unmappedSubpaths) {
  for (const { file, text } of consumersWithWildcard) {
    if (!text.includes(`"${pkg}/*"`)) continue;
    const sub = subpath.replace(/^\.\//, "");
    if (!text.includes(`"${pkg}/${sub}"`)) {
      missingExplicitPath.push({ file, pkg, subpath: sub });
    }
  }
}

if (missingExplicitPath.length > 0) {
  console.error("\nWorkspace subpath resolves to a second copy of its package:\n");
  for (const { file, pkg, subpath } of missingExplicitPath) {
    console.error(`  ${file}  maps ${pkg}/* to src/, but ${pkg}/${subpath} has no source file of that name`);
  }
  console.error(
    `\nAdd an explicit tsconfig path for each one, pointing at the real file, so the\n` +
      `subpath resolves to src like its neighbours instead of falling through the\n` +
      `package exports map to dist. Two copies of a module means two identities for\n` +
      `every class in it, and \`instanceof\` between them is false.\n`,
  );
  process.exit(1);
}

// A workspace import that the package does not declare resolves locally through
// pnpm's store but not in a clean CI install, where it surfaces as an
// unresolvable type and a wall of no-unsafe-* lint errors far from the cause.
// Adding an import without the dependency is easy to do and hard to read back,
// so it is asserted here.
const undeclared = [];
for (const file of tracked) {
  const pkgDir = file.split("/").slice(0, 2).join("/");
  let meta;
  try {
    meta = JSON.parse(readFileSync(`${pkgDir}/package.json`, "utf8"));
  } catch {
    continue;
  }
  const declared = new Set([
    ...Object.keys(meta.dependencies ?? {}),
    ...Object.keys(meta.devDependencies ?? {}),
    meta.name,
  ]);
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const match of source.matchAll(/from ["'](@tartware\/[a-z0-9-]+)/g)) {
    if (!declared.has(match[1])) {
      undeclared.push({ file, pkg: meta.name, dep: match[1] });
    }
  }
}

if (undeclared.length > 0) {
  console.error("\nWorkspace import without a declared dependency:\n");
  const seen = new Set();
  for (const { file, pkg, dep } of undeclared) {
    const key = `${pkg} ${dep}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.error(`  ${pkg} imports ${dep} (e.g. ${file})`);
  }
  console.error(
    `\nAdd it to that package's dependencies as "workspace:*", run pnpm install, and\n` +
      `list it in the package's knip.json "ignoreDependencies" (knip cannot resolve\n` +
      `workspace links). Without this it builds locally and fails on a clean CI install.\n`,
  );
  process.exit(1);
}

if (violations.length > 0) {
  console.error("\nShared framework bypassed:\n");
  for (const { file, line, rule, source } of violations) {
    console.error(`  ${file}:${line}  [${rule.id}]`);
    console.error(`    ${source}`);
    console.error(`    use ${rule.use}`);
    console.error(`    why: ${rule.why}\n`);
  }
  console.error(
    `If a call site genuinely cannot use the shared entry point, add it to the\n` +
      `rule's "allow" list in scripts/check-shared-framework-usage.mjs with a reason.\n`,
  );
  process.exit(1);
}

console.log(
  `Shared framework usage OK — ${tracked.length} files, ${RULES.length} rules: ` +
    `${RULES.map((rule) => rule.id).join(", ")}`,
);
