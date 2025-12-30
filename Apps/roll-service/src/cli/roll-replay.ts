#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { rollLogger } from "../lib/logger.js";
import {
  fetchShadowLedgersByReservation,
  type ShadowLedgerEntry,
} from "../repositories/ledger-repository.js";
import { fetchLifecycleRowsByReservation } from "../repositories/lifecycle-repository.js";
import { buildLedgerEntryFromLifecycleRow } from "../services/roll-ledger-builder.js";

type ParsedArgs = {
  reservationId?: string;
  output?: string;
  stdout?: boolean;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const [key, rawValue] = arg.slice(2).split("=");
    const value = rawValue ?? "true";
    if (key === "reservation-id" || key === "reservationId") {
      parsed.reservationId = value;
    } else if (key === "output") {
      parsed.output = value;
    } else if (key === "stdout") {
      parsed.stdout = value !== "false";
    }
  }
  return parsed;
};

type FieldDiff = {
  field: string;
  expected: unknown;
  actual: unknown;
};

type ReplayEntry = {
  lifecycleEventId: string;
  status: "match" | "diff" | "missing_in_shadow" | "extra_in_shadow";
  derived?: DerivedSnapshot;
  shadow?: ShadowSnapshot;
  diffs?: FieldDiff[];
};

type DerivedSnapshot = {
  tenantId: string;
  reservationId?: string;
  rollType: string;
  rollDate: string;
  occurredAt: string;
  sourceEventType: string;
};

type ShadowSnapshot = DerivedSnapshot & { ledgerId: string };

const toDerivedSnapshot = (
  entry: ReturnType<typeof buildLedgerEntryFromLifecycleRow>,
): DerivedSnapshot => ({
  tenantId: entry.tenantId,
  reservationId: entry.reservationId,
  rollType: entry.rollType,
  rollDate: entry.rollDate,
  occurredAt: entry.occurredAt.toISOString(),
  sourceEventType: entry.sourceEventType,
});

const toShadowSnapshot = (entry: ShadowLedgerEntry): ShadowSnapshot => ({
  ledgerId: entry.ledgerId,
  tenantId: entry.tenantId,
  reservationId: entry.reservationId,
  rollType: entry.rollType,
  rollDate: entry.rollDate,
  occurredAt: entry.occurredAt.toISOString(),
  sourceEventType: entry.sourceEventType,
});

const compareEntries = (
  derivedSnapshot: DerivedSnapshot,
  shadowSnapshot: ShadowSnapshot,
): FieldDiff[] => {
  const diffs: FieldDiff[] = [];
  const comparableFields: Array<keyof DerivedSnapshot> = [
    "tenantId",
    "reservationId",
    "rollType",
    "rollDate",
    "occurredAt",
    "sourceEventType",
  ];

  for (const field of comparableFields) {
    if (derivedSnapshot[field] !== shadowSnapshot[field]) {
      diffs.push({
        field,
        expected: derivedSnapshot[field],
        actual: shadowSnapshot[field],
      });
    }
  }
  return diffs;
};

const buildReportPath = (reservationId: string, output?: string) => {
  if (output) {
    return path.resolve(process.cwd(), output);
  }
  return path.resolve(
    process.cwd(),
    "docs/rolls/reports",
    `reservation-${reservationId}.json`,
  );
};

type ReplayReport = {
  generatedAt: string;
  reservationId: string;
  tenantId: string | null;
  summary: {
    lifecycleEvents: number;
    derivedEntries: number;
    shadowEntries: number;
    matches: number;
    mismatches: number;
    missingInShadow: number;
    extraInShadow: number;
  };
  entries: ReplayEntry[];
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.reservationId) {
    console.error("Missing --reservation-id=<uuid>");
    process.exit(1);
  }

  const lifecycleRows = await fetchLifecycleRowsByReservation(
    args.reservationId,
  );
  if (lifecycleRows.length === 0) {
    rollLogger.warn(
      { reservationId: args.reservationId },
      "No lifecycle rows found for replay",
    );
  }

  const derivedEntries = lifecycleRows.map((row) =>
    buildLedgerEntryFromLifecycleRow(row),
  );
  const shadowEntries = await fetchShadowLedgersByReservation(
    args.reservationId,
  );

  const shadowByLifecycleId = new Map(
    shadowEntries.map((entry) => [entry.lifecycleEventId, entry]),
  );
  const seenLifecycleIds = new Set<string>();

  const entries: ReplayEntry[] = [];
  let matches = 0;
  let mismatches = 0;
  let missingInShadow = 0;

  for (const derived of derivedEntries) {
    const shadow = shadowByLifecycleId.get(derived.lifecycleEventId);
    const derivedSnapshot = toDerivedSnapshot(derived);
    if (!shadow) {
      entries.push({
        lifecycleEventId: derived.lifecycleEventId,
        status: "missing_in_shadow",
        derived: derivedSnapshot,
      });
      missingInShadow += 1;
      continue;
    }

    seenLifecycleIds.add(derived.lifecycleEventId);
    const shadowSnapshot = toShadowSnapshot(shadow);
    const diffs = compareEntries(derivedSnapshot, shadowSnapshot);

    if (diffs.length === 0) {
      matches += 1;
      entries.push({
        lifecycleEventId: derived.lifecycleEventId,
        status: "match",
        derived: derivedSnapshot,
        shadow: shadowSnapshot,
      });
    } else {
      mismatches += 1;
      entries.push({
        lifecycleEventId: derived.lifecycleEventId,
        status: "diff",
        derived: derivedSnapshot,
        shadow: shadowSnapshot,
        diffs,
      });
    }
  }

  const extraInShadowEntries = shadowEntries.filter(
    (entry) => !seenLifecycleIds.has(entry.lifecycleEventId),
  );

  for (const extra of extraInShadowEntries) {
    entries.push({
      lifecycleEventId: extra.lifecycleEventId,
      status: "extra_in_shadow",
      shadow: toShadowSnapshot(extra),
    });
  }

  const report: ReplayReport = {
    generatedAt: new Date().toISOString(),
    reservationId: args.reservationId,
    tenantId: lifecycleRows[0]?.tenant_id ?? shadowEntries[0]?.tenantId ?? null,
    summary: {
      lifecycleEvents: lifecycleRows.length,
      derivedEntries: derivedEntries.length,
      shadowEntries: shadowEntries.length,
      matches,
      mismatches,
      missingInShadow,
      extraInShadow: extraInShadowEntries.length,
    },
    entries,
  };

  if (args.stdout) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    rollLogger.info(
      {
        reservationId: args.reservationId,
        matches,
        mismatches,
        missingInShadow,
        extraInShadow: extraInShadowEntries.length,
      },
      "Roll replay report emitted via stdout",
    );
    return;
  }

  const reportPath = buildReportPath(args.reservationId, args.output);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  rollLogger.info(
    {
      reportPath,
      reservationId: args.reservationId,
      matches,
      mismatches,
      missingInShadow,
      extraInShadow: extraInShadowEntries.length,
    },
    "Replay report written",
  );
};

await run().catch((error: unknown) => {
  rollLogger.error(
    { err: error, reservationId: process.argv.join(" ") },
    "Failed to run roll replay",
  );
  process.exit(1);
});
