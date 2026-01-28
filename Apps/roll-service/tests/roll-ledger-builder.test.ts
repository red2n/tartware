import { describe, expect, it } from "vitest";

import type { ReservationEvent } from "@tartware/schemas";

import { buildLedgerEntryFromReservationEvent } from "../src/services/roll-ledger-builder.js";

describe("Roll Ledger Builder", () => {
  it("handles non-string event types without throwing", () => {
    const event = {
      metadata: {
        id: "event-1",
        tenantId: "tenant-1",
        type: 123 as unknown as string,
        timestamp: new Date().toISOString(),
      },
      payload: {
        id: "reservation-1",
        check_out_date: new Date().toISOString(),
      },
    } as ReservationEvent;

    const entry = buildLedgerEntryFromReservationEvent(event);

    expect(entry.rollType).toBe("UNKNOWN");
    expect(entry.sourceEventType).toBe(123 as unknown as string);
  });
});
