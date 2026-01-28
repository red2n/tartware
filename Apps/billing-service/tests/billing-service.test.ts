import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(),
}));

import { listBillingPayments } from "../src/services/billing-service.js";
import { query } from "../src/lib/db.js";

describe("Billing Service", () => {
  it("normalizes enum displays with non-string inputs", async () => {
    vi.mocked(query).mockResolvedValueOnce({
      rows: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          tenant_id: "660e8400-e29b-41d4-a716-446655440000",
          property_id: "880e8400-e29b-41d4-a716-446655440000",
          property_name: null,
          reservation_id: null,
          confirmation_number: null,
          guest_id: null,
          reservation_guest_name: null,
          reservation_guest_email: null,
          guest_first_name: null,
          guest_last_name: null,
          payment_reference: "PAY-1",
          external_transaction_id: null,
          transaction_type: 1,
          payment_method: null,
          amount: "10.00",
          currency: null,
          status: 5,
          gateway_name: null,
          gateway_reference: null,
          processed_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: null,
          version: BigInt(1),
        },
      ],
      rowCount: 1,
      command: "SELECT",
      oid: 0,
      fields: [],
    });

    const results = await listBillingPayments({
      tenantId: "660e8400-e29b-41d4-a716-446655440000",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.transaction_type).toBe("unknown");
    expect(results[0]?.payment_method).toBe("unknown");
    expect(results[0]?.status).toBe("unknown");
    expect(results[0]?.currency).toBe("USD");
  });
});
