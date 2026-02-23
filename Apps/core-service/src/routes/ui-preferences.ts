import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { UpdateUserUiPreferencesSchema, UserUiPreferencesSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { getUiPreferences, upsertUiPreferences } from "../services/ui-preferences-service.js";

const UiPreferencesResponseJsonSchema = schemaFromZod(UserUiPreferencesSchema, "UserUiPreferences");
const UpdateUiPreferencesJsonSchema = schemaFromZod(
  UpdateUserUiPreferencesSchema,
  "UpdateUserUiPreferences",
);

const UI_PREFS_TAG = "User UI Preferences";

/**
 * Registers GET and PUT routes for the authenticated user's UI preferences.
 * Uses `/v1/users/me/ui-preferences` so the user can only access their own row.
 * Requires at least one tenant membership (VIEWER role) and a `tenant_id` query param.
 */
export const registerUiPreferencesRoutes = (app: FastifyInstance): void => {
  /**
   * GET /v1/users/me/ui-preferences?tenant_id=<uuid>
   * Returns the caller's UI preferences for the given tenant, or defaults if none saved.
   */
  app.get<{ Querystring: { tenant_id: string } }>(
    "/v1/users/me/ui-preferences",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
        minRole: "VIEWER",
      }),
      schema: buildRouteSchema({
        tag: UI_PREFS_TAG,
        summary: "Get the authenticated user's UI preferences",
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
          },
        },
        response: {
          200: UiPreferencesResponseJsonSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      }),
    },
    async (request) => {
      const userId = request.auth.userId;
      if (!userId) {
        throw request.server.httpErrors.unauthorized(
          "You must be logged in to access this resource.",
        );
      }

      const { tenant_id } = request.query;
      const prefs = await getUiPreferences(userId, tenant_id);

      if (!prefs) {
        // Return defaults when no row exists yet
        return UserUiPreferencesSchema.parse({
          preference_id: "00000000-0000-0000-0000-000000000000",
          tenant_id,
          user_id: userId,
          theme: "SYSTEM",
          language: "en",
          date_format: "YYYY-MM-DD",
          time_format: "24H",
          currency_display: "SYMBOL",
          home_page: "/dashboard",
          home_page_dashboard_layout: [],
          default_page_size: 25,
          default_sort_direction: "ASC",
          notification_sound_enabled: true,
          notification_desktop_enabled: true,
          notification_email_digest: "IMMEDIATE",
          pinned_reports: [],
          recent_searches: [],
          favorite_properties: [],
          profile_display_fields: [],
          profile_history_display: "COMPACT",
          default_profile_tab: "OVERVIEW",
        });
      }

      return UserUiPreferencesSchema.parse(prefs);
    },
  );

  /**
   * PUT /v1/users/me/ui-preferences?tenant_id=<uuid>
   * Upserts the caller's UI preferences for the given tenant.
   * Accepts a partial body — only supplied fields are updated.
   */
  app.put<{ Querystring: { tenant_id: string } }>(
    "/v1/users/me/ui-preferences",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id?: string }).tenant_id,
        minRole: "VIEWER",
      }),
      schema: buildRouteSchema({
        tag: UI_PREFS_TAG,
        summary: "Update the authenticated user's UI preferences",
        querystring: {
          type: "object",
          required: ["tenant_id"],
          properties: {
            tenant_id: { type: "string", format: "uuid" },
          },
        },
        body: UpdateUiPreferencesJsonSchema,
        response: {
          200: UiPreferencesResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      }),
    },
    async (request) => {
      const userId = request.auth.userId;
      if (!userId) {
        throw request.server.httpErrors.unauthorized(
          "You must be logged in to access this resource.",
        );
      }

      const { tenant_id } = request.query;
      const data = UpdateUserUiPreferencesSchema.parse(request.body);
      const result = await upsertUiPreferences(tenant_id, userId, data);
      return UserUiPreferencesSchema.parse(result);
    },
  );
};
