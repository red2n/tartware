/**
 * Batched VALUES construction.
 *
 * The placeholder numbering is computed rather than written out, so an
 * off-by-one binds every row after the first to the wrong column. That has
 * already happened once in this repo — a comp-set upsert declared 19 values per
 * row where the caller pushed 18 — so the arithmetic is asserted here rather
 * than left to each call site.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildValuesRows, chunkForBatch, maxRowsPerBatch } from "../src/sql-batch.js";

const placeholderNumbers = (sql: string): number[] =>
	[...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));

describe("buildValuesRows", () => {
	it("numbers each row's values contiguously after the scalars", () => {
		const sql = buildValuesRows({
			rowCount: 3,
			columnsPerRow: 2,
			scalarCount: 1,
			render: (p) => `($1::uuid, ${p(1)}, ${p(2)})`,
		});

		assert.deepEqual(placeholderNumbers(sql), [1, 2, 3, 1, 4, 5, 1, 6, 7]);
	});

	it("starts the first row immediately after the scalars", () => {
		const sql = buildValuesRows({
			rowCount: 1,
			columnsPerRow: 3,
			scalarCount: 4,
			render: (p) => `(${p(1)}, ${p(2)}, ${p(3)})`,
		});

		assert.deepEqual(placeholderNumbers(sql), [5, 6, 7]);
	});

	it("supports a scalar reused several times in one row", () => {
		// created_by and updated_by are commonly the same actor.
		const sql = buildValuesRows({
			rowCount: 2,
			columnsPerRow: 1,
			scalarCount: 2,
			render: (p) => `($1::uuid, ${p(1)}, $2::uuid, $2::uuid)`,
		});

		assert.deepEqual(placeholderNumbers(sql), [1, 3, 2, 2, 1, 4, 2, 2]);
	});

	it("passes the row index through for callers that need it", () => {
		const sql = buildValuesRows({
			rowCount: 3,
			columnsPerRow: 1,
			scalarCount: 0,
			render: (p, index) => `(${p(1)} /* ${index} */)`,
		});

		assert.ok(sql.includes("/* 0 */"));
		assert.ok(sql.includes("/* 2 */"));
	});

	it("returns an empty string for no rows, so a caller can guard on it", () => {
		const sql = buildValuesRows({
			rowCount: 0,
			columnsPerRow: 3,
			scalarCount: 1,
			render: (p) => `(${p(1)})`,
		});

		assert.equal(sql, "");
	});

	it("rejects a column outside the declared width", () => {
		assert.throws(
			() =>
				buildValuesRows({
					rowCount: 1,
					columnsPerRow: 2,
					scalarCount: 0,
					render: (p) => `(${p(1)}, ${p(2)}, ${p(3)})`,
				}),
			/outside the 2 declared/,
		);
	});

	it("rejects negative counts rather than emitting a malformed statement", () => {
		assert.throws(
			() =>
				buildValuesRows({
					rowCount: -1,
					columnsPerRow: 1,
					scalarCount: 0,
					render: (p) => `(${p(1)})`,
				}),
			/must not be negative/,
		);
	});
});

describe("maxRowsPerBatch", () => {
	it("respects the 65535 parameter ceiling", () => {
		assert.equal(maxRowsPerBatch(1), 65535);
		assert.equal(maxRowsPerBatch(20), 3276);
	});

	it("reserves room for the scalars", () => {
		assert.equal(maxRowsPerBatch(10, 5), Math.floor((65535 - 5) / 10));
	});
});

describe("chunkForBatch", () => {
	it("leaves a batch that already fits in one piece", () => {
		assert.deepEqual(chunkForBatch([1, 2, 3], 10), [[1, 2, 3]]);
	});

	it("returns nothing for an empty input, so callers skip the round trip", () => {
		assert.deepEqual(chunkForBatch([], 10), []);
	});

	it("splits an oversized batch at the parameter ceiling", () => {
		const items = Array.from({ length: 5 }, (_, i) => i);
		// 30000 columns per row leaves room for two rows per statement.
		const chunks = chunkForBatch(items, 30000);
		assert.deepEqual(chunks, [[0, 1], [2, 3], [4]]);
	});
});
