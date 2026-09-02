import {
  type CommandApprovalTicket,
  CommandDispatchError,
  createCommandDispatchRepository,
  createCommandDispatchService,
  resolveCommandPartitionKey,
  type AcceptCommandInput as SharedAcceptCommandInput,
  toApprovalTicket,
} from "@tartware/command-center-shared";
import type { AcceptedCommand, CommandDeferredForApproval } from "@tartware/schemas";

import { commandBatchConfig } from "../config.js";
import { queryWithClient, withTransaction } from "../lib/db.js";
import { gatewayLogger } from "../logger.js";
import type { TenantMembership } from "../services/membership-service.js";

import { createCommandBatcher } from "./command-batcher.js";
import { resolveCommandForTenant } from "./command-registry.js";
import { enqueueOutboxRecord, enqueueOutboxRecordWithClient } from "./outbox.js";
import { raiseCommandApproval } from "./sql/command-approvals.js";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uuidField = (payload: Record<string, unknown>, field: string): string | null => {
  const value = payload[field];
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
};

/**
 * What the approver is being asked to authorise, in the two columns the queue
 * indexes on.
 *
 * `entity_id` reuses the aggregate the command would have been partitioned by,
 * so the folio a void targets is the folio the approval names, and
 * `idx_approval_requests_entity` answers "what else is pending against this
 * folio?" without reading payloads. A command with no aggregate — a date roll,
 * a period reopen carrying no uuid — falls back to the tenant rather than
 * failing to raise: the column is NOT NULL and the request still has to exist.
 */
const approvalSubject = (
  payload: Record<string, unknown>,
  tenantId: string,
): { entityId: string; propertyId: string | null } => {
  const aggregate = resolveCommandPartitionKey(payload, tenantId);
  return {
    entityId: UUID_RE.test(aggregate) ? aggregate : tenantId,
    propertyId: uuidField(payload, "property_id"),
  };
};

/** The reason the requester gave, for the approver to read before deciding. */
const approvalDescription = (payload: Record<string, unknown>): string | null => {
  for (const field of ["reason", "reason_code", "notes", "description"]) {
    const value = payload[field];
    if (typeof value === "string" && value.trim() !== "") {
      return value.slice(0, 500);
    }
  }
  return null;
};

/**
 * Raise (or re-read) the approval standing between a dual-control command and
 * the outbox.
 *
 * Wired as a dependency rather than called from a handler so that the decision
 * to defer stays inside `acceptCommand`, where every command already passes.
 */
const requireCommandApproval = async (input: {
  commandName: string;
  tenantId: string;
  payload: Record<string, unknown>;
  requestId: string;
  initiatedBy: { userId?: string; role?: string } | null | undefined;
  approverRole: string;
}): Promise<CommandApprovalTicket> => {
  const { entityId, propertyId } = approvalSubject(input.payload, input.tenantId);
  const row = await raiseCommandApproval({
    tenantId: input.tenantId,
    commandName: input.commandName,
    requestId: input.requestId,
    payload: input.payload,
    entityId,
    propertyId,
    description: approvalDescription(input.payload),
    // A command with no authenticated initiator is a scheduler or a replay.
    // It still queues: there is no one to be a second pair of eyes for, so the
    // request waits for a human rather than dispatching unattended.
    requestedBy: input.initiatedBy?.userId ?? "SYSTEM",
    requestedByRole: input.initiatedBy?.role ?? null,
    requiredRole: input.approverRole,
  });
  return toApprovalTicket(row);
};

const { acceptCommand: acceptCommandInternal } = createCommandDispatchService<TenantMembership>({
  resolveCommandForTenant,
  enqueueOutboxRecord,
  insertCommandDispatch,
  findCommandDispatchByRequest,
  withDispatchTransaction: commandBatchConfig.enabled
    ? batchedDispatchTransaction
    : singleDispatchTransaction,
  requireCommandApproval,
});

export const acceptCommand = async (
  input: AcceptCommandInput,
): Promise<AcceptedCommand | CommandDeferredForApproval> => {
  const result = await acceptCommandInternal(input);

  if (result.status === "pending_approval") {
    return result;
  }

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
