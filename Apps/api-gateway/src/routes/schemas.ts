/**
 * Shared JSON schemas and OpenAPI tag constants for gateway routes.
 *
 * Centralizes:
 * - **Tag constants** for Swagger grouping across all route files.
 * - **Path parameter schemas** (tenant + resource ID combinations).
 * - **Pagination schemas** (query params and paginated list envelope).
 * - **Command accepted response** (standard 202 shape).
 * - **Webhook schemas** (subscription and delivery log).
 *
 * Route files import from here to avoid duplicating schema definitions.
 *
 * @module schemas
 */
import type { JsonSchema } from "@tartware/openapi";

// ─── OpenAPI Tag Constants ──────────────────────────────────────

/** @internal Gateway health check endpoints. */
export const HEALTH_TAG = "Gateway Health";
/** @internal Reservation read-proxy and command endpoints. */
export const RESERVATION_PROXY_TAG = "Reservation Proxy";
/** @internal Core service proxy endpoints (tenants, properties, auth, users). */
export const CORE_PROXY_TAG = "Core Proxy";
/** @internal Command center admin and dispatch endpoints. */
export const COMMAND_CENTER_PROXY_TAG = "Command Center Proxy";
/** @internal Settings and package proxy endpoints. */
export const SETTINGS_PROXY_TAG = "Settings Proxy";
/** @internal Guest management endpoints. */
export const GUESTS_PROXY_TAG = "Guests Proxy";
/** @internal Billing read-proxy endpoints. */
export const BILLING_PROXY_TAG = "Billing Proxy";
/** @internal Housekeeping command endpoints. */
export const HOUSEKEEPING_COMMAND_TAG = "Housekeeping Commands";
/** @internal Room inventory command endpoints. */
export const ROOM_COMMAND_TAG = "Room Commands";
/** @internal Billing command endpoints. */
export const BILLING_COMMAND_TAG = "Billing Commands";
/** @internal Recommendation engine endpoints. */
export const RECOMMENDATION_PROXY_TAG = "Recommendations";
/** @internal Notification read-proxy endpoints. */
export const NOTIFICATION_PROXY_TAG = "Notification Proxy";
/** @internal Notification command endpoints. */
export const NOTIFICATION_COMMAND_TAG = "Notification Commands";

/** JSON Schema for the `/health` response body. */
export const healthResponseSchema = {
  type: "object",
  properties: {
    status: { type: "string" },
    service: { type: "string" },
  },
  required: ["status", "service"],
  additionalProperties: false,
} as const satisfies JsonSchema;

/** Path params schema for tenant-scoped routes (`/:tenantId`). */
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

/** Path params schema for tenant + housekeeping task routes. */
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

/** Path params schema for tenant + room routes. */
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

/** Path params schema for tenant + guest routes. */
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

/** Path params schema for tenant + reservation routes. */
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

/** Path params schema for tenant + waitlist entry routes. */
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

/** Path params schema for tenant + payment routes. */
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

/** Path params schema for tenant + invoice routes. */
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

/** Path params schema for tenant + generic command dispatch routes. */
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

/** @internal Front-desk and back-office operations endpoints. */
export const OPERATIONS_TAG = "Operations";
/** @internal Booking configuration entity endpoints. */
export const BOOKING_CONFIG_TAG = "Booking Configuration";
/** @internal Report and analytics endpoints. */
export const REPORTING_TAG = "Reporting";
/** @internal Room availability / ARI query endpoints. */
export const AVAILABILITY_TAG = "Availability";
/** @internal Webhook subscription management endpoints. */
export const WEBHOOK_TAG = "Webhooks";
/** @internal GDPR / CCPA privacy compliance endpoints. */
export const GDPR_TAG = "GDPR / Privacy";
/** @internal Guest-facing self-service endpoints. */
export const SELF_SERVICE_PROXY_TAG = "Self-Service Proxy";
/** @internal Revenue management proxy endpoints. */
export const REVENUE_PROXY_TAG = "Revenue Proxy";
/** @internal Calculation engine proxy endpoints. */
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

/** Path params schema for tenant + webhook subscription routes. */
export const tenantWebhookParamsSchema = {
  type: "object",
  properties: {
    tenantId: { type: "string", format: "uuid", description: "Tenant identifier." },
    webhookId: { type: "string", format: "uuid", description: "Webhook subscription identifier." },
  },
  required: ["tenantId", "webhookId"],
  additionalProperties: false,
} as const satisfies JsonSchema;

/** JSON Schema describing a webhook subscription resource. */
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

/** JSON Schema describing a webhook delivery log entry. */
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
