import type { FastifyReply, FastifyRequest } from "fastify";

import { submitCommand } from "../utils/command-publisher.js";

export const forwardGuestRegisterCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const body = toPlainObject(request.body);
  if (!body) {
    reply.badRequest("GUEST_PAYLOAD_REQUIRED");
    return;
  }

  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return;
  }

  const payload = { ...body };
  delete payload.tenant_id;

  await submitCommand({
    request,
    reply,
    commandName: "guest.register",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

export const forwardGuestMergeCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const body = toPlainObject(request.body);
  if (!body) {
    reply.badRequest("GUEST_MERGE_PAYLOAD_REQUIRED");
    return;
  }
  const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : null;
  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return;
  }
  if (typeof body.primary_guest_id !== "string" || typeof body.duplicate_guest_id !== "string") {
    reply.badRequest("PRIMARY_AND_DUPLICATE_GUEST_IDS_REQUIRED");
    return;
  }
  const payload = { ...body };
  delete payload.tenant_id;

  await submitCommand({
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

export const forwardCommandWithTenant = async ({
  request,
  reply,
  commandName,
}: {
  request: FastifyRequest;
  reply: FastifyReply;
  commandName: string;
}): Promise<void> => {
  const tenantId = getParamValue(request, "tenantId");
  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return;
  }
  const payload = normalizePayloadObject(request.body);
  await submitCommand({
    request,
    reply,
    commandName,
    tenantId,
    payload,
    requiredRole: "MANAGER",
  });
};

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
}): Promise<void> => {
  const tenantId = getParamValue(request, "tenantId");
  const paramValue = getParamValue(request, paramKey);
  if (!tenantId || !paramValue) {
    reply.badRequest("TENANT_AND_RESOURCE_ID_REQUIRED");
    return;
  }
  const payload = {
    ...normalizePayloadObject(request.body),
    [payloadKey]: paramValue,
  };
  await submitCommand({
    request,
    reply,
    commandName,
    tenantId,
    payload,
    requiredRole: "MANAGER",
  });
};

export const forwardGenericCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const commandName = typeof params.commandName === "string" ? params.commandName : null;
  if (!tenantId || !commandName) {
    reply.badRequest("TENANT_AND_COMMAND_REQUIRED");
    return;
  }

  const payload = normalizePayloadObject(request.body);
  await submitCommand({
    request,
    reply,
    commandName,
    tenantId,
    payload,
    requiredRole: "MANAGER",
  });
};

export const forwardReservationCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;

  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return;
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
      reply.status(405).send({
        error: "METHOD_NOT_ALLOWED",
        message: `Method ${method} is not supported for reservation commands`,
      });
      return;
  }

  if (commandName !== "reservation.create") {
    const reservationId = extractReservationId(params);
    if (!reservationId) {
      reply.badRequest("RESERVATION_ID_REQUIRED");
      return;
    }
    const payloadObject = payload as Record<string, unknown>;
    if (!payloadObject.reservation_id) {
      payloadObject.reservation_id = reservationId;
    }
    payload = payloadObject;
  }

  await submitCommand({
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

export const forwardHousekeepingAssignCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const taskId = typeof params.taskId === "string" ? params.taskId : null;
  if (!tenantId || !taskId) {
    reply.badRequest("TENANT_AND_TASK_ID_REQUIRED");
    return;
  }

  const body = normalizePayloadObject(request.body);
  if (typeof body.assigned_to !== "string" || body.assigned_to.length === 0) {
    reply.badRequest("ASSIGNED_TO_REQUIRED");
    return;
  }

  const payload = { ...body, task_id: taskId };
  await submitCommand({
    request,
    reply,
    commandName: "housekeeping.task.assign",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

export const forwardHousekeepingCompleteCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const taskId = typeof params.taskId === "string" ? params.taskId : null;
  if (!tenantId || !taskId) {
    reply.badRequest("TENANT_AND_TASK_ID_REQUIRED");
    return;
  }
  const payload = { ...normalizePayloadObject(request.body), task_id: taskId };
  await submitCommand({
    request,
    reply,
    commandName: "housekeeping.task.complete",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

export const forwardRoomInventoryCommand = async ({
  request,
  reply,
  action,
}: {
  request: FastifyRequest;
  reply: FastifyReply;
  action: "block" | "release";
}): Promise<void> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const roomId = typeof params.roomId === "string" ? params.roomId : null;
  if (!tenantId || !roomId) {
    reply.badRequest("TENANT_AND_ROOM_ID_REQUIRED");
    return;
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
  await submitCommand({
    request,
    reply,
    commandName: action === "release" ? "rooms.inventory.release" : "rooms.inventory.block",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

export const forwardBillingCaptureCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  if (!tenantId) {
    reply.badRequest("TENANT_ID_REQUIRED");
    return;
  }
  const payload = normalizePayloadObject(request.body);
  if (!payload) {
    reply.badRequest("BILLING_CAPTURE_PAYLOAD_REQUIRED");
    return;
  }
  await submitCommand({
    request,
    reply,
    commandName: "billing.payment.capture",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};

export const forwardBillingRefundCommand = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : null;
  const paymentId = typeof params.paymentId === "string" ? params.paymentId : null;
  if (!tenantId || !paymentId) {
    reply.badRequest("TENANT_AND_PAYMENT_ID_REQUIRED");
    return;
  }
  const body = normalizePayloadObject(request.body);
  const payload = { ...body, payment_id: paymentId };
  await submitCommand({
    request,
    reply,
    commandName: "billing.payment.refund",
    tenantId,
    payload,
    requiredRole: "MANAGER",
    requiredModules: "core",
  });
};
