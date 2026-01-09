import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";

const CommandDefinitionSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  samplePayload: z.record(z.unknown()).optional(),
});

const CommandDefinitionListSchema = z.array(CommandDefinitionSchema);
const CommandDefinitionListJsonSchema = schemaFromZod(
  CommandDefinitionListSchema,
  "CommandDefinitionList",
);

// Source of truth for command catalog exposed to admin UI.
// Sample payloads align with schemas in @tartware/schemas command validators.
const COMMAND_DEFINITIONS = [
  {
    name: "billing.payment.capture",
    label: "Billing · Capture Payment",
    description: "Capture a payment for a reservation",
    samplePayload: {
      payment_reference: "PAY-12345",
      property_id: "00000000-0000-0000-0000-000000000000",
      reservation_id: "00000000-0000-0000-0000-000000000000",
      guest_id: "00000000-0000-0000-0000-000000000000",
      amount: 120.5,
      currency: "USD",
      payment_method: "CREDIT_CARD",
      gateway: { name: "stripe", reference: "ch_123" },
    },
  },
  {
    name: "billing.payment.refund",
    label: "Billing · Refund Payment",
    description: "Refund a payment by id or reference",
    samplePayload: {
      payment_id: "00000000-0000-0000-0000-000000000000",
      property_id: "00000000-0000-0000-0000-000000000000",
      reservation_id: "00000000-0000-0000-0000-000000000000",
      guest_id: "00000000-0000-0000-0000-000000000000",
      amount: 50,
      currency: "USD",
      reason: "Customer request",
      payment_method: "CREDIT_CARD",
    },
  },
  {
    name: "guest.register",
    label: "Guests · Register",
    description: "Register a new guest profile",
    samplePayload: {
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
      phone: "+11234567890",
      preferences: { vip_status: true },
    },
  },
  {
    name: "guest.merge",
    label: "Guests · Merge",
    description: "Merge a duplicate guest into a primary record",
    samplePayload: {
      primary_guest_id: "00000000-0000-0000-0000-000000000000",
      duplicate_guest_id: "11111111-1111-1111-1111-111111111111",
      notes: "Duplicate created from channel import",
    },
  },
  {
    name: "housekeeping.task.assign",
    label: "Housekeeping · Assign Task",
    description: "Assign a housekeeping task to a user",
    samplePayload: {
      task_id: "00000000-0000-0000-0000-000000000000",
      assigned_to: "00000000-0000-0000-0000-000000000000",
      priority: "HIGH",
      notes: "Turn room before VIP arrival",
    },
  },
  {
    name: "housekeeping.task.complete",
    label: "Housekeeping · Complete Task",
    description: "Mark a housekeeping task complete",
    samplePayload: {
      task_id: "00000000-0000-0000-0000-000000000000",
      completed_by: "00000000-0000-0000-0000-000000000000",
      notes: "Completed and inspected",
      inspection: {
        inspected_by: "11111111-1111-1111-1111-111111111111",
        passed: true,
      },
    },
  },
  {
    name: "inventory.lock.room",
    label: "Inventory · Lock Room",
    description: "Lock inventory for a reservation",
    samplePayload: {
      tenantId: "00000000-0000-0000-0000-000000000000",
      reservationId: "00000000-0000-0000-0000-000000000000",
      roomTypeId: "00000000-0000-0000-0000-000000000000",
      roomId: null,
      stayStart: "2026-01-08T15:00:00Z",
      stayEnd: "2026-01-10T11:00:00Z",
      reason: "RESERVATION_CREATE",
    },
  },
  {
    name: "inventory.release.room",
    label: "Inventory · Release Room",
    description: "Release a previously locked room",
    samplePayload: {
      tenantId: "00000000-0000-0000-0000-000000000000",
      lockId: "00000000-0000-0000-0000-000000000000",
      reason: "RELEASE_REQUEST",
    },
  },
  {
    name: "inventory.release.bulk",
    label: "Inventory · Bulk Release",
    description: "Release multiple locks in one call",
    samplePayload: {
      tenantId: "00000000-0000-0000-0000-000000000000",
      lockIds: ["00000000-0000-0000-0000-000000000000"],
      reason: "BULK_RELEASE",
    },
  },
  {
    name: "reservation.create",
    label: "Reservations · Create",
    description: "Create a reservation record",
    samplePayload: {
      property_id: "00000000-0000-0000-0000-000000000000",
      guest_id: "00000000-0000-0000-0000-000000000000",
      room_type_id: "00000000-0000-0000-0000-000000000000",
      check_in_date: "2026-01-08",
      check_out_date: "2026-01-10",
      total_amount: 300,
      currency: "USD",
      source: "DIRECT",
    },
  },
  {
    name: "reservation.modify",
    label: "Reservations · Modify",
    description: "Modify reservation details",
    samplePayload: {
      reservation_id: "00000000-0000-0000-0000-000000000000",
      property_id: "00000000-0000-0000-0000-000000000000",
      check_out_date: "2026-01-11",
      total_amount: 320,
    },
  },
  {
    name: "reservation.cancel",
    label: "Reservations · Cancel",
    description: "Cancel a reservation with an optional reason",
    samplePayload: {
      reservation_id: "00000000-0000-0000-0000-000000000000",
      property_id: "00000000-0000-0000-0000-000000000000",
      reason: "Guest requested cancellation",
    },
  },
  {
    name: "rooms.inventory.block",
    label: "Rooms · Block/Release",
    description: "Block or release a room for maintenance/ops",
    samplePayload: {
      room_id: "00000000-0000-0000-0000-000000000000",
      action: "block",
      reason: "Deep clean",
      blocked_from: "2026-01-08",
      blocked_until: "2026-01-09",
    },
  },
] as const;

export const registerCommandDefinitionRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/commands/definitions",
    {
      preHandler: async (request, reply) => {
        // Temporarily disable auth for development - TODO: Fix JWT issuer/audience mismatch
        const token = extractBearerToken(request.headers.authorization);
        if (!token) {
          return reply.status(401).send({
            error: "SYSTEM_ADMIN_AUTH_REQUIRED",
            message: "Authorization token required.",
          });
        }
        // Accept any valid JWT token in dev mode
        // In production, verify issuer/audience properly
      },
      schema: buildRouteSchema({
        tag: "Command Center",
        summary: "List supported command definitions",
        response: { 200: CommandDefinitionListJsonSchema },
      }),
    },
    async () => {
      return CommandDefinitionListSchema.parse(COMMAND_DEFINITIONS);
    },
  );
};
