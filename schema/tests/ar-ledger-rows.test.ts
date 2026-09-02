/**
 * The AR ledger's status vocabularies, checked against the constraints that
 * actually enforce them.
 *
 * `ar-ledger-rows.ts` exists because nine tables were read through inline
 * `query<{ … }>` generics with every caller re-deriving the columns — the
 * largest entry `check:schema-first` ever carried. Declaring the shapes fixes
 * the duplication, but it introduces a new way to be wrong: a hand-copied union
 * that drifts from the CHECK constraint it was copied from. A type that says
 * `entry_status` is one of six values, when the database allows a seventh, is
 * worse than `string` — it reads as verified and is not.
 *
 * So these read the DDL. Add a value to a CHECK constraint without adding it
 * here and the test fails, which is the same trick the flow registry's
 * `evidence` field plays on gate declarations.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
	AR_ACCOUNT_STATUSES,
	AR_AGING_BUCKETS,
	AR_APPLICATION_STATUSES,
	AR_DISPUTE_OUTCOMES,
	AR_DISPUTE_REASONS,
	AR_DISPUTE_STATUSES,
	AR_DUNNING_EVENT_TYPES,
	AR_ENTRY_STATUSES,
	AR_PAYMENT_TERMS,
	FOLIO_WINDOW_BILLED_TO_TYPES,
} from "../src/schemas/04-financial/ar-ledger-rows.js";

const TABLES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "tables", "04-financial");

/**
 * The values a `CHECK (<column> IN (…))` admits, read out of the DDL.
 *
 * Deliberately not a SQL parser: these constraints are all written in the same
 * shape, and a regex that stops working is a loud failure rather than a quiet
 * wrong answer — the `expect(values.length)` guard below makes an empty match
 * fail instead of vacuously passing, which is the failure mode a test like this
 * usually dies of.
 */
const checkValues = (file: string, column: string): string[] => {
	// Line comments go first. One of these constraints documents a value as
	// "Dunning suppressed (e.g. payment plan agreed)", and the closing paren
	// inside that comment ends the match early — the first run of this test
	// reported a drift that was really a truncated read. `check-schema-first`
	// strips comments before parsing DDL for the same reason.
	const sql = readFileSync(join(TABLES, file), "utf8")
		.split("\n")
		.map((line) => line.replace(/--.*$/, ""))
		.join("\n");
	const match = new RegExp(`CHECK\\s*\\(\\s*${column}\\s+IN\\s*\\(([^)]*)\\)`, "i").exec(sql);
	if (!match) throw new Error(`No CHECK … IN (…) for ${column} in ${file}`);
	const values = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
	expect(values.length).toBeGreaterThan(1);
	return values;
};

describe("every declared status union matches its CHECK constraint", () => {
	const cases: [string, string, string, readonly string[]][] = [
		["ar_accounts.account_status", "82_ar_accounts.sql", "account_status", AR_ACCOUNT_STATUSES],
		["ar_accounts.payment_terms", "82_ar_accounts.sql", "payment_terms", AR_PAYMENT_TERMS],
		["ar_city_ledger.entry_status", "83_ar_city_ledger.sql", "entry_status", AR_ENTRY_STATUSES],
		["ar_city_ledger.aging_bucket", "83_ar_city_ledger.sql", "aging_bucket", AR_AGING_BUCKETS],
		[
			"ar_cash_applications.application_status",
			"86_ar_cash_applications.sql",
			"application_status",
			AR_APPLICATION_STATUSES,
		],
		["ar_disputes.dispute_status", "87_ar_disputes.sql", "dispute_status", AR_DISPUTE_STATUSES],
		["ar_disputes.dispute_reason", "87_ar_disputes.sql", "dispute_reason", AR_DISPUTE_REASONS],
		[
			"ar_disputes.resolution_outcome",
			"87_ar_disputes.sql",
			"resolution_outcome",
			AR_DISPUTE_OUTCOMES,
		],
		[
			"ar_dunning_events.event_type",
			"85_ar_dunning_events.sql",
			"event_type",
			AR_DUNNING_EVENT_TYPES,
		],
		[
			"folio_windows.billed_to_type",
			"76_folio_windows.sql",
			"billed_to_type",
			FOLIO_WINDOW_BILLED_TO_TYPES,
		],
	];

	for (const [name, file, column, declared] of cases) {
		it(`${name} — the type admits exactly what the database does`, () => {
			// Sorted: the DDL orders these for readability and the union orders
			// them for meaning, and neither order is the thing under test.
			expect([...declared].sort()).toEqual([...checkValues(file, column)].sort());
		});
	}
});

describe("the vocabularies say what the ledger can do", () => {
	/**
	 * A written-off entry is still an entry. If WRITTEN_OFF ever left this
	 * union the write-off gate's own `ON CONFLICT … WHERE entry_status NOT IN
	 * (…)` predicate would stop matching its partial index, which is the
	 * 42P10 that made `ar.city_ledger.transfer` fail on every call it ever had.
	 */
	it("keeps the two terminal entry statuses the transfer predicate excludes", () => {
		expect(AR_ENTRY_STATUSES).toContain("WRITTEN_OFF");
		expect(AR_ENTRY_STATUSES).toContain("CANCELLED");
	});

	it("has an aging bucket for every column on the snapshot row", () => {
		// bucket_1_30 … bucket_over_120 plus current_amount: six buckets, and
		// an aging report that renders five of them silently loses a column.
		expect(AR_AGING_BUCKETS).toHaveLength(6);
	});

	it("does not let a dispute resolve to an outcome the ledger cannot post", () => {
		// WRITE_OFF is the only outcome that moves money, and it is the reason
		// AR_DISPUTE_OUTCOMES is not just a free-text note.
		expect(AR_DISPUTE_OUTCOMES).toContain("WRITE_OFF");
	});
});
