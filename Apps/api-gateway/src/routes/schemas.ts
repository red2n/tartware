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

// ─── Tags ──────────────────────────────────────────────────────

export const OPERATIONS_TAG = "Operations";
export const BOOKING_CONFIG_TAG = "Booking Configuration";
export const REPORTING_TAG = "Reporting";
export const AVAILABILITY_TAG = "Availability";
export const WEBHOOK_TAG = "Webhooks";
export const GDPR_TAG = "GDPR / Privacy";
export const SELF_SERVICE_PROXY_TAG = "Self-Service Proxy";
export const REVENUE_PROXY_TAG = "Revenue Proxy";
export const CALCULATION_PROXY_TAG = "Calculation Proxy";

// ─── Pagination Envelope ────────────────────────────────────────

/** Canonical pagination metadata object. */
const paginationMetaSchema = {
  type: "object",
  properties: {
    page: { type: "integer", minimum: 1, description: "Current page number." },
    page_size: { type: "integer", minimum: 1, maximum: 200, description: "Items per page." },
    total: { type: "integer", minimum: 0, description: "Total matching records." },
    total_pages: { type: "integer", minimum: 0, description: "Total number of pages." },
  },
  required: ["page", "page_size", "total", "total_pages"],
  additionalProperties: false,
} as const satisfies JsonSchema;

/** Standard querystring parameters for paginated list endpoints. */
export const paginationQuerySchema = {
  type: "object",
  properties: {
    page: { type: "integer", minimum: 1, default: 1, description: "Page number." },
    page_size: {
      type: "integer",
      minimum: 1,
      maximum: 200,
      default: 25,
      description: "Items per page.",
    },
    tenant_id: {
      type: "string",
      format: "uuid",
      description: "Tenant identifier (required for multi-tenant queries).",
    },
  },
  required: ["tenant_id"],
  additionalProperties: true,
} as const satisfies JsonSchema;

/**
 * Build a paginated list response schema wrapping the given item schema.
 *
 * Produces `{ data: T[], pagination: { page, page_size, total, total_pages } }`.
 */
export const paginatedListSchema = (itemSchema: JsonSchema): JsonSchema => ({
  type: "object",
  properties: {
    data: { type: "array", items: itemSchema },
    pagination: paginationMetaSchema,
  },
  required: ["data", "pagination"],
  additionalProperties: false,
});

// ─── Command Accepted Response ──────────────────────────────────

/** Standard 202 response for asynchronous command dispatch. */
export const commandAcceptedSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["accepted"], description: "Always 'accepted'." },
    command_id: { type: "string", format: "uuid", description: "Idempotency key / tracking ID." },
    command_name: { type: "string", description: "Name of the dispatched command." },
    accepted_at: { type: "string", format: "date-time", description: "Timestamp of acceptance." },
  },
  required: ["status", "command_id", "command_name", "accepted_at"],
  additionalProperties: true,
} as const satisfies JsonSchema;

// ─── Webhook Schemas ────────────────────────────────────────────

export const tenantWebhookParamsSchema = {
  type: "object",
  properties: {
    tenantId: { type: "string", format: "uuid", description: "Tenant identifier." },
    webhookId: { type: "string", format: "uuid", description: "Webhook subscription identifier." },
  },
  required: ["tenantId", "webhookId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const webhookSubscriptionSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    tenant_id: { type: "string", format: "uuid" },
    url: { type: "string", format: "uri", description: "Target URL for event delivery." },
    events: { type: "array", items: { type: "string" }, description: "Subscribed event types." },
    secret: { type: "string", description: "HMAC signing secret (write-only)." },
    is_active: { type: "boolean" },
    created_at: { type: "string", format: "date-time" },
    updated_at: { type: "string", format: "date-time" },
  },
  required: ["id", "tenant_id", "url", "events", "is_active"],
  additionalProperties: false,
} as const satisfies JsonSchema;

export const webhookDeliverySchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    webhook_id: { type: "string", format: "uuid" },
    event_type: { type: "string" },
    status: { type: "string", enum: ["pending", "delivered", "failed"] },
    attempts: { type: "integer", minimum: 0 },
    last_attempt_at: { type: "string", format: "date-time" },
    response_status: { type: "integer", nullable: true },
    created_at: { type: "string", format: "date-time" },
  },
  required: ["id", "webhook_id", "event_type", "status", "attempts"],
  additionalProperties: false,
} as const satisfies JsonSchema;
