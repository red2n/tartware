/**
 * Command outbox dispatcher.
 *
 * Accepting a command no longer publishes it — the request commits an outbox
 * row and returns — so this loop is the only thing standing between an accepted
 * command and Kafka. The behaviours asserted here are the ones whose failure
 * would be silent: a batch published but not marked (republished forever), a
 * batch marked but not published (commands lost), or a backlog that only drains
 * at the idle poll rate.
 */

import type { OutboxRecord } from "@tartware/outbox";
import type { TopicMessages } from "kafkajs";
import { describe, expect, it, vi } from "vitest";

import {
  type CommandOutboxDispatcherDeps,
  createCommandOutboxDispatcher,
  groupByTopic,
} from "../src/command-center/dispatcher.js";

const DEFAULT_TOPIC = "commands.primary";

const record = (overrides: Partial<OutboxRecord> = {}): OutboxRecord =>
  ({
    id: "row-1",
    eventId: "event-1",
    tenantId: "tenant-1",
    aggregateId: "command-1",
    aggregateType: "command",
    eventType: "command.reservation.create",
    payload: { metadata: { targetTopic: DEFAULT_TOPIC }, payload: {} },
    headers: { "x-command-name": "reservation.create" },
    priority: 0,
    availableAt: new Date(),
    retryCount: 0,
    partitionKey: "tenant-1",
    ...overrides,
  }) as OutboxRecord;

const settings = {
  batchSize: 2,
  idlePollIntervalMs: 10,
  lockTimeoutMs: 30_000,
  lockSweepEveryCycles: 1_000,
  maxRetries: 5,
  retryBackoffMs: 1_000,
  workerId: "test-worker",
};

const buildDeps = (
  overrides: Partial<CommandOutboxDispatcherDeps> = {},
): CommandOutboxDispatcherDeps => ({
  settings,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  defaultTopic: DEFAULT_TOPIC,
  claimOutboxBatch: vi.fn().mockResolvedValue([]),
  publishRecordBatch: vi.fn().mockResolvedValue(undefined),
  markOutboxDeliveredBatch: vi.fn().mockResolvedValue(0),
  markOutboxFailed: vi.fn().mockResolvedValue("FAILED"),
  releaseExpiredLocks: vi.fn().mockResolvedValue(0),
  updateCommandDispatchStatusBatch: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

/** Let the loop's scheduled cycles run without waiting out real timers. */
const drain = async (): Promise<void> => {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

describe("groupByTopic", () => {
  it("collapses a batch into one send per topic", () => {
    const grouped = groupByTopic(
      [
        record({ id: "a", aggregateId: "cmd-a" }),
        record({
          id: "b",
          aggregateId: "cmd-b",
          payload: { metadata: { targetTopic: "commands.billing" }, payload: {} },
        }),
        record({ id: "c", aggregateId: "cmd-c" }),
      ],
      DEFAULT_TOPIC,
    );

    // Two topics, three messages — not three separate broker requests.
    expect(grouped).toHaveLength(2);
    const primary = grouped.find((entry) => entry.topic === DEFAULT_TOPIC);
    expect(primary?.messages.map((message) => message.key)).toEqual(["cmd-a", "cmd-c"]);
    expect(grouped.find((entry) => entry.topic === "commands.billing")?.messages).toHaveLength(1);
  });

  it("keys messages by command id, not tenant", () => {
    // Keying by tenant would put every command from one tenant on a single
    // partition — the hot-partition failure this refactor must not introduce.
    const [group] = groupByTopic([record({ aggregateId: "cmd-x", partitionKey: "tenant-1" })], DEFAULT_TOPIC);
    expect(group?.messages[0]?.key).toBe("cmd-x");
  });

  it("falls back to the default topic when the envelope names none", () => {
    const [group] = groupByTopic([record({ payload: { payload: {} } })], DEFAULT_TOPIC);
    expect(group?.topic).toBe(DEFAULT_TOPIC);
  });
});

describe("createCommandOutboxDispatcher", () => {
  it("marks delivered only what it published", async () => {
    const claimOutboxBatch = vi
      .fn()
      .mockResolvedValueOnce([record({ id: "row-1", eventId: "event-1" })])
      .mockResolvedValue([]);
    const deps = buildDeps({ claimOutboxBatch });
    const dispatcher = createCommandOutboxDispatcher(deps);

    dispatcher.start();
    await drain();
    await dispatcher.shutdown();

    expect(deps.publishRecordBatch).toHaveBeenCalledTimes(1);
    expect(deps.markOutboxDeliveredBatch).toHaveBeenCalledWith(["row-1"]);
    expect(deps.updateCommandDispatchStatusBatch).toHaveBeenCalledWith(["event-1"], "PUBLISHED");
  });

  it("leaves rows reclaimable when the publish fails", async () => {
    // Marking delivered here would drop the command silently: the row would
    // read as published while nothing ever reached the broker.
    const claimOutboxBatch = vi
      .fn()
      .mockResolvedValueOnce([record({ id: "row-1" })])
      .mockResolvedValue([]);
    const publishRecordBatch = vi.fn().mockRejectedValue(new Error("broker unreachable"));
    const deps = buildDeps({ claimOutboxBatch, publishRecordBatch });
    const dispatcher = createCommandOutboxDispatcher(deps);

    dispatcher.start();
    await drain();
    await dispatcher.shutdown();

    expect(deps.markOutboxDeliveredBatch).not.toHaveBeenCalled();
    expect(deps.updateCommandDispatchStatusBatch).not.toHaveBeenCalled();
    expect(deps.markOutboxFailed).toHaveBeenCalledWith(
      "row-1",
      expect.any(Error),
      settings.retryBackoffMs,
      settings.maxRetries,
    );
  });

  it("keeps draining without waiting when a batch comes back full", async () => {
    // A full batch means a backlog. Waiting out the idle interval between full
    // batches would cap the drain rate at batchSize per poll.
    const full = [record({ id: "row-1" }), record({ id: "row-2" })];
    const claimOutboxBatch = vi
      .fn()
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce(full)
      .mockResolvedValue([]);
    const deps = buildDeps({ claimOutboxBatch });
    const dispatcher = createCommandOutboxDispatcher(deps);

    dispatcher.start();
    await drain();
    await dispatcher.shutdown();

    expect(deps.publishRecordBatch).toHaveBeenCalledTimes(2);
  });

  it("publishes nothing when there is nothing claimed", async () => {
    const deps = buildDeps();
    const dispatcher = createCommandOutboxDispatcher(deps);

    dispatcher.start();
    await drain();
    await dispatcher.shutdown();

    const published = deps.publishRecordBatch as unknown as ReturnType<typeof vi.fn>;
    expect(published).not.toHaveBeenCalled();
  });

  it("stops claiming once shut down", async () => {
    const deps = buildDeps();
    const dispatcher = createCommandOutboxDispatcher(deps);

    dispatcher.start();
    await drain();
    await dispatcher.shutdown();
    const claimedAtShutdown = (deps.claimOutboxBatch as unknown as ReturnType<typeof vi.fn>).mock
      .calls.length;

    await drain();

    expect((deps.claimOutboxBatch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      claimedAtShutdown,
    );
  });
});

describe("dispatcher topic grouping shape", () => {
  it("produces entries kafkajs sendBatch accepts", () => {
    const grouped: TopicMessages[] = groupByTopic([record()], DEFAULT_TOPIC);
    expect(grouped[0]).toMatchObject({
      topic: expect.any(String),
      messages: [{ key: expect.any(String), value: expect.any(String) }],
    });
  });
});
