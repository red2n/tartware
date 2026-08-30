import { STATUS_CODES } from "node:http";

import { IdempotencyKeySchema, validateCommandPayload } from "@tartware/schemas";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
  type AcceptedCommand,
  acceptCommand,
  CommandDispatchError,
} from "../command-center/index.js";
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
  requiredModules?: string | string[];
};

const ensureTenantAccess = (
  request: FastifyRequest,
  reply: FastifyReply,
  tenantId: string,
  options: {
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
  requiredModules,
}: SubmitCommandOptions): Promise<FastifyReply> => {
  // No `minRole` here on purpose. Every caller used to pass `"MANAGER"`, which
  // is the finding: one level for all 202 commands. The per-command floor is
  // declared in `COMMAND_MIN_ROLE` and applied inside `acceptCommand`, where the
  // command name and the membership are both in hand — checking a second,
  // coarser ladder first would only mask it. Membership and module entitlement
  // still gate here, because neither depends on which command was asked for.
  const membership = ensureTenantAccess(request, reply, tenantId, {
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

  // The command is durable in the outbox now, inside the same transaction that
  // recorded its dispatch row. Publishing is the outbox dispatcher's job, so the
  // request no longer pays a broker round trip plus two status UPDATEs, and a
  // broker outage no longer turns an accepted command into a 502 the caller has
  // to retry — the row is already committed and delivers when Kafka returns.
  commandsAcceptedTotal.inc({ command_name: commandName });

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
