import { describe, expect, it, vi } from "vitest";

import { listReservations } from "../src/services/reservation-service.js";
import { query } from "../src/lib/db.js";

describe("Reservation Service", () => {
  it("normalizes missing status/source safely", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "aa0e8400-e29b-41d4-a716-446655440099",
          tenant_id: "660e8400-e29b-41d4-a716-446655440000",
          property_id: "880e8400-e29b-41d4-a716-446655440000",
          property_name: "Test Property",
          guest_id: null,
          room_type_id: null,
          room_type_name: null,
          confirmation_number: "CONF-123456",
          check_in_date: "2024-01-10",
          check_out_date: "2024-01-12",
          booking_date: null,
          actual_check_in: null,
          actual_check_out: null,
          room_number: null,
          number_of_adults: null,
          number_of_children: null,
          total_amount: "450.00",
          paid_amount: null,
          balance_due: null,
          currency: null,
          status: 123,
          source: null,
          guest_name: "John Doe",
          guest_email: "john.doe@example.com",
          guest_phone: null,
          special_requests: null,
          internal_notes: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: null,
          version: BigInt(1),
          nights: 2,
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const results = await listReservations({
      tenantId: "660e8400-e29b-41d4-a716-446655440000",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("unknown");
    expect(results[0]?.status_display).toBe("Unknown");
    expect(results[0]?.source).toBeUndefined();
    expect(results[0]?.currency).toBe("USD");
  });
});
