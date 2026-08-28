import type { BatchCommandResult } from "@tartware/schemas/events/commands/batch";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BatchAlreadyRunningError,
  type BatchResultStore,
  type BatchRunContext,
  runBatchCommand,
} from "../src/batch-runner.js";
import { CommandError } from "../src/command-utils.js";

const context: BatchRunContext = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  commandName: "reservation.mass_cancel",
  batchId: "22222222-2222-2222-2222-222222222222",
};

type Item = { id: string };

const items = (...ids: string[]): Item[] => ids.map((id) => ({ id }));

const envelope = (overrides: Partial<Parameters<typeof runBatchCommand<Item>>[1]> = {}) => ({
  items: items("a", "b", "c"),
  continue_on_error: true,
  dry_run: false,
  ...overrides,
});

const createStore = (
  openResult: Awaited<ReturnType<BatchResultStore["openBatch"]>> = { claimed: true },
) => {
  const recorded: { items: unknown[]; closed: BatchCommandResult[]; failed: unknown[] } = {
    items: [],
    closed: [],
    failed: [],
  };
  const store: BatchResultStore = {
    openBatch: vi.fn(async () => openResult),
    recordItems: vi.fn(async (_ctx, batchItems) => {
      recorded.items.push(...batchItems);
    }),
    closeBatch: vi.fn(async (_ctx, result) => {
      recorded.closed.push(result);
    }),
    failBatch: vi.fn(async (_ctx, error) => {
      recorded.failed.push(error);
    }),
  };
  return { store, recorded };
};

describe("runBatchCommand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accounts for every requested item exactly once", async () => {
    const result = await runBatchCommand<Item>(
      context,
      envelope(),
      { applyItem: async (item) => ({ targetId: item.id }) },
    );

    expect(result.total).toBe(3);
    expect(result.succeeded + result.failed + result.skipped).toBe(result.total);
    expect(result.items.map((entry) => entry.index)).toEqual([0, 1, 2]);
  });

  it("keeps going past a failed item and records its code", async () => {
    const result = await runBatchCommand<Item>(context, envelope(), {
      applyItem: async (item) => {
        if (item.id === "b") {
          throw new CommandError("INVALID_STATUS_FOR_CANCEL", "already checked out");
        }
        return { targetId: item.id };
      },
    });

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.items[1]).toMatchObject({
      index: 1,
      outcome: "FAILED",
      error_code: "INVALID_STATUS_FOR_CANCEL",
    });
    // The items after the failure still ran.
    expect(result.items[2].outcome).toBe("SUCCEEDED");
  });

  it("stops at the first failure when continue_on_error is false, skipping the rest", async () => {
    const applyItem = vi.fn(async (item: Item) => {
      if (item.id === "a") throw new CommandError("NOPE", "refused");
      return { targetId: item.id };
    });

    const result = await runBatchCommand<Item>(
      context,
      envelope({ continue_on_error: false }),
      { applyItem },
    );

    expect(applyItem).toHaveBeenCalledTimes(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.items[1]).toMatchObject({
      outcome: "SKIPPED",
      error_code: "BATCH_STOPPED_EARLIER",
    });
  });

  it("records which target failed, not just the index", async () => {
    const result = await runBatchCommand<Item>(context, envelope(), {
      targetIdOf: (item) => item.id,
      applyItem: async (item) => {
        if (item.id === "b") throw new CommandError("NOPE", "refused");
        return { targetId: item.id };
      },
    });

    expect(result.items[1]).toMatchObject({ outcome: "FAILED", target_id: "b" });
  });

  it("labels a non-CommandError throw rather than losing it", async () => {
    const result = await runBatchCommand<Item>(context, envelope({ items: items("a") }), {
      applyItem: async () => {
        throw new TypeError("cannot read property of undefined");
      },
    });

    expect(result.items[0]).toMatchObject({
      outcome: "FAILED",
      error_code: "BATCH_ITEM_ERROR",
      error_message: "cannot read property of undefined",
    });
  });

  describe("dry run", () => {
    it("never calls applyItem — the writing function is not reachable", async () => {
      const applyItem = vi.fn(async (item: Item) => ({ targetId: item.id }));
      const validateItem = vi.fn(async (item: Item) => ({ targetId: item.id }));

      const result = await runBatchCommand<Item>(context, envelope({ dry_run: true }), {
        applyItem,
        validateItem,
      });

      expect(applyItem).not.toHaveBeenCalled();
      expect(validateItem).toHaveBeenCalledTimes(3);
      expect(result.skipped).toBe(3);
      expect(result.succeeded).toBe(0);
      expect(result.items.every((entry) => entry.outcome === "SKIPPED")).toBe(true);
    });

    it("reports a validator's refusal as a failure, not a silent pass", async () => {
      const result = await runBatchCommand<Item>(
        context,
        envelope({ dry_run: true, items: items("a") }),
        {
          applyItem: async () => ({}),
          validateItem: async () => {
            throw new CommandError("RESERVATION_NOT_FOUND", "no such reservation");
          },
        },
      );

      expect(result.failed).toBe(1);
      expect(result.items[0].error_code).toBe("RESERVATION_NOT_FOUND");
    });

    it("says so when the command has no validator, instead of claiming a clean run", async () => {
      const result = await runBatchCommand<Item>(
        context,
        envelope({ dry_run: true, items: items("a") }),
        { applyItem: async () => ({}) },
      );

      expect(result.items[0]).toMatchObject({
        outcome: "SKIPPED",
        error_code: "DRY_RUN_NOT_SUPPORTED",
      });
    });
  });

  describe("replay", () => {
    it("returns the stored result instead of running a finished batch again", async () => {
      const stored: BatchCommandResult = {
        batch_id: context.batchId,
        command_name: context.commandName,
        total: 3,
        succeeded: 3,
        failed: 0,
        skipped: 0,
        dry_run: false,
        started_at: new Date("2026-08-28T09:00:00Z"),
        completed_at: new Date("2026-08-28T09:00:01Z"),
        items: [],
      };
      const applyItem = vi.fn(async () => ({}));
      const { store } = createStore({ claimed: false, existing: stored });

      const result = await runBatchCommand<Item>(context, envelope(), { applyItem }, store);

      expect(applyItem).not.toHaveBeenCalled();
      expect(result).toBe(stored);
    });

    it("refuses a batch id that is still running", async () => {
      const { store } = createStore({ claimed: false, existing: null });

      await expect(
        runBatchCommand<Item>(context, envelope(), { applyItem: async () => ({}) }, store),
      ).rejects.toBeInstanceOf(BatchAlreadyRunningError);
    });
  });

  describe("store", () => {
    it("persists every item and closes the batch", async () => {
      const { store, recorded } = createStore();

      await runBatchCommand<Item>(
        context,
        envelope(),
        { applyItem: async (item) => ({ targetId: item.id, eventId: `event-${item.id}` }) },
        store,
      );

      expect(recorded.items).toHaveLength(3);
      expect(recorded.closed).toHaveLength(1);
      expect(recorded.closed[0].succeeded).toBe(3);
    });

    it("marks the run failed rather than leaving it RUNNING when the result write dies", async () => {
      // Every item applied; the pool then died under the write of the results.
      // Left RUNNING, this batch_id would be refused as already running on
      // every replay, so the row has to be closed even on this path.
      const { store, recorded } = createStore();
      const boom = new Error("connection terminated");
      (store.recordItems as ReturnType<typeof vi.fn>).mockRejectedValueOnce(boom);

      await expect(
        runBatchCommand<Item>(context, envelope(), { applyItem: async () => ({}) }, store),
      ).rejects.toBe(boom);

      expect(recorded.failed).toHaveLength(1);
      expect(store.closeBatch).not.toHaveBeenCalled();
    });
  });
});
