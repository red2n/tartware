import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const withTransactionMock = vi.fn();
const enqueueMock = vi.fn();
const openSyncMock = vi.fn();
const closeSyncMock = vi.fn();
const failSyncMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("../src/lib/db.js", () => ({
  query: (...a: unknown[]) => queryMock(...a),
  withTransaction: (...a: unknown[]) => withTransactionMock(...a),
  queryWithClient: vi.fn(),
  pool: {},
}));

// The sync repository is mocked rather than the pool: what this suite is about
// is the *order* the three writes happen in relative to the push, which a
// sequential `query` mock would express as positional accidents.
vi.mock("../src/repositories/channel-sync-repository.js", () => ({
  openChannelSync: (...a: unknown[]) => openSyncMock(...a),
  closeChannelSync: (...a: unknown[]) => closeSyncMock(...a),
  failChannelSync: (...a: unknown[]) => failSyncMock(...a),
}));

vi.mock("../src/outbox/repository.js", () => ({
  enqueueOutboxRecordWithClient: (...a: unknown[]) => enqueueMock(...a),
}));

const { otaSyncRequest } = await import(
  "../src/services/reservation-commands/ota-integration.js"
);

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const CONFIG = "33333333-3333-3333-3333-333333333333";
const ROOM_TYPE = "44444444-4444-4444-4444-444444444444";

const configRow = (transport: string) => ({
  id: CONFIG,
  ota_name: "Booking.com",
  ota_code: "BOOKING_COM",
  transport,
  hotel_id: "HOTEL-9",
  api_endpoint: "https://channel.example/api",
  api_key: "key",
  api_secret: "secret",
});

const availabilityRow = {
  room_type_id: ROOM_TYPE,
  room_type_code: "DBL",
  stay_date: new Date("2026-09-04T00:00:00Z"),
  total_rooms: 10,
  sold: "3",
  available: "7",
};

/** Config read, then availability read — the order the handler issues them. */
const wireReads = (transport: string, availability = [availabilityRow]) => {
  queryMock
    .mockResolvedValueOnce({ rows: [configRow(transport)] })
    .mockResolvedValueOnce({ rows: availability });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  withTransactionMock.mockImplementation(async (fn: (c: unknown) => unknown) =>
    fn({ query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) }),
  );
});

describe("a channel with no transport", () => {
  it("refuses the push instead of recording a completed one", async () => {
    wireReads("NONE");

    await expect(
      otaSyncRequest(TENANT, { property_id: PROPERTY, ota_code: "BOOKING_COM" } as never),
    ).rejects.toMatchObject({ code: "CHANNEL_TRANSPORT_NOT_CONFIGURED" });

    // The whole finding, as an assertion: no sync row at all, rather than one
    // saying `completed` with `failed_items = 0` for a channel that was never
    // contacted.
    expect(openSyncMock).not.toHaveBeenCalled();
    expect(closeSyncMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("refuses without retrying, because waiting does not configure a channel", async () => {
    wireReads("NONE");
    await expect(
      otaSyncRequest(TENANT, { property_id: PROPERTY, ota_code: "BOOKING_COM" } as never),
    ).rejects.toMatchObject({ retryable: false });
  });
});

describe("a channel with no room-type mapping", () => {
  it("refuses rather than pushing a partial ARI update", async () => {
    wireReads("SIMULATED", []);

    await expect(
      otaSyncRequest(TENANT, { property_id: PROPERTY, ota_code: "BOOKING_COM" } as never),
    ).rejects.toMatchObject({ code: "CHANNEL_MAPPING_MISSING" });
    expect(openSyncMock).not.toHaveBeenCalled();
  });
});

describe("the simulated transport", () => {
  it("records the push as simulated and contacts nothing", async () => {
    wireReads("SIMULATED");

    await otaSyncRequest(TENANT, {
      property_id: PROPERTY,
      ota_code: "BOOKING_COM",
    } as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(openSyncMock).toHaveBeenCalledTimes(1);
    expect(closeSyncMock).toHaveBeenCalledTimes(1);

    const [, , result] = closeSyncMock.mock.calls[0];
    expect(result).toMatchObject({
      outcome: "COMPLETED",
      accepted_items: 1,
      rejected_items: 0,
      simulated: true,
    });
  });

  it("opens the sync row before the push and closes it after", async () => {
    wireReads("SIMULATED");
    const order: string[] = [];
    openSyncMock.mockImplementation(() => {
      order.push("open");
    });
    closeSyncMock.mockImplementation(() => {
      order.push("close");
    });

    await otaSyncRequest(TENANT, {
      property_id: PROPERTY,
      ota_code: "BOOKING_COM",
    } as never);

    // A push that dies mid-flight has to leave a row saying so. Writing the
    // outcome in one statement — which is what every handler did — cannot.
    expect(order).toEqual(["open", "close"]);
  });
});

describe("the HTTP transport", () => {
  it("sends the mapped room-type code and the channel's own hotel id", async () => {
    wireReads("HTTP_JSON");
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ accepted: 1, rejected: 0, reference: "BK-77" }),
    });

    await otaSyncRequest(TENANT, {
      property_id: PROPERTY,
      ota_code: "BOOKING_COM",
    } as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://channel.example/api/inventory");
    // Every outbound call carries a deadline — a channel manager that hangs
    // must not hold a Kafka partition open.
    expect(init.signal).toBeDefined();
    const body = JSON.parse(init.body as string);
    expect(body.hotel_id).toBe("HOTEL-9");
    expect(body.inventory[0]).toMatchObject({
      room_type_code: "DBL",
      date: "2026-09-04",
      available: 7,
      sold: 3,
    });
  });

  it("records a channel rejection as failed, and does not announce the sync", async () => {
    wireReads("HTTP_JSON");
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable",
      text: async () => "unknown rate plan",
    });

    await expect(
      otaSyncRequest(TENANT, { property_id: PROPERTY, ota_code: "BOOKING_COM" } as never),
    ).rejects.toMatchObject({ code: "CHANNEL_PUSH_FAILED", retryable: false });

    const [, , result] = closeSyncMock.mock.calls[0];
    expect(result).toMatchObject({
      outcome: "FAILED",
      http_status: 422,
      error_code: "HTTP_422",
      simulated: false,
    });
    // The event says what is live on the channel. Nothing is.
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("records a partial push, and reports what the channel accepted", async () => {
    wireReads("HTTP_JSON", [availabilityRow, { ...availabilityRow, room_type_code: "TWN" }]);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ accepted: 1, rejected: 1 }),
    });

    await otaSyncRequest(TENANT, {
      property_id: PROPERTY,
      ota_code: "BOOKING_COM",
    } as never);

    const [, , result] = closeSyncMock.mock.calls[0];
    expect(result).toMatchObject({ outcome: "PARTIAL", accepted_items: 1, rejected_items: 1 });

    // A partial push still happened, so the event is emitted — carrying what
    // the channel took, not what was computed.
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    const record = enqueueMock.mock.calls[0][1];
    expect(record.payload.payload).toMatchObject({
      records_synced: 1,
      records_rejected: 1,
    });
  });

  it("marks the sync failed and rethrows when the channel cannot be reached", async () => {
    wireReads("HTTP_JSON");
    const timeout = Object.assign(new Error("The operation was aborted"), {
      name: "TimeoutError",
    });
    fetchMock.mockRejectedValue(timeout);

    await expect(
      otaSyncRequest(TENANT, { property_id: PROPERTY, ota_code: "BOOKING_COM" } as never),
    ).rejects.toThrow("The operation was aborted");

    // Rethrown unchanged, so it stays retryable by default — a timeout is the
    // one failure a second attempt can fix.
    expect(failSyncMock).toHaveBeenCalledTimes(1);
    expect(closeSyncMock).not.toHaveBeenCalled();
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
