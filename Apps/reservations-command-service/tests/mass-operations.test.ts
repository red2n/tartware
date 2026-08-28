import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const cancelMock = vi.fn();
const checkInMock = vi.fn();
const modifyMock = vi.fn();

vi.mock("../src/lib/db.js", () => ({
  query: (...args: unknown[]) => queryMock(...args),
  withTransaction: vi.fn(),
  queryWithClient: vi.fn(),
  pool: {},
}));

// No database in these tests: the runner's own persistence is covered in
// @tartware/command-consumer-utils. What matters here is that each mass command
// delegates to the single command rather than reimplementing it.
vi.mock("@tartware/command-consumer-utils/batch-repository", () => ({
  createBatchResultStore: () => undefined,
}));

vi.mock("../src/services/reservation-commands/core.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/reservation-commands/core.js")>();
  return {
    ...actual,
    cancelReservation: (...args: unknown[]) => cancelMock(...args),
    modifyReservation: (...args: unknown[]) => modifyMock(...args),
  };
});

vi.mock("../src/services/reservation-commands/checkin-checkout.js", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/services/reservation-commands/checkin-checkout.js")
  >();
  return {
    ...actual,
    checkInReservation: (...args: unknown[]) => checkInMock(...args),
  };
});

const { massCancelReservations, massCheckInReservations, massUpdateReservations } = await import(
  "../src/services/reservation-commands/mass-operations.js"
);

const TENANT = "11111111-1111-1111-1111-111111111111";
const RES_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RES_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const accepted = (eventId: string) => ({ eventId, status: "accepted" as const });

describe("mass operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelMock.mockResolvedValue(accepted("event-1"));
    checkInMock.mockResolvedValue(accepted("event-1"));
    modifyMock.mockResolvedValue(accepted("event-1"));
  });

  describe("mass cancel", () => {
    it("delegates to cancelReservation once per target", async () => {
      const result = await massCancelReservations(TENANT, {
        items: [{ reservation_id: RES_A }, { reservation_id: RES_B }],
        continue_on_error: true,
        dry_run: false,
        reason: "Floor closed for refurbishment",
      });

      expect(cancelMock).toHaveBeenCalledTimes(2);
      expect(result.succeeded).toBe(2);
      expect(result.total).toBe(2);
      expect(cancelMock.mock.calls[0][1]).toMatchObject({
        reservation_id: RES_A,
        reason: "Floor closed for refurbishment",
      });
    });

    it("lets one item override the batch reason", async () => {
      await massCancelReservations(TENANT, {
        items: [
          { reservation_id: RES_A },
          { reservation_id: RES_B, reason: "Guest called to cancel" },
        ],
        continue_on_error: true,
        dry_run: false,
        reason: "Floor closed for refurbishment",
      });

      expect(cancelMock.mock.calls[1][1].reason).toBe("Guest called to cancel");
    });

    it("records the refused item and applies the rest", async () => {
      const { ReservationCommandError } = await import(
        "../src/services/reservation-commands/common.js"
      );
      cancelMock.mockImplementation(async (_tenant: string, command: { reservation_id: string }) => {
        if (command.reservation_id === RES_A) {
          throw new ReservationCommandError(
            "INVALID_STATUS_FOR_CANCEL",
            "Cannot cancel reservation with status CHECKED_OUT",
          );
        }
        return accepted("event-2");
      });

      const result = await massCancelReservations(TENANT, {
        items: [{ reservation_id: RES_A }, { reservation_id: RES_B }],
        continue_on_error: true,
        dry_run: false,
      });

      expect(result.failed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(result.items[0]).toMatchObject({
        outcome: "FAILED",
        error_code: "INVALID_STATUS_FOR_CANCEL",
      });
      expect(result.items[1].outcome).toBe("SUCCEEDED");
    });

    it("does not cancel anything on a dry run", async () => {
      queryMock.mockResolvedValue({ rows: [{ id: RES_A, status: "CONFIRMED" }] });

      const result = await massCancelReservations(TENANT, {
        items: [{ reservation_id: RES_A }],
        continue_on_error: true,
        dry_run: true,
      });

      expect(cancelMock).not.toHaveBeenCalled();
      expect(result.skipped).toBe(1);
      expect(result.items[0]).toMatchObject({ outcome: "SKIPPED", target_id: RES_A });
    });

    it("reports an unknown reservation on a dry run rather than passing it", async () => {
      queryMock.mockResolvedValue({ rows: [] });

      const result = await massCancelReservations(TENANT, {
        items: [{ reservation_id: RES_A }],
        continue_on_error: true,
        dry_run: true,
      });

      expect(result.failed).toBe(1);
      expect(result.items[0].error_code).toBe("RESERVATION_NOT_FOUND");
    });
  });

  describe("mass check-in", () => {
    it("passes the per-item room through and the envelope options to every item", async () => {
      const checkedInAt = new Date("2026-08-28T15:00:00Z");
      const room = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

      await massCheckInReservations(TENANT, {
        items: [{ reservation_id: RES_A, room_id: room }, { reservation_id: RES_B }],
        continue_on_error: true,
        dry_run: false,
        checked_in_at: checkedInAt,
        force: true,
      });

      expect(checkInMock.mock.calls[0][1]).toMatchObject({
        reservation_id: RES_A,
        room_id: room,
        checked_in_at: checkedInAt,
        force: true,
      });
      // No room named — the single handler auto-assigns from the room type.
      expect(checkInMock.mock.calls[1][1].room_id).toBeUndefined();
    });
  });

  describe("mass update", () => {
    it("applies one set of changes to every target through modifyReservation", async () => {
      const checkOut = new Date("2026-09-02T00:00:00Z");

      await massUpdateReservations(TENANT, {
        items: [{ reservation_id: RES_A }, { reservation_id: RES_B }],
        continue_on_error: true,
        dry_run: false,
        changes: { check_out_date: checkOut, notes: "Extended for the conference" },
      });

      expect(modifyMock).toHaveBeenCalledTimes(2);
      for (const call of modifyMock.mock.calls) {
        expect(call[1]).toMatchObject({
          check_out_date: checkOut,
          notes: "Extended for the conference",
        });
      }
      expect(modifyMock.mock.calls[0][1].reservation_id).toBe(RES_A);
      expect(modifyMock.mock.calls[1][1].reservation_id).toBe(RES_B);
    });

    it("cannot have its target overwritten by the shared changes block", async () => {
      // `changes` is spread first so a stray reservation_id in it cannot
      // redirect every item at one booking.
      await massUpdateReservations(TENANT, {
        items: [{ reservation_id: RES_A }],
        continue_on_error: true,
        dry_run: false,
        changes: { reservation_id: RES_B, notes: "x" } as never,
      });

      expect(modifyMock.mock.calls[0][1].reservation_id).toBe(RES_A);
    });
  });
});
