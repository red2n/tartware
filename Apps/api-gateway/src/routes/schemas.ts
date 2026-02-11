import type { JsonSchema } from "@tartware/openapi";

export const HEALTH_TAG = "Gateway Health";
export const RESERVATION_PROXY_TAG = "Reservation Proxy";
export const CORE_PROXY_TAG = "Core Proxy";
export const COMMAND_CENTER_PROXY_TAG = "Command Center Proxy";
export const SETTINGS_PROXY_TAG = "Settings Proxy";
export const GUESTS_PROXY_TAG = "Guests Proxy";
export const BILLING_PROXY_TAG = "Billing Proxy";
export const HOUSEKEEPING_COMMAND_TAG = "Housekeeping Commands";
export const ROOM_COMMAND_TAG = "Room Commands";
export const BILLING_COMMAND_TAG = "Billing Commands";
export const RECOMMENDATION_PROXY_TAG = "Recommendations";
export const NOTIFICATION_PROXY_TAG = "Notification Proxy";
export const NOTIFICATION_COMMAND_TAG = "Notification Commands";

export const healthResponseSchema = {
  type: "object",
  properties: {
    status: { type: "string" },
    service: { type: "string" },
  },
  required: ["status", "service"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const readinessResponseSchema = {
  type: "object",
  properties: {
    status: { type: "string" },
    service: { type: "string" },
    kafka: {
      type: "object",
      properties: {
        activeCluster: { type: "string" },
        brokers: { type: "array", items: { type: "string" } },
        primaryBrokers: { type: "array", items: { type: "string" } },
        failoverBrokers: { type: "array", items: { type: "string" } },
        topic: { type: "string" },
      },
      required: ["activeCluster", "brokers", "primaryBrokers", "failoverBrokers", "topic"],
      additionalProperties: false,
    },
  },
  required: ["status", "service", "kafka"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const reservationParamsSchema = {
  type: "object",
  properties: {
    tenantId: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier for the proxied reservation call.",
    },
  },
  required: ["tenantId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const tenantTaskParamsSchema = {
  type: "object",
  properties: {
    tenantId: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier.",
    },
    taskId: {
      type: "string",
      format: "uuid",
      description: "Housekeeping task identifier.",
    },
  },
  required: ["tenantId", "taskId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const tenantRoomParamsSchema = {
  type: "object",
  properties: {
    tenantId: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier.",
    },
    roomId: {
      type: "string",
      format: "uuid",
      description: "Room identifier.",
    },
  },
  required: ["tenantId", "roomId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const tenantGuestParamsSchema = {
  type: "object",
  properties: {
    tenantId: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier.",
    },
    guestId: {
      type: "string",
      format: "uuid",
      description: "Guest identifier.",
    },
  },
  required: ["tenantId", "guestId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const tenantReservationParamsSchema = {
  type: "object",
  properties: {
    tenantId: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier.",
    },
    reservationId: {
      type: "string",
      format: "uuid",
      description: "Reservation identifier.",
    },
  },
  required: ["tenantId", "reservationId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const waitlistConvertParamsSchema = {
  type: "object",
  properties: {
    tenantId: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier.",
    },
    waitlistId: {
      type: "string",
      format: "uuid",
      description: "Waitlist entry identifier.",
    },
  },
  required: ["tenantId", "waitlistId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const tenantPaymentParamsSchema = {
  type: "object",
  properties: {
    tenantId: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier.",
    },
    paymentId: {
      type: "string",
      format: "uuid",
      description: "Payment identifier.",
    },
  },
  required: ["tenantId", "paymentId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const tenantInvoiceParamsSchema = {
  type: "object",
  properties: {
    tenantId: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier.",
    },
    invoiceId: {
      type: "string",
      format: "uuid",
      description: "Invoice identifier.",
    },
  },
  required: ["tenantId", "invoiceId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const tenantCommandParamsSchema = {
  type: "object",
  properties: {
    tenantId: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier.",
    },
    commandName: {
      type: "string",
      description: "Command name to dispatch.",
    },
  },
  required: ["tenantId", "commandName"],
  additionalProperties: false,
} as const satisfies JsonSchema;
