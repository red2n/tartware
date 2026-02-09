import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  GuestCommunicationListItemSchema,
  GuestDocumentListItemSchema,
  GuestPreferenceListItemSchema,
  GuestWithStatsSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getGuestById,
  listGuestCommunications,
  listGuestDocuments,
  listGuestPreferences,
  listGuests,
} from "../services/guest-service.js";
import { sanitizeForJson } from "../utils/sanitize.js";

const GuestListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  email: z.string().min(3).max(255).optional(),
  phone: z.string().min(3).max(20).optional(),
  loyalty_tier: z.string().min(1).max(50).optional(),
  vip_status: z.coerce.boolean().optional(),
  is_blacklisted: z.coerce.boolean().optional(),
  offset: z.coerce.number().int().min(0).default(0),
});

const GuestListResponseSchema = z.array(
  GuestWithStatsSchema.extend({
    version: z.string(),
  }),
);

const GuestListQueryJsonSchema = schemaFromZod(GuestListQuerySchema, "GuestListQuery");
const GuestListResponseJsonSchema = schemaFromZod(GuestListResponseSchema, "GuestListResponse");

// Single guest schemas
const GuestIdParamSchema = z.object({ guestId: z.string().uuid() });
const GuestByIdQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
});
type GuestByIdQuery = z.infer<typeof GuestByIdQuerySchema>;

const GuestItemResponseSchema = GuestWithStatsSchema.extend({ version: z.string() });
const GuestIdParamJsonSchema = schemaFromZod(GuestIdParamSchema, "GuestIdParam");
const GuestByIdQueryJsonSchema = schemaFromZod(GuestByIdQuerySchema, "GuestByIdQuery");
const GuestItemResponseJsonSchema = schemaFromZod(GuestItemResponseSchema, "GuestItemResponse");

// Guest Preferences schemas
const GuestPreferencesQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  category: z.string().optional(),
  active_only: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type GuestPreferencesQuery = z.infer<typeof GuestPreferencesQuerySchema>;

const GuestPreferencesResponseSchema = z.array(GuestPreferenceListItemSchema);
const GuestPreferencesQueryJsonSchema = schemaFromZod(
  GuestPreferencesQuerySchema,
  "GuestPreferencesQuery",
);
const GuestPreferencesResponseJsonSchema = schemaFromZod(
  GuestPreferencesResponseSchema,
  "GuestPreferencesResponse",
);

// Guest Documents schemas
const GuestDocumentsQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  document_type: z.string().optional(),
  verification_status: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type GuestDocumentsQuery = z.infer<typeof GuestDocumentsQuerySchema>;

const GuestDocumentsResponseSchema = z.array(GuestDocumentListItemSchema);
const GuestDocumentsQueryJsonSchema = schemaFromZod(
  GuestDocumentsQuerySchema,
  "GuestDocumentsQuery",
);
const GuestDocumentsResponseJsonSchema = schemaFromZod(
  GuestDocumentsResponseSchema,
  "GuestDocumentsResponse",
);

// Guest Communications schemas
const GuestCommunicationsQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  communication_type: z.string().optional(),
  direction: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type GuestCommunicationsQuery = z.infer<typeof GuestCommunicationsQuerySchema>;

const GuestCommunicationsResponseSchema = z.array(GuestCommunicationListItemSchema);
const GuestCommunicationsQueryJsonSchema = schemaFromZod(
  GuestCommunicationsQuerySchema,
  "GuestCommunicationsQuery",
);
const GuestCommunicationsResponseJsonSchema = schemaFromZod(
  GuestCommunicationsResponseSchema,
  "GuestCommunicationsResponse",
);

const GUESTS_TAG = "Guests";

export const registerGuestRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/guests",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.query as z.infer<typeof GuestListQuerySchema>).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: GUESTS_TAG,
        summary: "List guests with optional filters",
        querystring: GuestListQueryJsonSchema,
        response: {
          200: GuestListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        limit,
        tenant_id,
        property_id,
        email,
        phone,
        loyalty_tier,
        vip_status,
        is_blacklisted,
        offset,
      } = GuestListQuerySchema.parse(request.query);

      const guests = await listGuests({
        limit,
        tenantId: tenant_id,
        propertyId: property_id,
        email,
        phone,
        loyaltyTier: loyalty_tier,
        vipStatus: vip_status,
        isBlacklisted: is_blacklisted,
        offset,
      });

      const response = sanitizeForJson(guests);
      return GuestListResponseSchema.parse(response);
    },
  );

  // ============================================================================
  // SINGLE GUEST BY ID
  // ============================================================================

  app.get<{
    Params: z.infer<typeof GuestIdParamSchema>;
    Querystring: GuestByIdQuery;
  }>(
    "/v1/guests/:guestId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GuestByIdQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: GUESTS_TAG,
        summary: "Get a single guest by ID",
        params: GuestIdParamJsonSchema,
        querystring: GuestByIdQueryJsonSchema,
        response: {
          200: GuestItemResponseJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { guestId } = request.params;
      const { tenant_id, property_id } = GuestByIdQuerySchema.parse(request.query);

      const guest = await getGuestById({
        guestId,
        tenantId: tenant_id,
        propertyId: property_id,
      });

      if (!guest) {
        return reply.status(404).send({ error: "Guest not found" });
      }

      const response = sanitizeForJson(guest);
      return GuestItemResponseSchema.parse(response);
    },
  );

  // ============================================================================
  // GUEST PREFERENCES
  // ============================================================================

  app.get<{
    Params: { guestId: string };
    Querystring: GuestPreferencesQuery;
  }>(
    "/v1/guests/:guestId/preferences",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GuestPreferencesQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: GUESTS_TAG,
        summary: "List guest preferences",
        params: schemaFromZod(z.object({ guestId: z.string().uuid() }), "GuestIdParam"),
        querystring: GuestPreferencesQueryJsonSchema,
        response: {
          200: GuestPreferencesResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { guestId } = request.params;
      const { tenant_id, category, active_only, limit, offset } = GuestPreferencesQuerySchema.parse(
        request.query,
      );

      const preferences = await listGuestPreferences({
        tenantId: tenant_id,
        guestId,
        category,
        activeOnly: active_only,
        limit,
        offset,
      });

      return GuestPreferencesResponseSchema.parse(preferences);
    },
  );

  // ============================================================================
  // GUEST DOCUMENTS
  // ============================================================================

  app.get<{
    Params: { guestId: string };
    Querystring: GuestDocumentsQuery;
  }>(
    "/v1/guests/:guestId/documents",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GuestDocumentsQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: GUESTS_TAG,
        summary: "List guest documents",
        params: schemaFromZod(z.object({ guestId: z.string().uuid() }), "GuestIdParamDocs"),
        querystring: GuestDocumentsQueryJsonSchema,
        response: {
          200: GuestDocumentsResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { guestId } = request.params;
      const { tenant_id, document_type, verification_status, limit, offset } =
        GuestDocumentsQuerySchema.parse(request.query);

      const documents = await listGuestDocuments({
        tenantId: tenant_id,
        guestId,
        documentType: document_type,
        verificationStatus: verification_status,
        limit,
        offset,
      });

      return GuestDocumentsResponseSchema.parse(documents);
    },
  );

  // ============================================================================
  // GUEST COMMUNICATIONS
  // ============================================================================

  app.get<{
    Params: { guestId: string };
    Querystring: GuestCommunicationsQuery;
  }>(
    "/v1/guests/:guestId/communications",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GuestCommunicationsQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: GUESTS_TAG,
        summary: "List guest communication history",
        params: schemaFromZod(z.object({ guestId: z.string().uuid() }), "GuestIdParamComm"),
        querystring: GuestCommunicationsQueryJsonSchema,
        response: {
          200: GuestCommunicationsResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { guestId } = request.params;
      const { tenant_id, communication_type, direction, status, limit, offset } =
        GuestCommunicationsQuerySchema.parse(request.query);

      const communications = await listGuestCommunications({
        tenantId: tenant_id,
        guestId,
        communicationType: communication_type,
        direction,
        status,
        limit,
        offset,
      });

      return GuestCommunicationsResponseSchema.parse(communications);
    },
  );
};
