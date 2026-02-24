import {
  CommandDispatchError,
  createCommandDispatchService,
  type AcceptCommandInput as SharedAcceptCommandInput,
} from "@tartware/command-center-shared";
import type { TenantMembership } from "@tartware/tenant-auth/membership";
import { enqueueOutboxRecord } from "../outbox/repository.js";
import { findCommandDispatchByRequest, insertCommandDispatch } from "../sql/command-dispatches.js";
import { resolveCommandForTenant } from "./command-registry-service.js";
import { throttleCommand } from "./command-throttle-service.js";

type AcceptCommandInput = SharedAcceptCommandInput<TenantMembership>;

type AcceptedCommand = {
  status: "accepted";
  commandId: string;
  commandName: string;
  tenantId: string;
  correlationId?: string;
  targetService: string;
  requestedAt: string;
};

const { acceptCommand: acceptCommandInternal } = createCommandDispatchService<TenantMembership>({
  resolveCommandForTenant,
  enqueueOutboxRecord,
  insertCommandDispatch,
  findCommandDispatchByRequest,
  throttleCommand,
});

/**
 * Accept a command request and enqueue it for dispatch.
 */
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
  };
};

export { CommandDispatchError };
