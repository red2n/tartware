import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { subtractOneDayUtc } from "../src/services/availability-sync.js";
import {
  dedupeSnapshots,
  type ReservationSnapshot,
} from "../src/services/reservation-event-handler.js";

describe("availability-sync helpers", () => {
  it("subtractOneDayUtc handles month boundaries", () => {
    expect(subtractOneDayUtc("2025-03-01")).toEqual("2025-02-28");
    expect(subtractOneDayUtc("2024-03-01")).toEqual("2024-02-29"); // leap year
  });

  it("subtractOneDayUtc handles year boundaries", () => {
    expect(subtractOneDayUtc("2025-01-01")).toEqual("2024-12-31");
  });
});

describe("dedupeSnapshots", () => {
  const snapshot = (overrides: Partial<ReservationSnapshot> = {}): ReservationSnapshot => ({
    id: overrides.id ?? randomUUID(),
    tenant_id: overrides.tenant_id ?? "tenant-1",
    property_id: overrides.property_id ?? "property-1",
    room_type_id: overrides.room_type_id ?? "room-type-1",
    check_in_date: overrides.check_in_date ?? "2025-05-10",
    check_out_date: overrides.check_out_date ?? "2025-05-12",
  });

  it("removes duplicate ranges while preserving last context", () => {
    const first = snapshot({ id: "a" });
    const second = snapshot({ id: "a", check_in_date: "2025-05-11" });

    const ranges = dedupeSnapshots(
      ["ctx:first", first],
      ["ctx:duplicate", { ...first }],
      ["ctx:updated", second],
    );

    expect(ranges).toHaveLength(2);
    const keys = ranges.map(
      (range) =>
        `${range.propertyId}-${range.roomTypeId}-${range.checkInDate}-${range.checkOutDate}`,
    );
    expect(keys).toContain(
      `${first.property_id}-${first.room_type_id}-${first.check_in_date}-${first.check_out_date}`,
    );
    expect(keys).toContain(
      `${second.property_id}-${second.room_type_id}-${second.check_in_date}-${second.check_out_date}`,
    );
    expect(ranges.find((r) => r.checkInDate === first.check_in_date)?.context).toBe(
      "ctx:duplicate",
    );
    expect(ranges.find((r) => r.checkInDate === second.check_in_date)?.context).toBe(
      "ctx:updated",
    );
  });

  it("ignores null snapshots", () => {
    const ranges = dedupeSnapshots(["ctx:none", null]);
    expect(ranges).toHaveLength(0);
  });
});
