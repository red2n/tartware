/**
 * The reason-code listing has to resolve what the handlers resolve.
 *
 * `resolveReasonCode` — in `@tartware/command-consumer-utils`, the helper every
 * controlled command uses — reads three levels: the property's own code, then
 * the tenant's, then the product's defaults under the all-zero system tenant.
 * This listing read `tenant_id = $1` alone.
 *
 * Every one of the forty-six codes the product ships is seeded under the system
 * tenant, so `GET /v1/reason-codes` answered with an empty array for every
 * tenant that had not written its own, while every handler accepted all
 * forty-six. That is the read-side twin of the defect that had those same codes
 * seeded under the demo tenant: the control is correct and unreachable, and the
 * operator cannot tell an empty list from a missing feature.
 */

import { describe, expect, it, vi } from "vitest";

import { query } from "../src/lib/db.js";
import { listReasonCodes } from "../src/services/booking-config/distribution.js";

const TENANT = "660e8400-e29b-41d4-a716-446655440000";
const PROPERTY = "880e8400-e29b-41d4-a716-446655440000";
const SYSTEM_TENANT = "00000000-0000-0000-0000-000000000000";

const capture = () => {
  const seen: { sql: string; params: unknown[] } = { sql: "", params: [] };
  vi.mocked(query).mockImplementationOnce(async (sql: string, params?: unknown[]) => {
    seen.sql = sql;
    seen.params = params ?? [];
    return { rows: [], rowCount: 0, command: "SELECT", oid: 0, fields: [] };
  });
  return seen;
};

describe("listReasonCodes", () => {
  it("reads the caller's tenant and the system tenant, not one of them", async () => {
    const seen = capture();
    await listReasonCodes({ tenantId: TENANT });
    expect(seen.sql).toContain("tenant_id IN ($1::uuid, $5::uuid)");
    expect(seen.params).toContain(TENANT);
    expect(seen.params).toContain(SYSTEM_TENANT);
  });

  it("collapses the levels so a tenant's own override is not listed twice", async () => {
    // A tenant that redefines WO_GOODWILL should see its row, not both. The
    // ordering inside DISTINCT ON is the same precedence resolveReasonCode uses.
    const seen = capture();
    await listReasonCodes({ tenantId: TENANT });
    expect(seen.sql).toContain("DISTINCT ON (UPPER(reason_code))");
    expect(seen.sql).toContain("(tenant_id = $1::uuid) DESC");
    expect(seen.sql).toContain("property_id NULLS LAST");
  });

  it("returns approval_level, so a picker can say what a code costs", async () => {
    const seen = capture();
    await listReasonCodes({ tenantId: TENANT });
    expect(seen.sql).toContain("approval_level");
    expect(seen.sql).toContain("is_system_default");
  });

  it("still narrows by property and category", async () => {
    const seen = capture();
    await listReasonCodes({ tenantId: TENANT, propertyId: PROPERTY, category: "WRITE_OFF" });
    expect(seen.params[1]).toBe(PROPERTY);
    expect(seen.params[2]).toBe("WRITE_OFF");
    expect(seen.sql).toContain("UPPER(reason_category) = UPPER($3::text)");
  });

  it("keeps a tenant-wide code visible when a property is named", async () => {
    // `property_id IS NULL OR …` rather than an equality: the shipped codes
    // carry no property, and a property-scoped request that dropped them would
    // show an empty picker on exactly the screens that need one.
    const seen = capture();
    await listReasonCodes({ tenantId: TENANT, propertyId: PROPERTY });
    expect(seen.sql).toContain("property_id IS NULL OR $2::uuid IS NULL OR property_id = $2::uuid");
  });
});
