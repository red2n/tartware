/**
 * Command dispatch helpers for the API gateway.
 *
 * The gateway acts as the CQRS command entry point: write requests arrive as
 * REST calls and are translated into Kafka commands that downstream consumers
 * (reservations-command-service, guests-service, housekeeping-service, etc.)
 * process asynchronously.  This keeps the gateway thin — it validates the
 * caller's role, extracts tenant/resource identifiers, and publishes a
 * structured command message via {@link submitCommand} without executing any
 * domain logic itself.
 *
 * Read requests (GET) are proxied directly to the owning service; only
 * state-changing operations (POST/PUT/PATCH/DELETE) go through this command
 * path.  The pattern avoids dual-write problems because the gateway never
 * writes to the database — it only publishes to Kafka.
 */

import type { FastifyReply, FastifyRequest } from "fastify";

import { submitCommand } from "../utils/command-publisher.js";

/** Register a new guest via the `guest.register` command. Requires `MANAGER` role. */
export const forwardGuestRegisterCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const body = toPlainObject(request.body);
  if (!body) {
    reply.badRequest("GUEST_PAYLOAD_REQUIRED");
    return reply;
  }

  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return reply;
  }

  const payload = { ...body };
  delete payload.tenant_id;

  return submitCommand({
    request,
    reply,
    commandName: "guest.register",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

/** Merge two duplicate guest profiles via the `guest.merge` command. Requires `MANAGER` role. */
export const forwardGuestMergeCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const body = toPlainObject(request.body);
  if (!body) {
    reply.badRequest("GUEST_MERGE_PAYLOAD_REQUIRED");
    return reply;
  }
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return reply;
  }
  if (typeof body.primary_guest_id !== "string" || typeof body.duplicate_guest_id !== "string") {
    reply.badRequest("PRIMARY_AND_DUPLICATE_GUEST_IDS_REQUIRED");
    return reply;
  }
  const payload = { ...body };
  delete payload.tenant_id;

  return submitCommand({
    request,
    reply,
    commandName: "guest.merge",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

const getParamValue = (request: FastifyRequest, key: string): string | null => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const value = params[key];
  return typeof value === "string" ? value : null;
};

/**
 * Forward a command using the tenant ID from route params.
 *
 * Extracts `tenantId` from path parameters and publishes the given
 * command to Kafka with the request body as payload.
 */
export const forwardCommandWithTenant = async ({
  request,
  reply,
  commandName,
}: {
  request: FastifyRequest;
  reply: FastifyReply;
  commandName: string;
}): Promise<FastifyReply> => {
  const tenantId = getParamValue(request, "tenantId");
  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return reply;
  }
  const payload = normalizePayloadObject(request.body);
  return submitCommand({
    request,
    reply,
    commandName,
    tenantId,
    payload,
    requiredRole: "MANAGER",
  });
};

/**
 * Forward a command using tenant ID and a named resource ID from route params.
 *
 * Extracts `tenantId` and the specified `paramKey` from path parameters,
 * injects the resource ID into the payload under `payloadKey`, and
 * publishes the command to Kafka.
 */
export const forwardCommandWithParamId = async ({
  request,
  reply,
  commandName,
  paramKey,
  payloadKey,
}: {
  request: FastifyRequest;
  reply: FastifyReply;
  commandName: string;
  paramKey: string;
  payloadKey: string;
}): Promise<FastifyReply> => {
  const tenantId = getParamValue(request, "tenantId");
  const paramValue = getParamValue(request, paramKey);
  if (!tenantId || !paramValue) {
    reply.badRequest("TENANT_AND_RESOURCE_ID_REQUIRED");
    return reply;
  }
  const payload = {
    ...normalizePayloadObject(request.body),
    [payloadKey]: paramValue,
  };
  return submitCommand({
    request,
    reply,
    commandName,
    tenantId,
    payload,
    requiredRole: "MANAGER",
  });
};

/**
 * Dispatch an arbitrary command by name using `tenantId` and `commandName`
 * from route params. Used by the generic command dispatch endpoint.
 */
export const forwardGenericCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const commandName = typeof params.commandName === "string" ? params.commandName : null;
  if (!tenantId || !commandName) {
    reply.badRequest("TENANT_AND_COMMAND_REQUIRED");
    return reply;
  }

  const payload = normalizePayloadObject(request.body);
  return submitCommand({
    request,
    reply,
    commandName,
    tenantId,
    payload,
    requiredRole: "MANAGER",
  });
};

/**
 * Route reservation write requests to the appropriate command based on HTTP method.
 *
 * - `POST` → `reservation.create`
 * - `PUT`/`PATCH` → `reservation.modify`
 * - `DELETE` → `reservation.cancel`
 */
export const forwardReservationCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;

  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return reply;
  }

  const method = request.method.toUpperCase();
  let commandName: string;
  let payload: Record<string, unknown> = normalizePayloadObject(request.body);

  switch (method) {
    case "POST":
      commandName = "reservation.create";
      payload = normalizePayloadObject(request.body);
      break;
    case "PUT":
    case "PATCH":
      commandName = "reservation.modify";
      payload = normalizePayloadObject(request.body);
      break;
    case "DELETE":
      commandName = "reservation.cancel";
      payload = normalizePayloadObject(request.body);
      break;
    default:
      return reply
        .status(405)
        .send({ error: `Method ${method} is not supported for reservation commands` });
  }

  if (commandName !== "reservation.create") {
    const reservationId = extractReservationId(params);
    if (!reservationId) {
      reply.badRequest("RESERVATION_ID_REQUIRED");
      return reply;
    }
    const payloadObject = payload as Record<string, unknown>;
    if (!payloadObject.reservation_id) {
      payloadObject.reservation_id = reservationId;
    }
    payload = payloadObject;
  }

  return submitCommand({
    request,
    reply,
    commandName,
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

const normalizePayloadObject = (body: unknown): Record<string, unknown> => {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return { ...(body as Record<string, unknown>) };
  }
  if (body === undefined || body === null) {
    return {};
  }
  return { value: body };
};

const toPlainObject = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return null;
};

const extractReservationId = (params: Record<string, unknown>): string | null => {
  const direct = params.reservationId;
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }
  const wildcard = params["*"];
  if (typeof wildcard === "string" && wildcard.length > 0) {
    return wildcard.split("/")[0] ?? null;
  }
  return null;
};

/** Assign a housekeeping task to a staff member via the `housekeeping.task.assign` command. */
export const forwardHousekeepingAssignCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const taskId = typeof params.taskId === "string" ? params.taskId : null;
  if (!tenantId || !taskId) {
    reply.badRequest("TENANT_AND_TASK_ID_REQUIRED");
    return reply;
  }

  const body = normalizePayloadObject(request.body);
  if (typeof body.assigned_to !== "string" || body.assigned_to.length === 0) {
    reply.badRequest("ASSIGNED_TO_REQUIRED");
    return reply;
  }

  const payload = { ...body, task_id: taskId };
  return submitCommand({
    request,
    reply,
    commandName: "housekeeping.task.assign",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

/** Mark a housekeeping task as completed via the `housekeeping.task.complete` command. */
export const forwardHousekeepingCompleteCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const taskId = typeof params.taskId === "string" ? params.taskId : null;
  if (!tenantId || !taskId) {
    reply.badRequest("TENANT_AND_TASK_ID_REQUIRED");
    return reply;
  }
  const payload = { ...normalizePayloadObject(request.body), task_id: taskId };
  return submitCommand({
    request,
    reply,
    commandName: "housekeeping.task.complete",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

/**
 * Block or release room inventory via `rooms.inventory.block` or
 * `rooms.inventory.release` commands.
 */
export const forwardRoomInventoryCommand = async ({
  request,
  reply,
  action,
}: {
  request: FastifyRequest;
  reply: FastifyReply;
  action: "block" | "release";
}): Promise<FastifyReply> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const roomId = typeof params.roomId === "string" ? params.roomId : null;
  if (!tenantId || !roomId) {
    reply.badRequest("TENANT_AND_ROOM_ID_REQUIRED");
    return reply;
  }
  const payloadBase = {
    ...normalizePayloadObject(request.body),
    room_id: roomId,
  };
  const payload =
    action === "release"
      ? payloadBase
      : {
          ...payloadBase,
          action,
        };
  return submitCommand({
    request,
    reply,
    commandName: action === "release" ? "rooms.inventory.release" : "rooms.inventory.block",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

/** Capture a payment via the `billing.payment.capture` command. */
export const forwardBillingCaptureCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return reply;
  }
  const body = toPlainObject(request.body);
  if (!body || Object.keys(body).length === 0) {
    reply.badRequest("BILLING_CAPTURE_PAYLOAD_REQUIRED");
    return reply;
  }
  const payload = normalizePayloadObject(request.body);
  return submitCommand({
    request,
    reply,
    commandName: "billing.payment.capture",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

/** Refund a specific payment via the `billing.payment.refund` command. */
export const forwardBillingRefundCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const paymentId = typeof params.paymentId === "string" ? params.paymentId : null;
  if (!tenantId || !paymentId) {
    reply.badRequest("TENANT_AND_PAYMENT_ID_REQUIRED");
    return reply;
  }
  const body = normalizePayloadObject(request.body);
  const payload = { ...body, payment_id: paymentId };
  return submitCommand({
    request,
    reply,
    commandName: "billing.payment.refund",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};
