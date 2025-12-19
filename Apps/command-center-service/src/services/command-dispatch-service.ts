import { createHash, randomUUID } from "node:crypto";

import { enqueueOutboxRecord } from "../outbox/repository.js";
import { insertCommandDispatch } from "../sql/command-dispatches.js";

import { resolveCommandForTenant } from "./command-registry-service.js";
import type { TenantMembership } from "./membership-service.js";

type Initiator = {
  userId: string;
  role: string;
} | null;

type AcceptCommandInput = {
  commandName: string;
  tenantId: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  requestId: string;
  initiatedBy: Initiator;
  membership: TenantMembership;
};

type AcceptedCommand = {
  status: "accepted";
  commandId: string;
  commandName: string;
  tenantId: string;
  correlationId?: string;
  targetService: string;
  requestedAt: string;
};

export class CommandDispatchError extends Error {
  code: string;
  statusCode: number;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const acceptCommand = async (
  input: AcceptCommandInput,
): Promise<AcceptedCommand> => {
  const resolution = resolveCommandForTenant({
    commandName: input.commandName,
    tenantId: input.tenantId,
    membership: input.membership,
  });

  if (resolution.status === "NOT_FOUND") {
    throw new CommandDispatchError(
      404,
      "COMMAND_NOT_FOUND",
      `Command ${input.commandName} is not registered`,
    );
  }
  if (resolution.status === "MODULES_MISSING") {
    throw new CommandDispatchError(
      403,
      "COMMAND_MODULES_NOT_ENABLED",
      `Missing required modules: ${resolution.missingModules.join(", ")}`,
    );
  }
  if (resolution.status === "DISABLED") {
    throw new CommandDispatchError(
      409,
      resolution.reason,
      `Command ${input.commandName} is currently disabled`,
    );
  }

  const { route, feature } = resolution;
  const commandId = randomUUID();
  const targetService = route.service_id;
  const targetTopic = route.topic;
  const issuedAt = new Date().toISOString();

  const headers: Record<string, string> = {
    "x-command-name": input.commandName,
    "x-command-tenant-id": input.tenantId,
    "x-command-request-id": input.requestId,
    "x-command-target": targetService,
    "x-command-route-source": route.source,
  };
  if (input.correlationId) {
    headers["x-correlation-id"] = input.correlationId;
  }

  const eventPayload = {
    metadata: {
      commandId,
      commandName: input.commandName,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      requestId: input.requestId,
      targetService,
      targetTopic,
      route: {
        id: route.id,
        tenantId: route.tenant_id,
        environment: route.environment,
        source: route.source,
      },
      initiatedBy: input.initiatedBy ?? undefined,
      issuedAt,
      featureStatus: feature?.status ?? "enabled",
    },
    payload: input.payload,
  };

  const payloadHash = createHash("sha256")
    .update(JSON.stringify(input.payload))
    .digest("hex");

  await enqueueOutboxRecord({
    eventId: commandId,
    tenantId: input.tenantId,
    aggregateId: commandId,
    aggregateType: "command",
    eventType: `command.${input.commandName}`,
    payload: eventPayload,
    headers,
    correlationId: input.correlationId,
    partitionKey: input.tenantId ?? commandId,
    metadata: {
      initiator: input.initiatedBy,
      requestId: input.requestId,
      route: {
        id: route.id,
        source: route.source,
        tenantId: route.tenant_id,
      },
      featureStatus: feature?.status ?? "enabled",
    },
  });

  await insertCommandDispatch({
    id: commandId,
    commandName: input.commandName,
    tenantId: input.tenantId,
    targetService,
    targetTopic,
    correlationId: input.correlationId,
    requestId: input.requestId,
    payloadHash,
    outboxEventId: commandId,
    routingMetadata: {
      routeId: route.id,
      routeSource: route.source,
      targetTopic,
    },
    initiatedBy: input.initiatedBy ?? null,
    metadata: {
      featureStatus: feature?.status ?? "enabled",
    },
  });

  return {
    status: "accepted",
    commandId,
    commandName: input.commandName,
    tenantId: input.tenantId,
    correlationId: input.correlationId,
    targetService,
    requestedAt: issuedAt,
  };
};
