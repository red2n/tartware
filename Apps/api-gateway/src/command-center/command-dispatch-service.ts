import {
  CommandDispatchError,
  createCommandDispatchRepository,
  createCommandDispatchService,
  type AcceptCommandInput as SharedAcceptCommandInput,
} from "@tartware/command-center-shared";
import type { AcceptedCommand } from "@tartware/schemas";

import { queryWithClient, withTransaction } from "../lib/db.js";
import type { TenantMembership } from "../services/membership-service.js";

import { resolveCommandForTenant } from "./command-registry.js";
import { enqueueOutboxRecord, enqueueOutboxRecordWithClient } from "./outbox.js";
import { findCommandDispatchByRequest, insertCommandDispatch } from "./sql/command-dispatches.js";

type AcceptCommandInput = SharedAcceptCommandInput<TenantMembership>;

export type { AcceptedCommand };

const { acceptCommand: acceptCommandInternal } = createCommandDispatchService<TenantMembership>({
  resolveCommandForTenant,
  enqueueOutboxRecord,
  insertCommandDispatch,
  findCommandDispatchByRequest,
  /**
   * Accepting a command is one transaction: the lookup, the outbox row, and the
   * dispatch row that references it. Beyond the atomicity, this is the hot
   * path's main cost — an active RLS tenant scope makes every standalone
   * statement pay its own connect / BEGIN / `set_config` / COMMIT, so three of
   * them cost fifteen round trips and five pool checkouts where one transaction
   * costs six and one.
   */
  withDispatchTransaction: (fn) =>
    withTransaction((client) => {
      const scoped = createCommandDispatchRepository((textOrConfig, params) =>
        queryWithClient(client, textOrConfig, params),
      );
      return fn({
        enqueueOutboxRecord: (record) => enqueueOutboxRecordWithClient(client, record),
        insertCommandDispatch: scoped.insertCommandDispatch,
        findCommandDispatchByRequest: scoped.findCommandDispatchByRequest,
      });
    }),
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
