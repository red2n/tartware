/**
 * Batched comp-set upsert.
 *
 * `configureCompset` used to issue one INSERT per competitor. Batching them
 * into a single statement means the placeholder numbering is now computed
 * rather than written out, and an off-by-one there would bind every competitor
 * to the wrong column — a failure a type checker cannot see and a smoke test
 * would only catch on a comp set of two or more.
 */

import { describe, expect, it } from "vitest";

import {
  buildCompetitorUpsertSql,
  COMPETITOR_UPSERT_COLUMN_COUNT,
} from "../src/sql/compset-queries.js";

const placeholders = (sql: string): number[] =>
  [...sql.matchAll(/\$(\d+)/g)].map((match) => Number(match[1]));

describe("buildCompetitorUpsertSql", () => {
  it("keeps tenant, property and actor scalar across every row", () => {
    const sql = buildCompetitorUpsertSql(3);
    // $1 tenant and $2 property appear once per row; $3 actor twice per row
    // (created_by and updated_by).
    expect(sql.match(/\$1::uuid/g)).toHaveLength(3);
    expect(sql.match(/\$2::uuid/g)).toHaveLength(3);
    expect(sql.match(/\$3::uuid/g)).toHaveLength(6);
  });

  it("numbers per-row placeholders contiguously after the scalars", () => {
    const sql = buildCompetitorUpsertSql(2);
    const used = new Set(placeholders(sql));
    const expected = 3 + 2 * COMPETITOR_UPSERT_COLUMN_COUNT;

    for (let n = 1; n <= expected; n++) {
      expect(used.has(n), `missing placeholder $${n}`).toBe(true);
    }
    expect(Math.max(...used)).toBe(expected);
  });

  it("starts each row where the previous row ended", () => {
    const rows = buildCompetitorUpsertSql(2).split("),\n    (");
    expect(rows).toHaveLength(2);
    // First row's per-competitor values start at $4, second at $4 + 19.
    expect(rows[0]).toContain("$4,");
    expect(rows[1]).toContain(`$${4 + COMPETITOR_UPSERT_COLUMN_COUNT},`);
  });

  it("still upserts on the competitor_name conflict", () => {
    const sql = buildCompetitorUpsertSql(1);
    expect(sql).toContain("ON CONFLICT (tenant_id, property_id, competitor_name) DO UPDATE SET");
    expect(sql).toContain("RETURNING competitor_property_id, created_at");
  });
});
