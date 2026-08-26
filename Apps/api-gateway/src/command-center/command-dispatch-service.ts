import {
  CommandDispatchError,
  createCommandDispatchRepository,
  createCommandDispatchService,
  type AcceptCommandInput as SharedAcceptCommandInput,
} from "@tartware/command-center-shared";
import type { AcceptedCommand } from "@tartware/schemas";

import { commandBatchConfig } from "../config.js";
import { queryWithClient, withTransaction } from "../lib/db.js";
import { gatewayLogger } from "../logger.js";
import type { TenantMembership } from "../services/membership-service.js";

import { createCommandBatcher } from "./command-batcher.js";
import { resolveCommandForTenant } from "./command-registry.js";
import { enqueueOutboxRecord, enqueueOutboxRecordWithClient } from "./outbox.js";
import { findCommandDispatchByRequest, insertCommandDispatch } from "./sql/command-dispatches.js";

const batcher = createCommandBatcher({
  maxDelayMs: commandBatchConfig.maxDelayMs,
  maxBatchSize: commandBatchConfig.maxBatchSize,
  withTransaction,
  queryWithClient,
  logger: gatewayLogger.child({ module: "command-batcher" }),
});

/** Flush queued commands on shutdown so none is lost mid-batch. */
export const drainCommandBatcher = (): Promise<void> => batcher.drain();

/**
 * Accumulates this command's two rows and waits for the batch to commit.
 *
 * The dedupe lookup is skipped here and answered by the batch instead: it runs
 * as one statement for the whole batch, and a request that already exists comes
 * back as `insertCommandDispatch: false`, which the dispatch service turns into
 * a replay by re-reading the winning row.
 */
const batchedDispatchTransaction = <T>(
  fn: (writer: {
    enqueueOutboxRecord: (record: Parameters<typeof enqueueOutboxRecord>[0]) => Promise<void>;
    insertCommandDispatch: (input: Parameters<typeof insertCommandDispatch>[0]) => Promise<boolean>;
    findCommandDispatchByRequest: typeof findCommandDispatchByRequest;
  }) => Promise<T>,
): Promise<T> => {
  let staged: Parameters<typeof enqueueOutboxRecord>[0] | null = null;
  return fn({
    enqueueOutboxRecord: async (record) => {
      staged = record;
    },
    insertCommandDispatch: (dispatch) => {
      if (!staged) {
        throw new Error("command batcher: dispatch staged without its outbox record");
      }
      return batcher.submit(staged, dispatch);
    },
    // Answering null sends every command down the insert path; duplicates are
    // caught by the batch's own lookup rather than costing a query each.
    findCommandDispatchByRequest: async () => null,
  });
};

/**
 * One transaction per command: the lookup, the outbox row, and the dispatch row
 * that references it. Correct and atomic, but it pays roughly six database
 * round trips per command, which is the cost group commit exists to remove.
 * Kept as the fallback when batching is switched off.
 */
const singleDispatchTransaction: typeof batchedDispatchTransaction = (fn) =>
  withTransaction((client) => {
    const scoped = createCommandDispatchRepository((textOrConfig, params) =>
      queryWithClient(client, textOrConfig, params),
    );
    return fn({
      enqueueOutboxRecord: (record) => enqueueOutboxRecordWithClient(client, record),
      insertCommandDispatch: scoped.insertCommandDispatch,
      findCommandDispatchByRequest: scoped.findCommandDispatchByRequest,
    });
  });

type AcceptCommandInput = SharedAcceptCommandInput<TenantMembership>;

export type { AcceptedCommand };

const { acceptCommand: acceptCommandInternal } = createCommandDispatchService<TenantMembership>({
  resolveCommandForTenant,
  enqueueOutboxRecord,
  insertCommandDispatch,
  findCommandDispatchByRequest,
  withDispatchTransaction: commandBatchConfig.enabled
    ? batchedDispatchTransaction
    : singleDispatchTransaction,
});

export const acceptCommand = async (input: AcceptCommandInput): Promise<AcceptedCommand> => {
  const result = await acceptCommandInternal(input);

  return {
    status: "accepted",
    commandId: result.commandId,
    commandName: result.commandName,
    tenantId: result.tenantId,
    correlationId: result.correlationId,
    targetService: result.targetService,
    requestedAt: result.issuedAt,
    outboxEventId: result.commandId,
    envelope: {
      metadata: result.eventPayload.metadata,
      payload: result.eventPayload.payload,
      headers: result.headers,
      targetTopic: result.targetTopic,
    },
  };
};

export { CommandDispatchError };
