import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { CcpaOptOutBodySchema, CommunicationPrefsBodySchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getGuestPrivacyState,
  setCcpaOptOut,
  updateCommunicationPreferences,
} from "../services/privacy-service.js";

const PRIVACY_TAG = "Privacy & Compliance";

const GuestIdParamSchema = z.object({ guestId: z.string().uuid() });
const TenantQuerySchema = z.object({ tenant_id: z.string().uuid() });

const GuestIdParamJsonSchema = schemaFromZod(GuestIdParamSchema, "PrivacyGuestIdParam");
const TenantQueryJsonSchema = schemaFromZod(TenantQuerySchema, "PrivacyTenantQuery");

export const registerPrivacyRoutes = (app: FastifyInstance): void => {
  /**
   * GET /v1/guests/:guestId/privacy
   * Get the current privacy/consent state for a guest.
   */
  app.get<{
    Params: { guestId: string };
    Querystring: { tenant_id: string };
  }>(
    "/v1/guests/:guestId/privacy",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: PRIVACY_TAG,
        summary: "Get guest privacy and consent state",
        description:
          "Returns marketing consent, CCPA opt-out status, communication preferences, and active consent records",
        params: GuestIdParamJsonSchema,
        querystring: TenantQueryJsonSchema,
      }),
    },
    async (request, reply) => {
      const { guestId } = GuestIdParamSchema.parse(request.params);
      const { tenant_id } = TenantQuerySchema.parse(request.query);

      const state = await getGuestPrivacyState({ guestId, tenantId: tenant_id });
      if (!state) return reply.notFound("Guest not found");
      return state;
    },
  );

  /**
   * PUT /v1/guests/:guestId/privacy/ccpa-opt-out
   * CCPA: Set the "Do Not Sell My Personal Information" flag.
   */
  app.put<{ Params: { guestId: string } }>(
    "/v1/guests/:guestId/privacy/ccpa-opt-out",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: PRIVACY_TAG,
        summary: "CCPA: Set opt-out-of-sale flag",
        description:
          "Toggle the CCPA Do Not Sell flag. When opting out, marketing consent is also revoked. Logs consent change for audit.",
        params: GuestIdParamJsonSchema,
      }),
    },
    async (request, reply) => {
      const { guestId } = GuestIdParamSchema.parse(request.params);
      const body = CcpaOptOutBodySchema.parse(request.body);
      const userId = (request as { userId?: string }).userId;

      await setCcpaOptOut({
        guestId,
        tenantId: body.tenant_id,
        optOut: body.opt_out,
        requestedBy: userId,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return reply.status(200).send({
        guest_id: guestId,
        ccpa_opt_out_of_sale: body.opt_out,
        message: body.opt_out
          ? "Opt-out of sale recorded. Marketing consent revoked."
          : "Opt-out withdrawn. Data sharing re-enabled.",
      });
    },
  );

  /**
   * PUT /v1/guests/:guestId/privacy/communication-preferences
   * Update channel-specific communication opt-ins.
   */
  app.put<{ Params: { guestId: string } }>(
    "/v1/guests/:guestId/privacy/communication-preferences",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: PRIVACY_TAG,
        summary: "Update communication preferences",
        description: "Set channel-specific opt-in preferences (email, sms, phone, post)",
        params: GuestIdParamJsonSchema,
      }),
    },
    async (request, reply) => {
      const { guestId } = GuestIdParamSchema.parse(request.params);
      const body = CommunicationPrefsBodySchema.parse(request.body);
      const userId = (request as { userId?: string }).userId;

      await updateCommunicationPreferences({
        guestId,
        tenantId: body.tenant_id,
        preferences: body.preferences,
        updatedBy: userId,
      });

      return reply.status(200).send({
        guest_id: guestId,
        communication_preferences: body.preferences,
      });
    },
  );
};
