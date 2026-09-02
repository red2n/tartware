import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const withTransactionMock = vi.fn();
const snapshotMock = vi.fn();
const lockHoldMock = vi.fn();
const sellableMock = vi.fn();
const businessDateMock = vi.fn();

vi.mock("../src/lib/db.js", () => ({
  query: (...a: unknown[]) => queryMock(...a),
  withTransaction: (...a: unknown[]) => withTransactionMock(...a),
  queryWithClient: vi.fn(),
  pool: {},
}));

vi.mock("../src/clients/availability-guard-client.js", () => ({
  lockReservationHold: (...a: unknown[]) => lockHoldMock(...a),
  releaseReservationHold: vi.fn(),
}));

vi.mock("../src/repositories/reservation-repository.js", () => ({
  fetchReservationStaySnapshot: (...a: unknown[]) => snapshotMock(...a),
  fetchReservationCancellationInfo: vi.fn(async () => null),
}));

vi.mock("../src/repositories/restriction-repository.js", () => ({
  resolveBusinessDate: (...a: unknown[]) => businessDateMock(...a),
}));

vi.mock("../src/services/restriction-service.js", () => ({
  assertStaySellable: (...a: unknown[]) => sellableMock(...a),
}));

vi.mock("../src/repositories/reservation-guard-metadata-repository.js", () => ({
  listReservationGuardMetadata: vi.fn(async () => []),
  upsertReservationGuardMetadata: vi.fn(),
}));

vi.mock("../src/repositories/lifecycle-repository.js", () => ({
  recordLifecyclePersisted: vi.fn(),
}));

vi.mock("../src/repositories/rate-fallback-repository.js", () => ({
  insertRateFallbackRecord: vi.fn(),
}));

vi.mock("../src/utils/audit.js", () => ({
  recordAuditLog: vi.fn(),
  recordFlowApproval: vi.fn(),
  hashIdentifier: (v: string) => v,
  redactPayload: (v: unknown) => v,
}));

const { modifyReservation } = await import(
  "../src/services/reservation-commands/core.js"
);

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const RES = "77777777-7777-4777-8777-777777777701";
const TYPE = "44444444-4444-4444-4444-444444444444";
const GUEST = "33333333-3333-4333-8333-333333333333";

const snapshot = (status: string) => ({
  reservationId: RES,
  tenantId: TENANT,
  propertyId: PROPERTY,
  roomTypeId: TYPE,
  checkInDate: new Date("2026-09-01T00:00:00.000Z"),
  checkOutDate: new Date("2026-09-03T00:00:00.000Z"),
  guestId: GUEST,
  status,
});

const command = (over: Record<string, unknown> = {}) =>
  ({ reservation_id: RES, ...over }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  withTransactionMock.mockImplementation(async (fn: (c: unknown) => unknown) =>
    fn({ query: queryMock }),
  );
  queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
  businessDateMock.mockResolvedValue(new Date("2026-08-30T00:00:00.000Z"));
  sellableMock.mockResolvedValue(undefined);
});

/**
 * `reservation.modify` took an optional status and wrote whatever it was given.
 * It is the general editor, so it never held a guard of its own — which made it
 * the way around every guard the dedicated commands do hold. `mass_update`
 * re-enters this same handler, so each of these was reachable 500 at a time.
 */
describe("reservation.modify — status changes it must refuse", () => {
  it("will not un-check-out a departed guest", async () => {
    snapshotMock.mockResolvedValue(snapshot("CHECKED_OUT"));
    await expect(
      modifyReservation(TENANT, command({ status: "CHECKED_IN" })),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("will not reinstate a cancelled booking without the reinstate command", async () => {
    // reservation.reinstate re-takes the availability hold before changing the
    // status, and fails closed if the nights have been sold. Reaching CONFIRMED
    // through modify skipped that entirely.
    snapshotMock.mockResolvedValue(snapshot("CANCELLED"));
    await expect(
      modifyReservation(TENANT, command({ status: "CONFIRMED" })),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    expect(lockHoldMock).not.toHaveBeenCalled();
  });

  it("will not check a guest in — no room, no folio, no key", async () => {
    snapshotMock.mockResolvedValue(snapshot("CONFIRMED"));
    await expect(
      modifyReservation(TENANT, command({ status: "CHECKED_IN" })),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("will not check a guest out, skipping folio settlement", async () => {
    snapshotMock.mockResolvedValue(snapshot("CHECKED_IN"));
    await expect(
      modifyReservation(TENANT, command({ status: "CHECKED_OUT" })),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("will not cancel, skipping the cancellation fee", async () => {
    snapshotMock.mockResolvedValue(snapshot("CONFIRMED"));
    await expect(
      modifyReservation(TENANT, command({ status: "CANCELLED" })),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("refuses a move that is not in the lifecycle at all", async () => {
    snapshotMock.mockResolvedValue(snapshot("EXPIRED"));
    await expect(
      modifyReservation(TENANT, command({ status: "CHECKED_IN" })),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("will not launder the NO_SHOW override, which owes a flow_approvals row", async () => {
    snapshotMock.mockResolvedValue(snapshot("NO_SHOW"));
    await expect(
      modifyReservation(TENANT, command({ status: "CHECKED_IN", force: true })),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
  });

  it("says which of the two reasons it refused for", async () => {
    snapshotMock.mockResolvedValue(snapshot("CONFIRMED"));
    await expect(
      modifyReservation(TENANT, command({ status: "CHECKED_IN" })),
    ).rejects.toThrow(/belongs to a dedicated command/);

    snapshotMock.mockResolvedValue(snapshot("CHECKED_OUT"));
    await expect(
      modifyReservation(TENANT, command({ status: "CANCELLED" })),
    ).rejects.toThrow(/not reachable from/);
  });
});

describe("reservation.modify — status changes it must still allow", () => {
  it("confirms a pending booking, which no command of its own covers", async () => {
    // A deposit or guarantee landing. If this ever gets a real command it leaves
    // RESERVATION_UNCLAIMED_TRANSITIONS on its own and stops being reachable here.
    snapshotMock.mockResolvedValue(snapshot("PENDING"));
    await expect(
      modifyReservation(TENANT, command({ status: "CONFIRMED" })),
    ).resolves.toMatchObject({ status: "accepted" });
  });

  it("gives a waitlisted guest the room that freed up", async () => {
    snapshotMock.mockResolvedValue(snapshot("WAITLISTED"));
    await expect(
      modifyReservation(TENANT, command({ status: "CONFIRMED" })),
    ).resolves.toMatchObject({ status: "accepted" });
  });

  it("accepts a status echoed back unchanged", async () => {
    // Editing the notes on a checked-in guest sends the status it read.
    snapshotMock.mockResolvedValue(snapshot("CHECKED_IN"));
    await expect(
      modifyReservation(TENANT, command({ status: "CHECKED_IN", notes: "late arrival" })),
    ).resolves.toMatchObject({ status: "accepted" });
  });

  it("leaves an edit that carries no status alone", async () => {
    snapshotMock.mockResolvedValue(snapshot("CHECKED_OUT"));
    await expect(
      modifyReservation(TENANT, command({ notes: "guest left a jacket" })),
    ).resolves.toMatchObject({ status: "accepted" });
  });
});
