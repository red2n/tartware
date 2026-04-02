import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type RoomCategoryListQuery,
  RoomCategoryListQuerySchema,
  RoomCategoryListResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { listRoomCategories } from "../services/reference-data-service.js";

const REFERENCE_DATA_TAG = "Reference Data";
const RoomCategoryListQueryJsonSchema = schemaFromZod(
  RoomCategoryListQuerySchema,
  "RoomCategoryListQuery",
);
const RoomCategoryListResponseJsonSchema = schemaFromZod(
  RoomCategoryListResponseSchema,
  "RoomCategoryListResponse",
);

export const registerReferenceDataRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: RoomCategoryListQuery }>(
    "/v1/reference-data/room-categories",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as RoomCategoryListQuery).tenant_id,
        minRole: "VIEWER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: REFERENCE_DATA_TAG,
        summary: "List room categories",
        description:
          "Returns the active room category catalog from lookup tables, scoped to tenant/property overrides.",
        querystring: RoomCategoryListQueryJsonSchema,
        response: {
          200: RoomCategoryListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const query = RoomCategoryListQuerySchema.parse(request.query);
      const categories = await listRoomCategories(query);
      return RoomCategoryListResponseSchema.parse(categories);
    },
  );
};
