import { validateCommandPayload } from "@tartware/schemas";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
  type AcceptedCommand,
  acceptCommand,
  CommandDispatchError,
  markCommandDelivered,
  markCommandFailed,
} from "../command-center/index.js";
import { kafkaConfig } from "../config.js";
import { publishRecord } from "../kafka/producer.js";
import { gatewayLogger } from "../logger.js";
import type { TenantMembership } from "../services/membership-service.js";

const logger = gatewayLogger.child({ module: "command-publisher" });

type SubmitCommandOptions = {
  request: FastifyRequest;
  reply: FastifyReply;
  commandName: string;
  tenantId: string;
  payload: Record<string, unknown>;
  requiredRole?: TenantMembership["role"];
  requiredModules?: string | string[];
};

const ensureTenantAccess = (
  request: FastifyRequest,
  reply: FastifyReply,
  tenantId: string,
  options: {
    minRole?: TenantMembership["role"];
    requiredModules?: string | string[];
  } = {},
): TenantMembership | null => {
  if (!request.auth.isAuthenticated) {
    reply.unauthorized("AUTHENTICATION_REQUIRED");
    return null;
  }

  const membership = request.auth.getMembership(tenantId);
  if (!membership) {
    reply.forbidden("TENANT_ACCESS_DENIED");
    return null;
  }

  if (options.minRole && !request.auth.hasRole(tenantId, options.minRole)) {
    reply.forbidden("TENANT_ROLE_INSUFFICIENT");
    return null;
  }

  const modules = Array.isArray(options.requiredModules)
    ? options.requiredModules
    : options.requiredModules
      ? [options.requiredModules]
      : [];
  if (modules.length > 0) {
    const enabled = new Set(membership.modules);
    const missing = modules.filter((moduleId) => !enabled.has(moduleId));
    if (missing.length > 0) {
      reply.forbidden("TENANT_MODULE_NOT_ENABLED");
      return null;
    }
  }

  return membership;
};

export const submitCommand = async ({
  request,
  reply,
  commandName,
  tenantId,
  payload,
  requiredRole = "MANAGER",
  requiredModules,
}: SubmitCommandOptions): Promise<void> => {
  const membership = ensureTenantAccess(request, reply, tenantId, {
    minRole: requiredRole,
    requiredModules,
  });

  if (!membership) {
    return;
  }

  const validatedPayload = validateCommandPayload(commandName, payload);

  const correlationId = (request.headers["x-correlation-id"] as string | undefined) ?? undefined;
  const requestId = request.id;
  const initiatedBy =
    request.auth.userId && membership
      ? { userId: request.auth.userId, role: membership.role }
      : null;

  let acceptance: AcceptedCommand;
  try {
    acceptance = await acceptCommand({
      commandName,
      tenantId,
      payload: validatedPayload,
      correlationId,
      requestId,
      initiatedBy,
      membership,
    });
  } catch (error) {
    if (error instanceof CommandDispatchError) {
      reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
      return;
    }
    throw error;
  }

  try {
    await publishRecord({
      topic: acceptance.envelope.targetTopic ?? kafkaConfig.commandTopic,
      messages: [
        {
          key: acceptance.commandId,
          value: JSON.stringify({
            metadata: acceptance.envelope.metadata,
            payload: acceptance.envelope.payload,
          }),
          headers: acceptance.envelope.headers,
        },
      ],
    });
    await markCommandDelivered(acceptance.outboxEventId);
  } catch (error) {
    await markCommandFailed(acceptance.outboxEventId, error).catch((failureError) => {
      logger.error(
        {
          err: failureError,
          commandId: acceptance.commandId,
        },
        "failed to mark command failure",
      );
    });
    logger.error(
      {
        err: error,
        commandId: acceptance.commandId,
        commandName: acceptance.commandName,
      },
      "failed to publish command",
    );
    return reply.badGateway("Unable to publish command to Kafka.");
  }

  reply.status(202).send({
    status: acceptance.status,
    commandId: acceptance.commandId,
    commandName: acceptance.commandName,
    tenantId: acceptance.tenantId,
    correlationId: acceptance.correlationId,
    targetService: acceptance.targetService,
    requestedAt: acceptance.requestedAt,
  });
};
