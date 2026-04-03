import { createHash, randomUUID } from "node:crypto";

import type {
  AcceptCommandInput,
  AcceptedCommand,
  CommandAcceptanceResult,
  CommandDispatchDependencies,
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
 * Create a command dispatch service with provided dependencies.
 */
export const createCommandDispatchService = <Membership>(
  deps: CommandDispatchDependencies<Membership>,
) => {
  const acceptCommand = async (
    input: AcceptCommandInput<Membership>,
  ): Promise<CommandAcceptanceResult> => {
    const payloadHash = createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
    const existing = await deps.findCommandDispatchByRequest(
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

      const routingMetadata = existing.routing_metadata ?? {};
      const featureStatus =
        typeof existing.metadata?.featureStatus === "string"
          ? existing.metadata.featureStatus
          : "enabled";
      const targetService = existing.target_service;
      const targetTopic = existing.target_topic;
      const issuedAt = existing.issued_at;
      const headers: Record<string, string> = {
        "x-command-name": existing.command_name,
        "x-command-tenant-id": existing.tenant_id,
        "x-command-request-id": existing.request_id,
        "x-command-target": targetService,
        "x-command-route-source":
          typeof routingMetadata.routeSource === "string" ? routingMetadata.routeSource : "unknown",
      };
      if (existing.correlation_id) {
        headers["x-correlation-id"] = existing.correlation_id;
      }

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
              id: typeof routingMetadata.routeId === "string" ? routingMetadata.routeId : "unknown",
              tenantId: routingMetadata.routeTenantId ?? null,
              environment: routingMetadata.routeEnvironment ?? "unknown",
              source:
                typeof routingMetadata.routeSource === "string"
                  ? routingMetadata.routeSource
                  : "unknown",
            },
            issuedAt,
            featureStatus,
          },
          payload: input.payload,
        },
        featureStatus,
        route: {
          id: typeof routingMetadata.routeId === "string" ? routingMetadata.routeId : "unknown",
          source:
            typeof routingMetadata.routeSource === "string"
              ? routingMetadata.routeSource
              : "unknown",
          tenantId:
            typeof routingMetadata.routeTenantId === "string"
              ? routingMetadata.routeTenantId
              : null,
        },
      };
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

    await deps.enqueueOutboxRecord({
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

    await deps.insertCommandDispatch({
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

  return {
    acceptCommand,
  };
};
