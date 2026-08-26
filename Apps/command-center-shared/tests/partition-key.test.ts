/**
 * Partition key ↔ ordering contract.
 *
 * Kafka orders within a partition and nowhere else, so this function decides
 * which commands are guaranteed to apply in the order they were accepted. The
 * failure it exists to prevent is silent and expensive: a guest checked out
 * before they were checked in, a folio closed before its charges post.
 *
 * The property that matters is stated directly — commands touching the same
 * aggregate must produce the same key — rather than asserting the field list,
 * which would only restate the implementation.
 */

import { describe, expect, it } from "vitest";

import { aggregateKeyFields, resolveCommandPartitionKey } from "../src/services/partition-key.js";

const RESERVATION = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER_RESERVATION = "aaaaaaaa-0000-4000-8000-000000000002";
const PROPERTY = "bbbbbbbb-0000-4000-8000-000000000001";
const GUEST = "cccccccc-0000-4000-8000-000000000001";
const FOLIO = "dddddddd-0000-4000-8000-000000000001";
const COMMAND_ID = "eeeeeeee-0000-4000-8000-000000000001";

describe("resolveCommandPartitionKey", () => {
  it("gives one reservation's lifecycle a single key", () => {
    // check_in → check_out → cancel on one stay must share a partition, or
    // they can apply in any order.
    const checkIn = { reservation_id: RESERVATION, room_id: "room-1" };
    const checkOut = { reservation_id: RESERVATION };
    const modify = { reservation_id: RESERVATION, property_id: PROPERTY, adults: 2 };
    const cancel = { reservation_id: RESERVATION, property_id: PROPERTY, reason: "GUEST_REQUEST" };

    const keys = [checkIn, checkOut, modify, cancel].map((payload) =>
      resolveCommandPartitionKey(payload, COMMAND_ID),
    );

    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe(RESERVATION);
  });

  it("separates different reservations so they do not serialise behind each other", () => {
    expect(resolveCommandPartitionKey({ reservation_id: RESERVATION }, COMMAND_ID)).not.toBe(
      resolveCommandPartitionKey({ reservation_id: OTHER_RESERVATION }, COMMAND_ID),
    );
  });

  it("never keys by property when a finer aggregate is present", () => {
    // property_id is on ~122 command schemas. Preferring it would put an entire
    // property — every reservation, every folio — on one partition.
    const key = resolveCommandPartitionKey(
      { property_id: PROPERTY, reservation_id: RESERVATION, guest_id: GUEST },
      COMMAND_ID,
    );
    expect(key).toBe(RESERVATION);
  });

  it("falls back to property for property-wide operations", () => {
    // A night audit or date roll has no finer aggregate, and ordering those
    // per property is correct.
    expect(resolveCommandPartitionKey({ property_id: PROPERTY }, COMMAND_ID)).toBe(PROPERTY);
  });

  it("prefers the folio over the guest for billing commands", () => {
    expect(
      resolveCommandPartitionKey({ folio_id: FOLIO, guest_id: GUEST, property_id: PROPERTY }, COMMAND_ID),
    ).toBe(FOLIO);
  });

  it("falls back to the command id when no aggregate is named", () => {
    // Correct behaviour, not a gap: a command with no aggregate has nothing to
    // be ordered against, and the command id spreads it evenly.
    expect(resolveCommandPartitionKey({ note: "no ids here" }, COMMAND_ID)).toBe(COMMAND_ID);
    expect(resolveCommandPartitionKey({}, COMMAND_ID)).toBe(COMMAND_ID);
    expect(resolveCommandPartitionKey(null, COMMAND_ID)).toBe(COMMAND_ID);
  });

  it("ignores blank and non-string values rather than keying on them", () => {
    // An empty key would collapse every such command onto one partition.
    expect(resolveCommandPartitionKey({ reservation_id: "" }, COMMAND_ID)).toBe(COMMAND_ID);
    expect(resolveCommandPartitionKey({ reservation_id: 42 }, COMMAND_ID)).toBe(COMMAND_ID);
    expect(resolveCommandPartitionKey({ reservation_id: null, folio_id: FOLIO }, COMMAND_ID)).toBe(
      FOLIO,
    );
  });

  it("lets a caller-supplied reservation id order the create with the rest of the stay", () => {
    // `reservation.create` accepts an optional reservation_id. Supplying it is
    // what puts the create on the same partition as the check-in that follows.
    const create = {
      reservation_id: RESERVATION,
      property_id: PROPERTY,
      guest_id: GUEST,
      room_type_id: "rt-1",
    };
    expect(resolveCommandPartitionKey(create, COMMAND_ID)).toBe(
      resolveCommandPartitionKey({ reservation_id: RESERVATION }, "other-command-id"),
    );
  });

  it("keeps property_id last in the priority list", () => {
    // Guards the ordering itself: promoting property_id is the one edit that
    // would silently hot-partition every property.
    expect(aggregateKeyFields[aggregateKeyFields.length - 1]).toBe("property_id");
    expect(aggregateKeyFields.indexOf("reservation_id")).toBeLessThan(
      aggregateKeyFields.indexOf("property_id"),
    );
  });
});
