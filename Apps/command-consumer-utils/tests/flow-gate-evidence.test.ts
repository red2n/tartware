/**
 * Every control the flow registry declares must be provable, and every control
 * the code enforces must be declared.
 *
 * `flow:integrity` is what actually runs these two checks against the working
 * tree; this test guards the shape they depend on. The declaration side is the
 * one that decayed before: three of nine declared gates were verified by
 * nothing for as long as they existed, because the check was hand-written per
 * flow and separate from the declaration.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FLOW_REGISTRY,
  FlowId,
  flowControlNames,
  registeredCommandNames,
} from "@tartware/schemas";
import { describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const APPS = join(ROOT, "Apps");

const allControls = Object.entries(FLOW_REGISTRY).flatMap(([flowId, requirement]) =>
  (requirement.requiredGates ?? []).map((control) => ({ flowId, control })),
);

describe("declared controls", () => {
  it("declares at least one control, or this whole check is theatre", () => {
    expect(allControls.length).toBeGreaterThan(0);
  });

  it("carries evidence on every declaration", () => {
    const bare = allControls
      .filter(({ control }) => control.evidence.length === 0)
      .map(({ control }) => control.gateName);
    expect(bare).toEqual([]);
  });

  it("points every evidence file at a file that exists", () => {
    const missing = allControls.flatMap(({ control }) =>
      control.evidence
        .filter((evidence) => !existsSync(join(ROOT, evidence.file)))
        .map((evidence) => `${control.gateName} → ${evidence.file}`),
    );
    expect(missing).toEqual([]);
  });

  it("uses a repo-relative path, never an absolute one", () => {
    // An absolute path would pass on the machine that wrote it and nowhere else.
    const absolute = allControls.flatMap(({ control }) =>
      control.evidence
        .filter((evidence) => evidence.file.startsWith("/"))
        .map((evidence) => `${control.gateName} → ${evidence.file}`),
    );
    expect(absolute).toEqual([]);
  });

  it("finds every evidence token in the file it names", () => {
    // The same assertion flow:integrity makes. Duplicated here on purpose: the
    // script is a gate, this is a test, and the two run in different places.
    const unproven = allControls.flatMap(({ control }) =>
      control.evidence
        .filter((evidence) => {
          const full = join(ROOT, evidence.file);
          return !existsSync(full) || !readFileSync(full, "utf-8").includes(evidence.token);
        })
        .map((evidence) => `${control.gateName}: "${evidence.token}" in ${evidence.file}`),
    );
    expect(unproven).toEqual([]);
  });

  it("guards a command that exists", () => {
    const unknown = allControls
      .filter(({ control }) => !registeredCommandNames.has(control.guardsCommand))
      .map(({ control }) => `${control.gateName} → ${control.guardsCommand}`);
    expect(unknown).toEqual([]);
  });

  it("never declares the same gate twice for one command", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const { control } of allControls) {
      const key = `${control.gateName}::${control.guardsCommand}`;
      if (seen.has(key)) duplicates.push(key);
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });
});

describe("no control is enforced without being declared", () => {
  const declared = new Set(allControls.map(({ control }) => control.gateName));

  const enforced = new Map<string, string>();
  const walk = (dir: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".ts") && entry.name !== "flow-manifest.ts") {
        for (const match of readFileSync(full, "utf-8").matchAll(
          /gate_?[Nn]ame:\s*"([a-z0-9_]+)"/g,
        )) {
          const name = match[1];
          if (name && !enforced.has(name)) enforced.set(name, relative(ROOT, full));
        }
      }
    }
  };
  for (const service of readdirSync(APPS, { withFileTypes: true })) {
    if (service.isDirectory()) walk(join(APPS, service.name, "src"));
  }

  it("finds the gate names the services actually write", () => {
    // Without this the next assertion passes on an empty scan.
    expect(enforced.size).toBeGreaterThanOrEqual(7);
  });

  it("has a declaration for each of them", () => {
    const undeclared = [...enforced.entries()]
      .filter(([name]) => !declared.has(name))
      .map(([name, file]) => `${name} (${file})`);
    expect(undeclared).toEqual([]);
  });
});

describe("flowControlNames", () => {
  it("gives night audit the three preconditions, not the bypass record", () => {
    expect(
      flowControlNames(FlowId.NIGHT_AUDIT, {
        guardsCommand: "billing.night_audit.execute",
      }),
    ).toEqual(["open_arrivals_check", "open_departures_check", "unbalanced_folios_check"]);
  });

  it("returns records only when asked for them", () => {
    expect(
      flowControlNames(FlowId.NIGHT_AUDIT, {
        guardsCommand: "billing.night_audit.execute",
        kind: "record",
      }),
    ).toEqual(["night_audit_precondition_bypass"]);
  });

  it("treats an undeclared kind as a gate, matching the type default", () => {
    // Every declaration that omits `kind` is a precondition; a record has to
    // say so. Getting this backwards would file a bypass record as a control.
    const gates = flowControlNames(FlowId.CHECK_IN);
    expect(gates).toContain("reservation_status_check");
    expect(gates).not.toContain("reverse_check_in");
  });

  it("filters by command, so one flow's gates do not leak into another's", () => {
    expect(
      flowControlNames(FlowId.CHECK_IN, { guardsCommand: "reservation.check_out" }),
    ).toEqual([]);
  });

  it("is empty for a flow that declares nothing", () => {
    expect(flowControlNames(FlowId.HOUSEKEEPING)).toEqual([]);
  });
});
