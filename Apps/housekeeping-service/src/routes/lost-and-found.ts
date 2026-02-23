import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  ClaimLostAndFoundBodySchema,
  CreateLostAndFoundBodySchema,
  ProblemDetailSchema,
  ReturnLostAndFoundBodySchema,
  UpdateLostAndFoundBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  claimLostAndFoundItem,
  createLostAndFoundItem,
  getLostAndFoundItem,
  listLostAndFoundItems,
  returnLostAndFoundItem,
  updateLostAndFoundItem,
} from "../services/lost-and-found-service.js";

const LOST_FOUND_TAG = "Lost & Found";

const ListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

type ListQuery = z.infer<typeof ListQuerySchema>;

const ItemParamsSchema = z.object({
  itemId: z.string().uuid(),
});

const ListQueryJsonSchema = schemaFromZod(ListQuerySchema, "LostFoundListQuery");
const ItemParamsJsonSchema = schemaFromZod(ItemParamsSchema, "LostFoundItemParams");
const TenantQueryJsonSchema = schemaFromZod(
  z.object({ tenant_id: z.string().uuid() }),
  "LostFoundTenantQuery",
);
const ErrorResponseJsonSchema = schemaFromZod(ProblemDetailSchema, "LostFoundErrorResponse");

export const registerLostAndFoundRoutes = (app: FastifyInstance): void => {
  /** GET /v1/lost-and-found — List items with filters */
  app.get<{ Querystring: ListQuery }>(
    "/v1/lost-and-found",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: LOST_FOUND_TAG,
        summary: "List lost & found items",
        description:
          "Retrieve lost & found items with filtering by status, category, and date range",
        querystring: ListQueryJsonSchema,
      }),
    },
    async (request) => {
      const q = ListQuerySchema.parse(request.query);
      return listLostAndFoundItems({
        tenantId: q.tenant_id,
        propertyId: q.property_id,
        status: q.status,
        category: q.category,
        dateFrom: q.date_from,
        dateTo: q.date_to,
        limit: q.limit,
        offset: q.offset,
      });
    },
  );

  /** GET /v1/lost-and-found/:itemId — Get item details */
  app.get<{ Params: { itemId: string }; Querystring: { tenant_id: string } }>(
    "/v1/lost-and-found/:itemId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: LOST_FOUND_TAG,
        summary: "Get lost & found item by ID",
        params: ItemParamsJsonSchema,
        querystring: TenantQueryJsonSchema,
        response: { 404: ErrorResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { itemId } = ItemParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const item = await getLostAndFoundItem({ itemId, tenantId: tenant_id });
      if (!item) return reply.notFound("Lost & found item not found");
      return item;
    },
  );

  /** POST /v1/lost-and-found — Register a new item */
  app.post(
    "/v1/lost-and-found",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: LOST_FOUND_TAG,
        summary: "Register a new lost & found item",
      }),
    },
    async (request, reply) => {
      const body = CreateLostAndFoundBodySchema.parse(request.body);
      const userId = (request as { userId?: string }).userId;

      const result = await createLostAndFoundItem({
        tenantId: body.tenant_id,
        propertyId: body.property_id,
        itemName: body.item_name,
        itemDescription: body.item_description,
        itemCategory: body.item_category,
        itemSubcategory: body.item_subcategory,
        brand: body.brand,
        color: body.color,
        estimatedValue: body.estimated_value,
        foundDate: body.found_date,
        foundTime: body.found_time,
        foundByName: body.found_by_name,
        foundLocation: body.found_location,
        roomNumber: body.room_number,
        areaName: body.area_name,
        guestId: body.guest_id,
        guestName: body.guest_name,
        guestEmail: body.guest_email,
        reservationId: body.reservation_id,
        storageLocation: body.storage_location,
        holdDays: body.hold_days,
        isValuable: body.is_valuable,
        requiresSecureStorage: body.requires_secure_storage,
        specialHandlingInstructions: body.special_handling_instructions,
        internalNotes: body.internal_notes,
        createdBy: userId,
      });

      return reply.status(201).send(result);
    },
  );

  /** PUT /v1/lost-and-found/:itemId — Update item */
  app.put<{ Params: { itemId: string } }>(
    "/v1/lost-and-found/:itemId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: LOST_FOUND_TAG,
        summary: "Update a lost & found item",
        params: ItemParamsJsonSchema,
        response: { 404: ErrorResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { itemId } = ItemParamsSchema.parse(request.params);
      const body = UpdateLostAndFoundBodySchema.parse(request.body);
      const userId = (request as { userId?: string }).userId;
      const { tenant_id, ...updates } = body;

      const item = await updateLostAndFoundItem({
        itemId,
        tenantId: tenant_id,
        updates,
        updatedBy: userId,
      });

      if (!item) return reply.notFound("Lost & found item not found");
      return item;
    },
  );

  /** POST /v1/lost-and-found/:itemId/claim — Record a claim */
  app.post<{ Params: { itemId: string } }>(
    "/v1/lost-and-found/:itemId/claim",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: LOST_FOUND_TAG,
        summary: "Record a claim on a lost & found item",
        params: ItemParamsJsonSchema,
        response: { 404: ErrorResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { itemId } = ItemParamsSchema.parse(request.params);
      const body = ClaimLostAndFoundBodySchema.parse(request.body);
      const userId = (request as { userId?: string }).userId;

      const item = await claimLostAndFoundItem({
        itemId,
        tenantId: body.tenant_id,
        claimedByGuestId: body.claimed_by_guest_id,
        claimedByName: body.claimed_by_name,
        verificationNotes: body.verification_notes,
        verifiedBy: userId,
      });

      if (!item) return reply.notFound("Lost & found item not found");
      return item;
    },
  );

  /** POST /v1/lost-and-found/:itemId/return — Record item return */
  app.post<{ Params: { itemId: string } }>(
    "/v1/lost-and-found/:itemId/return",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "facility-maintenance",
      }),
      schema: buildRouteSchema({
        tag: LOST_FOUND_TAG,
        summary: "Record return of a lost & found item",
        params: ItemParamsJsonSchema,
        response: { 404: ErrorResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { itemId } = ItemParamsSchema.parse(request.params);
      const body = ReturnLostAndFoundBodySchema.parse(request.body);
      const userId = (request as { userId?: string }).userId;

      const item = await returnLostAndFoundItem({
        itemId,
        tenantId: body.tenant_id,
        returnMethod: body.return_method,
        returnedToName: body.returned_to_name,
        returnedBy: userId,
        notes: body.notes,
      });

      if (!item) {
        return reply.status(409).send({
          error: "INVALID_STATUS",
          message: "Item cannot be returned in its current status",
        });
      }
      return item;
    },
  );
};
