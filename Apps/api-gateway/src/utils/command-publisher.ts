import { STATUS_CODES } from "node:http";

import { IdempotencyKeySchema, validateCommandPayload } from "@tartware/schemas";
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
import { commandsAcceptedTotal } from "../lib/metrics.js";
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
}: SubmitCommandOptions): Promise<FastifyReply> => {
  const membership = ensureTenantAccess(request, reply, tenantId, {
    minRole: requiredRole,
    requiredModules,
  });

  if (!membership) {
    return reply;
  }

  let validatedPayload: Record<string, unknown>;
  try {
    validatedPayload = validateCommandPayload(commandName, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payload validation failed";
    logger.warn({ commandName, err: error }, "command payload validation failed");
    return reply.status(400).header("content-type", "application/problem+json").send({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: message,
      instance: request.url,
      code: "COMMAND_PAYLOAD_INVALID",
    });
  }

  const correlationId = (request.headers["x-correlation-id"] as string | undefined) ?? undefined;
  // Canonical header is `Idempotency-Key` (IETF draft / Stripe / Square).
  // `X-Idempotency-Key` is accepted for backward compatibility with legacy clients.
  const rawIdempotencyKey =
    request.headers["idempotency-key"] ?? request.headers["x-idempotency-key"];
  const idempotencyKeyHeader = Array.isArray(rawIdempotencyKey)
    ? rawIdempotencyKey[0]
    : rawIdempotencyKey;

  if (!idempotencyKeyHeader || idempotencyKeyHeader.trim() === "") {
    return reply.status(400).header("content-type", "application/problem+json").send({
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail:
        "Missing required 'Idempotency-Key' header. All command writes must include a client-supplied idempotency key (8-128 URL-safe characters; UUID recommended).",
      instance: request.url,
      code: "IDEMPOTENCY_KEY_REQUIRED",
    });
  }

  const idempotencyParse = IdempotencyKeySchema.safeParse(idempotencyKeyHeader);
  if (!idempotencyParse.success) {
    return reply
      .status(400)
      .header("content-type", "application/problem+json")
      .send({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        detail: idempotencyParse.error.issues[0]?.message ?? "Invalid Idempotency-Key header.",
        instance: request.url,
        code: "IDEMPOTENCY_KEY_INVALID",
      });
  }

  const idempotencyKey = idempotencyParse.data;
  const requestId = idempotencyKey;
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
      return reply
        .status(error.statusCode)
        .header("content-type", "application/problem+json")
        .send({
          type: "about:blank",
          title: STATUS_CODES[error.statusCode] ?? "Error",
          status: error.statusCode,
          detail: error.message,
          instance: request.url,
          code: error.code,
        });
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
    commandsAcceptedTotal.inc({ command_name: commandName });
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

  if (idempotencyKey) {
    reply.header("Idempotency-Key", idempotencyKey);
  }

  return reply.status(202).send({
    status: acceptance.status,
    command_id: acceptance.commandId,
    command_name: acceptance.commandName,
    accepted_at: acceptance.requestedAt,
    tenant_id: acceptance.tenantId,
    correlation_id: acceptance.correlationId,
    target_service: acceptance.targetService,
  });
};
