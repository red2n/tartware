import type { ReservationReversalPostingRow } from "@tartware/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const withTransactionMock = vi.fn();
const enqueueMock = vi.fn();
const lockHoldMock = vi.fn();
const recordFlowApprovalMock = vi.fn();
const recordAuditLogMock = vi.fn();

vi.mock("../src/lib/db.js", () => ({
  query: (...args: unknown[]) => queryMock(...args),
  withTransaction: (...args: unknown[]) => withTransactionMock(...args),
  queryWithClient: vi.fn(),
  pool: {},
}));

vi.mock("../src/clients/availability-guard-client.js", () => ({
  lockReservationHold: (...args: unknown[]) => lockHoldMock(...args),
  releaseReservationHold: vi.fn(),
}));

vi.mock("../src/utils/audit.js", () => ({
  recordFlowApproval: (...args: unknown[]) => recordFlowApprovalMock(...args),
  recordAuditLog: (...args: unknown[]) => recordAuditLogMock(...args),
  hashIdentifier: (v: string) => v,
  redactPayload: (v: unknown) => v,
}));

vi.mock("../src/services/reservation-commands/common.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/services/reservation-commands/common.js")
  >();
  return {
    ...actual,
    enqueueReservationUpdate: (...args: unknown[]) => enqueueMock(...args),
  };
});

const {
  OWNED_CHARGE_CODES,
  partitionPostings,
  reinstateReservation,
  reverseCheckIn,
  reverseCheckOut,
} = await import("../src/services/reservation-commands/reversals.js");

const TENANT = "11111111-1111-1111-1111-111111111111";
const RESERVATION = "22222222-2222-4222-8222-222222222222";
const PROPERTY = "33333333-3333-4333-8333-333333333333";

const posting = (
  code: string,
  amount: number,
): ReservationReversalPostingRow => ({
  posting_id: `44444444-4444-4444-8444-${code.slice(0, 12).padEnd(12, "0")}`,
  charge_code: code,
  charge_description: code,
  total_amount: String(amount),
  tax_amount: null,
  posting_date: "2026-09-10",
  is_voided: false,
});

// ---------------------------------------------------------------------------

describe("partitionPostings — what a reversal owns", () => {
  /**
   * The safety property of the whole workstream: a reversal puts back what its
   * operation posted and touches nothing else.
   */
  it("claims only the charge codes its operation posts", () => {
    const { owned, foreign } = partitionPostings(
      [
        posting("EARLY_CHECKIN", 25),
        posting("ROOM", 210),
        posting("FNB", 86.4),
        posting("LATE_CHECKOUT", 30),
      ],
      "CHECK_IN",
    );

    expect(owned.map((p) => p.charge_code)).toEqual(["EARLY_CHECKIN"]);
    expect(foreign.map((p) => p.charge_code)).toEqual(["ROOM", "FNB", "LATE_CHECKOUT"]);
  });

  it("does not let a check-out reversal claim the check-in fee", () => {
    const { owned } = partitionPostings(
      [posting("EARLY_CHECKIN", 25), posting("LATE_CHECKOUT", 30)],
      "CHECK_OUT",
    );
    expect(owned.map((p) => p.charge_code)).toEqual(["LATE_CHECKOUT"]);
  });

  it("matches charge codes case-insensitively", () => {
    const { owned } = partitionPostings([posting("early_checkin", 25)], "CHECK_IN");
    expect(owned).toHaveLength(1);
  });

  it("treats an unknown charge code as foreign, never as owned", () => {
    // The default has to be "not mine". A new automatic posting nobody added to
    // OWNED_CHARGE_CODES must strand the reversal loudly, not get voided.
    const { owned, foreign } = partitionPostings([posting("RESORT_FEE", 15)], "CHECK_IN");
    expect(owned).toEqual([]);
    expect(foreign).toHaveLength(1);
  });

  it("keeps the three operations' owned codes disjoint", () => {
    const all = Object.values(OWNED_CHARGE_CODES).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

// ---------------------------------------------------------------------------

/** Queue `query()` results in the order the handler asks for them. */
const queueQueries = (...results: Array<{ rows: unknown[] }>) => {
  queryMock.mockReset();
  for (const result of results) queryMock.mockResolvedValueOnce(result);
  queryMock.mockResolvedValue({ rows: [] });
};

const reservationRow = (over: Record<string, unknown> = {}) => ({
  id: RESERVATION,
  tenant_id: TENANT,
  property_id: PROPERTY,
  status: "CHECKED_IN",
  guest_id: null,
  room_type_id: "55555555-5555-4555-8555-555555555555",
  room_number: "412",
  check_in_date: "2026-09-10",
  check_out_date: "2026-09-13",
  actual_check_in: "2026-09-10T14:00:00Z",
  actual_check_out: null,
  cancellation_date: null,
  cancellation_fee: null,
  total_amount: "630",
  currency: "GBP",
  ...over,
});

const reasonRow = {
  reason_id: "66666666-6666-4666-8666-666666666666",
  reason_code: "KEYED_IN_ERROR",
  reason_name: "Keyed in error",
  reason_category: "REVERSAL",
  requires_approval: false,
  has_financial_impact: false,
};

const cancelledFixture = () =>
  reservationRow({
    status: "CANCELLED",
    cancellation_date: "2026-09-01",
    cancellation_fee: "50",
  });

const folioRow = (over: Record<string, unknown> = {}) => ({
  folio_id: "77777777-7777-4777-8777-777777777777",
  folio_number: "F-1001",
  folio_status: "OPEN",
  balance: "235",
  total_charges: "235",
  total_payments: "0",
  currency_code: "GBP",
  settled_at: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  enqueueMock.mockResolvedValue({ reservationId: RESERVATION, status: "QUEUED" });
  withTransactionMock.mockImplementation(async (fn: (c: unknown) => Promise<unknown>) =>
    fn({ query: vi.fn().mockResolvedValue({ rows: [] }) }),
  );
  lockHoldMock.mockResolvedValue({ status: "LOCKED", lockId: "lock-1" });
});

/**
 * Deliberately minimal: no `room_status_after`, no `restore_status`. The
 * handlers parse their own input, so the schema defaults have to survive a
 * caller that omits them.
 */
const command = (over: Record<string, unknown> = {}) => ({
  reservation_id: RESERVATION,
  reason_code: "KEYED_IN_ERROR",
  ...over,
});

describe("reverseCheckIn", () => {
  it("refuses a reservation that is not checked in", async () => {
    queueQueries({ rows: [reservationRow({ status: "CONFIRMED" })] });
    await expect(reverseCheckIn(TENANT, command())).rejects.toMatchObject({
      code: "INVALID_STATUS_FOR_REVERSE_CHECKIN",
    });
  });

  it("refuses an unknown reason code rather than accepting free text", async () => {
    queueQueries({ rows: [reservationRow()] }, { rows: [] });
    await expect(
      reverseCheckIn(TENANT, command({ reason_code: "BECAUSE" })),
    ).rejects.toMatchObject({ code: "REASON_CODE_NOT_FOUND" });
  });

  it("refuses a reason code belonging to another category", async () => {
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [{ ...reasonRow, reason_category: "ROOM_MOVE" }] },
    );
    await expect(reverseCheckIn(TENANT, command())).rejects.toMatchObject({
      code: "REASON_CODE_WRONG_CATEGORY",
    });
  });

  it("refuses when the folio carries charges the check-in did not post", async () => {
    // The bar tab case. Undoing a keystroke must not void a guest's dinner.
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [posting("EARLY_CHECKIN", 25), posting("FNB", 86.4)] },
    );
    await expect(reverseCheckIn(TENANT, command())).rejects.toMatchObject({
      code: "FOLIO_HAS_OTHER_CHARGES",
    });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("names the offending charges in the refusal", async () => {
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [posting("FNB", 86.4)] },
    );
    await expect(reverseCheckIn(TENANT, command())).rejects.toThrow(/FNB 86\.4/);
  });

  it("proceeds over foreign charges when forced, leaving them in place", async () => {
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [posting("EARLY_CHECKIN", 25), posting("FNB", 86.4)] },
    );
    await reverseCheckIn(TENANT, command({ force: true }));
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it("clears the check-in stamp with null, not undefined", async () => {
    // undefined means "leave it alone" to the update handler, which would leave
    // the reservation reading as checked in at a time it never was.
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [posting("EARLY_CHECKIN", 25)] },
    );
    await reverseCheckIn(TENANT, command());

    const payload = enqueueMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(payload.status).toBe("CONFIRMED");
    expect(payload.actual_check_in).toBeNull();
    expect(payload.room_number).toBeNull();
  });

  it("records the balance either side of the reversal in the audit trail", async () => {
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow({ balance: "235" })] },
      { rows: [posting("EARLY_CHECKIN", 25)] },
    );
    await reverseCheckIn(TENANT, command());

    const audit = recordAuditLogMock.mock.calls[0]?.[0] as {
      metadata: Record<string, unknown>;
    };
    expect(audit.metadata.balance_before).toBe(235);
    expect(audit.metadata.balance_after).toBe(210);
    expect(audit.metadata.amount_reversed).toBe(25);
    expect(audit.metadata.voided_postings).toBe(1);
  });

  it("reverses to exactly the prior balance when check-in posted a fee", async () => {
    // The done-when for WS-04, as arithmetic: 210 before, +25 fee at check-in,
    // 235 now, 210 after the reversal.
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow({ balance: "235" })] },
      { rows: [posting("EARLY_CHECKIN", 25)] },
    );
    await reverseCheckIn(TENANT, command());
    const audit = recordAuditLogMock.mock.calls[0]?.[0] as {
      metadata: Record<string, number>;
    };
    expect(audit.metadata.balance_after).toBe(210);
  });

  it("is a no-op on the folio when check-in posted nothing", async () => {
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow({ balance: "210" })] },
      { rows: [] },
    );
    await reverseCheckIn(TENANT, command());
    const audit = recordAuditLogMock.mock.calls[0]?.[0] as {
      metadata: Record<string, number>;
    };
    expect(audit.metadata.balance_before).toBe(210);
    expect(audit.metadata.balance_after).toBe(210);
    expect(audit.metadata.voided_postings).toBe(0);
  });

  it("works on a reservation with no folio at all", async () => {
    queueQueries({ rows: [reservationRow()] }, { rows: [reasonRow] }, { rows: [] });
    await reverseCheckIn(TENANT, command());
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });
});

describe("schema defaults survive an unparsed caller", () => {
  it("defaults a reversed check-in's room to DIRTY", async () => {
    // A room someone may have entered must not go straight back on sale.
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [] },
    );
    await reverseCheckIn(TENANT, command());

    const roomUpdate = queryMock.mock.calls.find((call) =>
      String(call[0]).includes("UPDATE public.rooms"),
    );
    expect(roomUpdate?.[1]?.[0]).toBe("DIRTY");
  });

  it("defaults a reinstatement to CONFIRMED rather than leaving the status unset", async () => {
    queueQueries(
      { rows: [cancelledFixture()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [] },
    );
    await reinstateReservation(TENANT, command());
    const payload = enqueueMock.mock.calls[0]?.[2] as Record<string, unknown>;
    // undefined here would mean "leave the status alone" — a reversal that
    // reports success and changes nothing.
    expect(payload.status).toBe("CONFIRMED");
  });
});

describe("reverseCheckOut", () => {
  const checkedOut = () =>
    reservationRow({ status: "CHECKED_OUT", actual_check_out: "2026-09-13T10:00:00Z" });

  it("refuses a reservation that is not checked out", async () => {
    queueQueries({ rows: [reservationRow()] });
    await expect(
      reverseCheckOut(TENANT, command()),
    ).rejects.toMatchObject({ code: "INVALID_STATUS_FOR_REVERSE_CHECKOUT" });
  });

  it("refuses when a forced check-out moved the balance to the city ledger", async () => {
    queueQueries(
      { rows: [checkedOut()] },
      { rows: [reasonRow] },
      { rows: [{ ar_id: "ar-1", ar_number: "CL-0001" }] },
    );
    await expect(
      reverseCheckOut(TENANT, command()),
    ).rejects.toMatchObject({ code: "CHECKOUT_BALANCE_IN_AR" });
  });

  it("proceeds past an AR entry when forced", async () => {
    queueQueries(
      { rows: [checkedOut()] },
      { rows: [reasonRow] },
      { rows: [{ ar_id: "ar-1", ar_number: "CL-0001" }] },
      { rows: [folioRow({ folio_status: "SETTLED" })] },
      { rows: [] },
    );
    await reverseCheckOut(TENANT, command({ force: true }));
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it("reopens a settled folio and clears the check-out stamp", async () => {
    queueQueries(
      { rows: [checkedOut()] },
      { rows: [reasonRow] },
      { rows: [] },
      { rows: [folioRow({ folio_status: "SETTLED", settled_at: "2026-09-13T10:00:00Z" })] },
      { rows: [posting("LATE_CHECKOUT", 30)] },
    );
    await reverseCheckOut(TENANT, command());

    const payload = enqueueMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(payload.status).toBe("CHECKED_IN");
    expect(payload.actual_check_out).toBeNull();

    const audit = recordAuditLogMock.mock.calls[0]?.[0] as {
      metadata: Record<string, unknown>;
    };
    expect(audit.metadata.folio_reopened).toBe(true);
  });
});

describe("reinstateReservation", () => {
  const cancelled = cancelledFixture;

  it("refuses a reservation that is not cancelled", async () => {
    queueQueries({ rows: [reservationRow()] });
    await expect(reinstateReservation(TENANT, command())).rejects.toMatchObject({
      code: "INVALID_STATUS_FOR_REINSTATE",
    });
  });

  it("refuses when the released nights have been sold", async () => {
    queueQueries({ rows: [cancelled()] }, { rows: [reasonRow] });
    lockHoldMock.mockResolvedValue({ status: "CONFLICT" });
    await expect(reinstateReservation(TENANT, command())).rejects.toMatchObject({
      code: "REINSTATE_NO_INVENTORY",
    });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("takes the hold before changing anything", async () => {
    // Order matters: a reinstatement that flips the status first and then fails
    // to get inventory leaves an overbooking behind.
    queueQueries({ rows: [cancelled()] }, { rows: [reasonRow] });
    lockHoldMock.mockResolvedValue({ status: "CONFLICT" });
    await expect(reinstateReservation(TENANT, command())).rejects.toThrow();
    expect(lockHoldMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("refuses when the guard cannot answer, rather than assuming yes", async () => {
    queueQueries({ rows: [cancelled()] }, { rows: [reasonRow] });
    lockHoldMock.mockResolvedValue({ status: "ERROR", message: "deadline exceeded" });
    await expect(reinstateReservation(TENANT, command())).rejects.toMatchObject({
      code: "REINSTATE_GUARD_UNAVAILABLE",
    });
  });

  it("lets an operator force past an unavailable guard", async () => {
    queueQueries(
      { rows: [cancelled()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [] },
    );
    lockHoldMock.mockResolvedValue({ status: "ERROR" });
    await reinstateReservation(TENANT, command({ force: true }));
    expect(enqueueMock).toHaveBeenCalledTimes(1);
  });

  it("restores to CONFIRMED and voids the cancellation penalty", async () => {
    queueQueries(
      { rows: [cancelled()] },
      { rows: [reasonRow] },
      { rows: [folioRow({ balance: "50" })] },
      { rows: [posting("CANCELLATION_FEE", 50)] },
    );
    await reinstateReservation(TENANT, command());

    const payload = enqueueMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(payload.status).toBe("CONFIRMED");

    const audit = recordAuditLogMock.mock.calls[0]?.[0] as {
      metadata: Record<string, number>;
    };
    expect(audit.metadata.balance_after).toBe(0);
  });

  it("honours an explicit restore_status", async () => {
    queueQueries(
      { rows: [cancelled()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [] },
    );
    await reinstateReservation(TENANT, command({ restore_status: "PENDING" }));
    const payload = enqueueMock.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(payload.status).toBe("PENDING");
  });
});

describe("every reversal is recorded twice, on purpose", () => {
  it("writes both a flow approval and an audit log", async () => {
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [posting("EARLY_CHECKIN", 25)] },
    );
    await reverseCheckIn(TENANT, command());

    expect(recordFlowApprovalMock).toHaveBeenCalledTimes(1);
    expect(recordAuditLogMock).toHaveBeenCalledTimes(1);

    const approval = recordFlowApprovalMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(approval).toMatchObject({
      flowName: "reservation_reversal",
      gateName: "reverse_check_in",
      reasonCode: "KEYED_IN_ERROR",
      roleAtApproval: "REVERSAL",
    });
  });

  it("marks a forced reversal as an override", async () => {
    queueQueries(
      { rows: [reservationRow()] },
      { rows: [reasonRow] },
      { rows: [folioRow()] },
      { rows: [posting("FNB", 10)] },
    );
    await reverseCheckIn(TENANT, command({ force: true }));
    const approval = recordFlowApprovalMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(approval.roleAtApproval).toBe("FORCE_OVERRIDE");
  });
});
