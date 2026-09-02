import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const withTransactionMock = vi.fn();
const enqueueMock = vi.fn();
const lockHoldMock = vi.fn();
const releaseHoldMock = vi.fn();
const guardMetadataMock = vi.fn();
const auditMock = vi.fn();
const approvalMock = vi.fn();
const snapshotMock = vi.fn();
const roomsMock = vi.fn();
const targetMock = vi.fn();
const repriceMock = vi.fn();

vi.mock("../src/lib/db.js", () => ({
  query: (...a: unknown[]) => queryMock(...a),
  withTransaction: (...a: unknown[]) => withTransactionMock(...a),
  queryWithClient: vi.fn(),
  pool: {},
}));

vi.mock("../src/clients/availability-guard-client.js", () => ({
  lockReservationHold: (...a: unknown[]) => lockHoldMock(...a),
  releaseReservationHold: (...a: unknown[]) => releaseHoldMock(...a),
}));

vi.mock("../src/repositories/reservation-guard-metadata-repository.js", () => ({
  getReservationGuardMetadata: (...a: unknown[]) => guardMetadataMock(...a),
}));

// The repositories are mocked rather than the pool: driving four different
// reads through one sequential `query` mock breaks the moment a statement is
// added, and says nothing about what the handler meant to fetch.
vi.mock("../src/repositories/reservation-repository.js", () => ({
  fetchReservationStaySnapshot: (...a: unknown[]) => snapshotMock(...a),
}));

vi.mock("../src/repositories/room-move-repository.js", () => ({
  fetchReservationRooms: (...a: unknown[]) => roomsMock(...a),
  fetchTargetRoom: (...a: unknown[]) => targetMock(...a),
  applyRoomMove: vi.fn(),
  applyRoomStatuses: vi.fn(),
  repriceRemainingNights: (...a: unknown[]) => repriceMock(...a),
}));

vi.mock("../src/utils/audit.js", () => ({
  recordAuditLog: (...a: unknown[]) => auditMock(...a),
  recordFlowApproval: (...a: unknown[]) => approvalMock(...a),
  hashIdentifier: (v: string) => v,
  redactPayload: (v: unknown) => v,
}));

vi.mock("../src/services/reservation-commands/common.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/services/reservation-commands/common.js")
  >();
  return { ...actual, enqueueReservationUpdate: (...a: unknown[]) => enqueueMock(...a) };
});

const { moveRoom } = await import("../src/services/reservation-commands/room-move.js");

const TENANT = "11111111-1111-1111-1111-111111111111";
const PROPERTY = "22222222-2222-2222-2222-222222222222";
const RES = "77777777-7777-4777-8777-777777777701";
const RR1 = "88888888-8888-4888-8888-888888888801";
const RR2 = "88888888-8888-4888-8888-888888888802";
const FROM_ROOM = "55555555-5555-5555-5555-555555555551";
const TO_ROOM = "55555555-5555-5555-5555-555555555552";
const TYPE = "44444444-4444-4444-4444-444444444444";

const room = (over: Record<string, unknown> = {}) => ({
  reservation_room_id: RR1,
  reservation_id: RES,
  property_id: PROPERTY,
  room_sequence: 1,
  room_type_id: TYPE,
  room_id: FROM_ROOM,
  room_number: "101",
  guest_id: null,
  do_not_move: false,
  status: "CHECKED_IN",
  ...over,
});

const target = (over: Record<string, unknown> = {}) => ({
  id: TO_ROOM,
  room_number: "102",
  room_type_id: TYPE,
  property_id: PROPERTY,
  status: "AVAILABLE",
  housekeeping_status: "CLEAN",
  is_blocked: false,
  is_out_of_order: false,
  ...over,
});

const reasonRow = (over: Record<string, unknown> = {}) => ({
  reason_id: "r1",
  reason_code: "RM_MAINT",
  reason_name: "Maintenance Issue",
  reason_category: "ROOM_MOVE",
  requires_approval: false,
  approval_level: "NONE",
  has_financial_impact: false,
  ...over,
});

const wireQueries = (opts: {
  snapshot?: Record<string, unknown> | null;
  rooms?: Record<string, unknown>[];
  reason?: Record<string, unknown> | null;
  target?: Record<string, unknown> | null;
}) => {
  snapshotMock.mockResolvedValue(
    opts.snapshot === null
      ? null
      : (opts.snapshot ?? {
          reservationId: RES,
          tenantId: TENANT,
          propertyId: PROPERTY,
          roomTypeId: TYPE,
          checkInDate: new Date("2026-09-01"),
          checkOutDate: new Date("2026-09-05"),
          guestId: "g1",
          status: "CHECKED_IN",
        }),
  );
  roomsMock.mockResolvedValue(opts.rooms ?? [room()]);
  targetMock.mockResolvedValue(opts.target === null ? null : (opts.target ?? target()));
  // resolveReasonCode is the only read still going through the pool.
  queryMock.mockResolvedValue({ rows: opts.reason === null ? [] : [opts.reason ?? reasonRow()] });
};

const base = {
  reservation_id: RES,
  to_room_id: TO_ROOM,
  reason_code: "RM_MAINT",
  rate_action: "KEEP_RATE" as const,
  from_room_status_after: "DIRTY" as const,
};

describe("room move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lockHoldMock.mockResolvedValue({ status: "LOCKED", lockId: "new-lock" });
    releaseHoldMock.mockResolvedValue(undefined);
    guardMetadataMock.mockResolvedValue({ lockId: "old-lock", status: "LOCKED" });
    enqueueMock.mockResolvedValue({ eventId: "e1", status: "accepted" });
    repriceMock.mockResolvedValue({ repriced: 2, amount_before: "200", amount_after: "300" });
    withTransactionMock.mockImplementation(async (fn: (c: unknown) => Promise<void>) => fn({}));
  });

  it("moves an in-house guest and reports the new room", async () => {
    wireQueries({});
    const result = await moveRoom(TENANT, base);

    expect(result.eventId).toBe("e1");
    expect(enqueueMock.mock.calls[0][1]).toBe("reservation.room_move");
    expect(enqueueMock.mock.calls[0][2].room_number).toBe("102");
  });

  it("takes the new hold before releasing the old one", async () => {
    wireQueries({});
    await moveRoom(TENANT, base);

    expect(lockHoldMock).toHaveBeenCalled();
    expect(releaseHoldMock).toHaveBeenCalledWith(
      expect.objectContaining({ lockId: "old-lock", reason: "ROOM_MOVE_VACATED" }),
    );
    // Order matters: the guest must never be between rooms.
    expect(lockHoldMock.mock.invocationCallOrder[0]).toBeLessThan(
      releaseHoldMock.mock.invocationCallOrder[0],
    );
  });

  it("fails closed when the guard cannot answer, not just on CONFLICT", async () => {
    wireQueries({});
    lockHoldMock.mockResolvedValue({ status: "ERROR" });

    await expect(moveRoom(TENANT, base)).rejects.toMatchObject({
      code: "AVAILABILITY_GUARD_UNAVAILABLE",
    });
    expect(releaseHoldMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ reason: "ROOM_MOVE_VACATED" }),
    );
  });

  it("refuses a room that has been sold", async () => {
    wireQueries({});
    lockHoldMock.mockResolvedValue({ status: "CONFLICT" });
    await expect(moveRoom(TENANT, base)).rejects.toMatchObject({ code: "ROOM_UNAVAILABLE" });
  });

  it("refuses a guest who is not in-house", async () => {
    wireQueries({ rooms: [room({ status: "CONFIRMED" })] });
    await expect(moveRoom(TENANT, base)).rejects.toMatchObject({ code: "GUEST_NOT_IN_HOUSE" });
  });

  it("refuses to guess which room when the booking holds several", async () => {
    wireQueries({ rooms: [room(), room({ reservation_room_id: RR2, room_sequence: 2 })] });
    await expect(moveRoom(TENANT, base)).rejects.toMatchObject({ code: "AMBIGUOUS_ROOM" });
  });

  it("moves the named room when the booking holds several", async () => {
    wireQueries({
      rooms: [room(), room({ reservation_room_id: RR2, room_sequence: 2, room_number: "201" })],
    });
    await moveRoom(TENANT, { ...base, reservation_room_id: RR2 });
    expect(enqueueMock).toHaveBeenCalled();
  });

  it("respects do_not_move, and records the override when forced", async () => {
    wireQueries({ rooms: [room({ do_not_move: true })] });
    await expect(moveRoom(TENANT, base)).rejects.toMatchObject({ code: "ROOM_IS_DO_NOT_MOVE" });

    wireQueries({ rooms: [room({ do_not_move: true })] });
    await moveRoom(TENANT, { ...base, force: true });
    expect(auditMock.mock.calls[0][0].metadata.do_not_move_overridden).toBe(true);
  });

  it("honours requires_approval on the reason code", async () => {
    wireQueries({ reason: reasonRow({ reason_code: "RM_VIP", requires_approval: true }) });
    await expect(moveRoom(TENANT, { ...base, reason_code: "RM_VIP" })).rejects.toMatchObject({
      code: "REASON_CODE_REQUIRES_APPROVAL",
    });
  });

  it("refuses a reason code from another category", async () => {
    wireQueries({ reason: reasonRow({ reason_category: "CANCELLATION" }) });
    await expect(moveRoom(TENANT, base)).rejects.toMatchObject({
      code: "REASON_CODE_WRONG_CATEGORY",
    });
  });

  it("refuses an unclean room unless forced", async () => {
    wireQueries({ target: target({ housekeeping_status: "DIRTY" }) });
    await expect(moveRoom(TENANT, base)).rejects.toMatchObject({ code: "ROOM_NOT_CLEAN" });
  });

  it("refuses an out-of-order room even when forced", async () => {
    wireQueries({ target: target({ is_out_of_order: true }) });
    await expect(moveRoom(TENANT, { ...base, force: true })).rejects.toMatchObject({
      code: "ROOM_NOT_SELLABLE",
    });
  });

  it("refuses a room at another property", async () => {
    wireQueries({ target: target({ property_id: "99999999-9999-4999-8999-999999999999" }) });
    await expect(moveRoom(TENANT, base)).rejects.toMatchObject({ code: "ROOM_WRONG_PROPERTY" });
  });

  it("refuses a move into the room the guest is already in", async () => {
    wireQueries({});
    await expect(moveRoom(TENANT, { ...base, to_room_id: FROM_ROOM })).rejects.toMatchObject({
      code: "ALREADY_IN_ROOM",
    });
  });

  it("will not REPRICE without an amount it can defend", async () => {
    wireQueries({});
    await expect(moveRoom(TENANT, { ...base, rate_action: "REPRICE" })).rejects.toMatchObject({
      code: "REPRICE_NEEDS_AMOUNT",
    });
  });

  it("reprices only when asked, and records the before and after", async () => {
    wireQueries({});
    await moveRoom(TENANT, { ...base, rate_action: "REPRICE", new_rate_amount: 150 });

    const meta = auditMock.mock.calls[0][0].metadata;
    expect(meta.rate_action).toBe("REPRICE");
    expect(meta.nights_repriced).toBe(2);
    expect(meta.amount_before).toBe("200");
    expect(meta.amount_after).toBe("300");
  });

  it("leaves the charges alone by default", async () => {
    wireQueries({});
    await moveRoom(TENANT, base);
    expect(auditMock.mock.calls[0][0].metadata.nights_repriced).toBe(0);
  });

  it("states that a key must be re-cut, rather than pretending it did it", async () => {
    wireQueries({});
    await moveRoom(TENANT, base);
    const payload = enqueueMock.mock.calls[0][2];
    expect(payload.metadata.room_move.key_reissue_required).toBe(true);
  });
});

describe("forcing is a decision someone has to be entitled to make (A08)", () => {
  // Every refusal in this handler offers `force`, and `force` proceeded "on the
  // authority of the caller" — which, under the single-permission-level model
  // this audit opened with, was every caller. `requires_approval` said "someone
  // senior has to agree" and its escape hatch was a boolean the same person
  // set. `approval_level`, the column naming *whose* agreement, was read
  // nowhere in the repo.

  it("still lets a clerk force past a routine code", async () => {
    // Six of the seven seeded ROOM_MOVE codes are NONE / no approval. Moving a
    // guest out of a noisy room into one housekeeping has not finished is a
    // night manager's ordinary call, and gating it would be theatre.
    wireQueries({ rooms: [room({ do_not_move: true })] });
    await expect(
      moveRoom(TENANT, { ...base, force: true }, { actorId: "u1", actorRole: "STAFF" }),
    ).resolves.toBeDefined();
  });

  it("refuses a clerk forcing a code that demands approval", async () => {
    // RM_VIP is seeded requires_approval TRUE, approval_level MANAGER.
    wireQueries({
      reason: reasonRow({
        reason_code: "RM_VIP",
        requires_approval: true,
        approval_level: "MANAGER",
      }),
    });
    await expect(
      moveRoom(
        TENANT,
        { ...base, reason_code: "RM_VIP", force: true },
        { actorId: "u1", actorRole: "STAFF" },
      ),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("lets a manager force it", async () => {
    wireQueries({
      reason: reasonRow({
        reason_code: "RM_VIP",
        requires_approval: true,
        approval_level: "MANAGER",
      }),
    });
    await expect(
      moveRoom(
        TENANT,
        { ...base, reason_code: "RM_VIP", force: true },
        { actorId: "u1", actorRole: "MANAGER" },
      ),
    ).resolves.toBeDefined();
  });

  it("demands a manager even when the code names no level", async () => {
    // `requires_approval` without an `approval_level` is the case A08 is really
    // about: the flag says a sign-off is needed and says nothing about whose.
    // MANAGER is the lowest membership above the shift floor.
    wireQueries({ reason: reasonRow({ requires_approval: true, approval_level: "NONE" }) });
    await expect(
      moveRoom(TENANT, { ...base, force: true }, { actorId: "u1", actorRole: "STAFF" }),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });
  });

  it("takes the higher of the two demands", async () => {
    // A GM-level code stays a GM-level code when it is forced.
    wireQueries({ reason: reasonRow({ requires_approval: true, approval_level: "GM" }) });
    await expect(
      moveRoom(TENANT, { ...base, force: true }, { actorId: "u1", actorRole: "MANAGER" }),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_INSUFFICIENT" });

    wireQueries({ reason: reasonRow({ requires_approval: true, approval_level: "GM" }) });
    await expect(
      moveRoom(TENANT, { ...base, force: true }, { actorId: "u1", actorRole: "OWNER" }),
    ).resolves.toBeDefined();
  });

  it("refuses a scheduler forcing anything that demands approval", async () => {
    wireQueries({ reason: reasonRow({ requires_approval: true }) });
    await expect(moveRoom(TENANT, { ...base, force: true })).rejects.toMatchObject({
      code: "OVERRIDE_AUTHORITY_INSUFFICIENT",
    });
  });

  it("refuses a level no mapping covers rather than reading it as no demand", async () => {
    wireQueries({ reason: reasonRow({ approval_level: "REGIONAL_VP" }) });
    await expect(
      moveRoom(TENANT, { ...base, force: true }, { actorId: "u1", actorRole: "OWNER" }),
    ).rejects.toMatchObject({ code: "OVERRIDE_AUTHORITY_UNKNOWN" });
  });

  it("leaves an unforced move alone — the floor already governs who may run it", async () => {
    wireQueries({ reason: reasonRow({ approval_level: "GM" }) });
    await expect(
      moveRoom(TENANT, base, { actorId: "u1", actorRole: "STAFF" }),
    ).resolves.toBeDefined();
  });
});
