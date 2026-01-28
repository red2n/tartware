import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(),
}));

import { listRooms } from "../src/services/room-service.js";
import { query } from "../src/lib/db.js";

describe("Room Service", () => {
  it("normalizes enum values with non-string inputs", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          tenant_id: "660e8400-e29b-41d4-a716-446655440000",
          property_id: "880e8400-e29b-41d4-a716-446655440000",
          property_name: null,
          room_type_id: null,
          room_type_name: null,
          room_number: "101",
          room_name: null,
          floor: null,
          building: null,
          wing: null,
          status: 1,
          housekeeping_status: null,
          maintenance_status: undefined,
          is_blocked: null,
          block_reason: null,
          is_out_of_order: null,
          out_of_order_reason: null,
          expected_ready_date: null,
          housekeeping_notes: null,
          metadata: null,
          updated_at: null,
          version: BigInt(1),
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const results = await listRooms({
      tenantId: "660e8400-e29b-41d4-a716-446655440000",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("unknown");
    expect(results[0]?.status_display).toBe("Unknown");
    expect(results[0]?.housekeeping_status).toBe("unspecified");
  });
});
