import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(),
}));

import { listHousekeepingTasks } from "../src/services/housekeeping-service.js";
import { query } from "../src/lib/db.js";

describe("Housekeeping Service", () => {
  it("normalizes status with non-string values", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          tenant_id: "660e8400-e29b-41d4-a716-446655440000",
          property_id: "880e8400-e29b-41d4-a716-446655440000",
          property_name: null,
          room_number: "101",
          task_type: "CLEAN",
          priority: null,
          status: 123,
          assigned_to: null,
          assigned_at: null,
          scheduled_date: "2024-01-01",
          scheduled_time: null,
          started_at: null,
          completed_at: null,
          inspected_by: null,
          inspected_at: null,
          inspection_passed: null,
          is_guest_request: null,
          special_instructions: null,
          notes: null,
          issues_found: null,
          metadata: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: null,
          version: BigInt(1),
          credits: null,
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const results = await listHousekeepingTasks({
      tenantId: "660e8400-e29b-41d4-a716-446655440000",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("unknown");
    expect(results[0]?.status_display).toBe("Unknown");
  });
});
