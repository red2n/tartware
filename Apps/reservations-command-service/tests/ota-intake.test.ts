import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const withTransactionMock = vi.fn();
const createReservationMock = vi.fn();

vi.mock("../src/lib/db.js", () => ({
  query: (...a: unknown[]) => queryMock(...a),
  withTransaction: (...a: unknown[]) => withTransactionMock(...a),
  queryWithClient: vi.fn(),
  pool: {},
}));

// The command is mocked, not the pool beneath it: this suite is about *whether*
// the drain goes through `createReservation` at all, which is the whole point
// of the change. Driving the real command would test the command.
vi.mock("../src/services/reservation-commands/core.js", () => ({
  createReservation: (...a: unknown[]) => createReservationMock(...a),
}));

const { processOtaReservationQueue } = await import(
  "../src/services/reservation-commands/ota-integration.js"
);

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const ROOM_TYPE = "44444444-4444-4444-4444-444444444444";
const GUEST = "55555555-5555-5555-5555-555555555555";
const QUEUE_ID = "66666666-6666-4666-8666-666666666601";

const entry = {
  id: QUEUE_ID,
  ota_configuration_id: "33333333-3333-3333-3333-333333333333",
  ota_code: "BOOKING_COM",
  ota_reservation_id: "BK-12345",
  ota_booking_reference: "REF-9",
  guest_name: "Ada Lovelace",
  guest_email: "ada@example.com",
  guest_phone: null,
  check_in_date: new Date("2026-09-10T00:00:00Z"),
  check_out_date: new Date("2026-09-13T00:00:00Z"),
  room_type: "DBL",
  total_amount: "540.00",
  currency_code: "GBP",
  special_requests: "High floor",
};

/**
 * The drain issues its statements in a fixed order: the pending select, then
 * per entry a claim, a mapping lookup, a guest lookup, and — only on failure —
 * a status update.
 */
const wire = (
  opts: {
    pending?: unknown[];
    claimed?: number;
    mapping?: unknown[];
    guest?: unknown[];
  } = {},
) => {
  queryMock
    .mockResolvedValueOnce({ rows: opts.pending ?? [entry] })
    .mockResolvedValueOnce({ rowCount: opts.claimed ?? 1, rows: [] })
    .mockResolvedValueOnce({ rows: opts.mapping ?? [{ entity_id: ROOM_TYPE }] })
    .mockResolvedValueOnce({ rows: opts.guest ?? [{ id: GUEST }] })
    .mockResolvedValue({ rows: [], rowCount: 1 });
};

beforeEach(() => {
  // reset, not clear: `clearAllMocks` empties the call log but leaves the
  // `mockResolvedValueOnce` queue standing, so an unconsumed row from one test
  // is served to the next and the failures read as code faults.
  vi.resetAllMocks();
  createReservationMock.mockResolvedValue({ eventId: "e1", status: "accepted" });
});

describe("a channel booking goes through the command the front desk uses", () => {
  it("calls createReservation instead of inserting a reservation", async () => {
    wire();

    const result = await processOtaReservationQueue(TENANT, PROPERTY);

    expect(result).toEqual({ processed: 1, failed: 0, duplicates: 0 });
    expect(createReservationMock).toHaveBeenCalledTimes(1);

    const [tenantId, command] = createReservationMock.mock.calls[0];
    expect(tenantId).toBe(TENANT);
    expect(command).toMatchObject({
      property_id: PROPERTY,
      guest_id: GUEST,
      room_type_id: ROOM_TYPE,
      source: "OTA",
      reservation_type: "TRANSIENT",
      total_amount: 540,
      currency: "GBP",
      ota_queue_id: QUEUE_ID,
    });

    // The controls this buys are inside the command, so the assertion here is
    // the negative one: nothing writes a reservation row on this path any more.
    const statements = queryMock.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => /INSERT\s+INTO\s+reservations/i.test(sql))).toBe(
      false,
    );
  });

  it("sets no status of its own, so the command decides where the booking starts", async () => {
    wire();
    await processOtaReservationQueue(TENANT, PROPERTY);
    expect(createReservationMock.mock.calls[0][1]).not.toHaveProperty("status");
  });

  it("leaves the entry PROCESSING, because the reservation does not exist yet", async () => {
    wire();
    await processOtaReservationQueue(TENANT, PROPERTY);

    const statements = queryMock.mock.calls.map(([sql]) => String(sql));
    // The command is accepted, not applied. `linkOtaQueueEntry` in the event
    // handler completes the row once the insert has run — the queue's
    // reservation_id has a foreign key and nothing to point at before then.
    expect(statements.some((sql) => /status\s*=\s*'COMPLETED'/i.test(sql))).toBe(false);
    expect(statements.some((sql) => /status\s*=\s*'PROCESSING'/i.test(sql))).toBe(true);
  });

  it("reads PENDING in the spelling the table and its indexes use", async () => {
    wire();
    await processOtaReservationQueue(TENANT, PROPERTY);
    const select = String(queryMock.mock.calls[0][0]);
    expect(select).toMatch(/status\s*=\s*'PENDING'/);
    expect(select).not.toMatch(/status\s*=\s*'pending'/);
  });
});

describe("claiming", () => {
  it("skips an entry another drain already took", async () => {
    wire({ claimed: 0 });

    const result = await processOtaReservationQueue(TENANT, PROPERTY);

    expect(result).toEqual({ processed: 0, failed: 0, duplicates: 1 });
    expect(createReservationMock).not.toHaveBeenCalled();
  });
});

describe("room-type mapping", () => {
  it("scopes the lookup to the channel that sent the booking", async () => {
    wire();
    await processOtaReservationQueue(TENANT, PROPERTY);

    const [sql, params] = queryMock.mock.calls[2];
    // Without channel_code a Booking.com room code matched an Expedia mapping
    // row, and the booking was created against whichever answered first.
    expect(String(sql)).toMatch(/channel_code\s*=\s*\$4/);
    expect(params).toEqual([TENANT, PROPERTY, "DBL", "BOOKING_COM"]);
  });

  it("fails the entry rather than guessing a room type", async () => {
    wire({ mapping: [] });

    const result = await processOtaReservationQueue(TENANT, PROPERTY);

    expect(result).toEqual({ processed: 0, failed: 1, duplicates: 0 });
    expect(createReservationMock).not.toHaveBeenCalled();
    const failing = queryMock.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => /status\s*=\s*'FAILED'/i.test(sql));
    expect(failing).toBeDefined();
  });
});

describe("a booking the property will not take", () => {
  it("records the refusal on the queue entry instead of forcing it through", async () => {
    wire();
    createReservationMock.mockRejectedValue(
      Object.assign(new Error("Stay is not sellable: MIN_LOS"), {
        code: "RESTRICTION_VIOLATION",
      }),
    );

    const result = await processOtaReservationQueue(TENANT, PROPERTY);

    expect(result).toEqual({ processed: 0, failed: 1, duplicates: 0 });
    const failing = queryMock.mock.calls.find(([sql]) =>
      /status\s*=\s*'FAILED'/i.test(String(sql)),
    );
    expect(failing?.[1]).toContain("Stay is not sellable: MIN_LOS");
  });
});

describe("guest matching", () => {
  it("matches on email only, never on name", async () => {
    wire();
    await processOtaReservationQueue(TENANT, PROPERTY);

    const [sql, params] = queryMock.mock.calls[3];
    expect(String(sql)).toMatch(/LOWER\(email\)\s*=\s*LOWER\(\$2\)/);
    expect(params).toEqual([TENANT, "ada@example.com"]);
  });

  it("creates a profile when the channel sent no email", async () => {
    wire({
      pending: [{ ...entry, guest_email: null }],
      guest: [{ id: "new-guest" }],
    });

    await processOtaReservationQueue(TENANT, PROPERTY);

    // No lookup is attempted at all — a duplicate profile is recoverable, a
    // booking merged onto the wrong guest is not.
    const insert = String(queryMock.mock.calls[3][0]);
    expect(insert).toMatch(/INSERT\s+INTO\s+guests/i);
  });
});
