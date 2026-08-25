import { createHash, randomUUID } from "node:crypto";

import type {
  AcceptCommandInput,
  AcceptedCommand,
  CommandAcceptanceResult,
  CommandDispatchDependencies,
  CommandDispatchLookup,
  CommandDispatchWriter,
  CommandFeatureInfo,
  CommandOutboxRecord,
  CommandResolution,
  CommandRouteInfo,
  Initiator,
} from "@tartware/schemas";

export type {
  Initiator,
  CommandRouteInfo,
  CommandFeatureInfo,
  CommandResolution,
  AcceptCommandInput,
  CommandOutboxRecord,
  CommandDispatchDependencies,
  CommandDispatchWriter,
  CommandAcceptanceResult,
  AcceptedCommand,
};

/**
 * Error type for command dispatch failures.
 */
export class CommandDispatchError extends Error {
  code: string;
  statusCode: number;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Thrown when the dispatch insert loses a race to an identical request.
 *
 * It has to escape the transaction rather than be handled inside it: the outbox
 * row is written first to satisfy the `outbox_event_id` foreign key, so by the
 * time the conflict is known there is an outbox row in the transaction that
 * would publish a second copy of a command already accepted. Unwinding is what
 * discards it — the replay is then answered from the committed row outside.
 */
class DuplicateDispatchError extends Error {
  constructor() {
    super("command dispatch already exists for this request");
    this.name = "DuplicateDispatchError";
  }
}

const readString = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

/**
 * Rebuild the acceptance result from the dispatch row recorded the first time
 * this request id was seen, so a retry observes the original command id and
 * routing rather than a second command.
 */
const buildReplayResult = (
  existing: CommandDispatchLookup,
  payload: Record<string, unknown>,
): CommandAcceptanceResult => {
  const routingMetadata = existing.routing_metadata ?? {};
  const featureStatus = readString(existing.metadata?.featureStatus, "enabled");
  const targetService = existing.target_service;
  const targetTopic = existing.target_topic;
  const issuedAt = existing.issued_at;
  const routeSource = readString(routingMetadata.routeSource, "unknown");

  const headers: Record<string, string> = {
    "x-command-name": existing.command_name,
    "x-command-tenant-id": existing.tenant_id,
    "x-command-request-id": existing.request_id,
    "x-command-target": targetService,
    "x-command-route-source": routeSource,
  };
  if (existing.correlation_id) {
    headers["x-correlation-id"] = existing.correlation_id;
  }

  const route = {
    id: readString(routingMetadata.routeId, "unknown"),
    source: routeSource,
    tenantId:
      typeof routingMetadata.routeTenantId === "string" ? routingMetadata.routeTenantId : null,
  };

  return {
    status: "accepted",
    commandId: existing.id,
    commandName: existing.command_name,
    tenantId: existing.tenant_id,
    correlationId: existing.correlation_id ?? undefined,
    targetService,
    targetTopic,
    issuedAt,
    headers,
    eventPayload: {
      metadata: {
        commandId: existing.id,
        commandName: existing.command_name,
        tenantId: existing.tenant_id,
        correlationId: existing.correlation_id ?? undefined,
        requestId: existing.request_id,
        targetService,
        targetTopic,
        route: {
          id: route.id,
          tenantId: routingMetadata.routeTenantId ?? null,
          environment: routingMetadata.routeEnvironment ?? "unknown",
          source: routeSource,
        },
        issuedAt,
        featureStatus,
      },
      payload,
    },
    featureStatus,
    route,
  };
};

/**
 * Create a command dispatch service with provided dependencies.
 */
export const createCommandDispatchService = <Membership>(
  deps: CommandDispatchDependencies<Membership>,
) => {
  /**
   * Used when no `withDispatchTransaction` is supplied: the same operations
   * against whatever ambient connection each dependency holds. Without a
   * transaction there is no conflict to report — a duplicate reaches the unique
   * index instead — so the insert always claims to have won.
   */
  const ambientWriter: CommandDispatchWriter = {
    enqueueOutboxRecord: deps.enqueueOutboxRecord,
    insertCommandDispatch: deps.insertCommandDispatch,
    findCommandDispatchByRequest: deps.findCommandDispatchByRequest,
  };

  const acceptWithin = async (
    writer: CommandDispatchWriter,
    input: AcceptCommandInput<Membership>,
    payloadHash: string,
  ): Promise<CommandAcceptanceResult> => {
    const existing = await writer.findCommandDispatchByRequest(
      input.tenantId,
      input.commandName,
      input.requestId,
    );
    if (existing) {
      // Idempotent replays return the original dispatch without reapplying throttles.
      if (existing.payload_hash !== payloadHash) {
        throw new CommandDispatchError(
          409,
          "COMMAND_IDEMPOTENCY_CONFLICT",
          "Request id already used with a different payload.",
        );
      }

      return buildReplayResult(existing, input.payload);
    }

    const resolution = deps.resolveCommandForTenant({
      commandName: input.commandName,
      tenantId: input.tenantId,
      membership: input.membership,
      correlationId: input.correlationId,
      requestId: input.requestId,
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
    if (deps.throttleCommand) {
      const allowed = await deps.throttleCommand({
        commandName: input.commandName,
        tenantId: input.tenantId,
        requestId: input.requestId,
        feature: feature ?? null,
      });
      if (!allowed) {
        throw new CommandDispatchError(429, "COMMAND_THROTTLED", "Command rate limit exceeded.");
      }
    }
    const commandId = randomUUID();
    const targetService = route.service_id;
    const targetTopic = route.topic;
    const issuedAt = new Date().toISOString();
    const featureStatus = feature?.status ?? "enabled";

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
        featureStatus,
      },
      payload: input.payload,
    };

    await writer.enqueueOutboxRecord({
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
        featureStatus,
      },
    });

    const inserted = await writer.insertCommandDispatch({
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
        featureStatus,
      },
    });

    if (!inserted) {
      throw new DuplicateDispatchError();
    }

    return {
      status: "accepted",
      commandId,
      commandName: input.commandName,
      tenantId: input.tenantId,
      correlationId: input.correlationId,
      targetService,
      targetTopic,
      issuedAt,
      headers,
      eventPayload,
      featureStatus,
      route: {
        id: route.id,
        source: route.source,
        tenantId: route.tenant_id,
      },
    };
  };

  const acceptCommand = async (
    input: AcceptCommandInput<Membership>,
  ): Promise<CommandAcceptanceResult> => {
    const payloadHash = createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
    const runInTransaction = deps.withDispatchTransaction;

    if (!runInTransaction) {
      return acceptWithin(ambientWriter, input, payloadHash);
    }

    try {
      return await runInTransaction((writer) => acceptWithin(writer, input, payloadHash));
    } catch (error) {
      if (!(error instanceof DuplicateDispatchError)) {
        throw error;
      }
    }

    // The transaction unwound, so the outbox row it staged is gone. The winning
    // request has committed by now, so its dispatch row is the answer.
    const winner = await deps.findCommandDispatchByRequest(
      input.tenantId,
      input.commandName,
      input.requestId,
    );
    if (!winner) {
      throw new CommandDispatchError(
        409,
        "COMMAND_DISPATCH_CONFLICT",
        "Command dispatch conflicted but no existing dispatch could be read.",
      );
    }
    if (winner.payload_hash !== payloadHash) {
      throw new CommandDispatchError(
        409,
        "COMMAND_IDEMPOTENCY_CONFLICT",
        "Request id already used with a different payload.",
      );
    }
    return buildReplayResult(winner, input.payload);
  };

  return {
    acceptCommand,
  };
};
