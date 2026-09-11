/**
 * DEV DOC
 * Module: routes/channel-config.ts
 * Purpose: The write half of channel onboarding — create a connection, map a
 *          room type, map a rate plan.
 * Ownership: core-service
 *
 * The read half lives in `night-audit.ts` (`registerOtaRoutes`) for historical
 * reasons. New routes go here rather than joining it: a night-audit module is
 * not where anyone looks for channel configuration, and moving the existing
 * reads is a separate change with its own risk.
 *
 * Gated at ADMIN. Onboarding a channel decides which rooms and prices leave the
 * property and under whose credentials, which is configuration that decides how
 * money is made rather than the work of a shift — the same tier A02 put the
 * "config that decides how money is recorded" commands at.
 */

import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import {
  ChannelConfigCreateSchema,
  ChannelConfigUpdateSchema,
  ChannelMappingCreateSchema,
  OtaRatePlanCreateSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import {
  insertChannelConfig,
  insertChannelMapping,
  insertOtaRatePlan,
  isUniqueViolation,
  updateChannelConfig,
} from "../repositories/channel-config-repository.js";

const CHANNEL_TAG = "OTA Connections";

/**
 * Run a write, and answer a duplicate as a conflict.
 *
 * Without this the driver's error escapes as a 500 carrying the constraint
 * name — the caller learns nothing usable and the schema leaks. Re-sending a
 * configuration is ordinary (an integrator retries after a typo), so it earns a
 * real status code rather than a stack trace.
 */
const orConflict = async <T>(
  request: { server: { httpErrors: { conflict: (m: string) => Error } } },
  what: string,
  write: () => Promise<T>,
): Promise<T> => {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw request.server.httpErrors.conflict(`That ${what} already exists on this tenant.`);
    }
    throw error;
  }
};

const ConfigCreateJson = schemaFromZod(ChannelConfigCreateSchema, "ChannelConfigCreate");
const ConfigUpdateJson = schemaFromZod(ChannelConfigUpdateSchema, "ChannelConfigUpdate");
const MappingCreateJson = schemaFromZod(ChannelMappingCreateSchema, "ChannelMappingCreate");
const RatePlanCreateJson = schemaFromZod(OtaRatePlanCreateSchema, "OtaRatePlanCreate");

/** Tenant comes from the scope the preHandler resolved, never from the body. */
const tenantOf = (request: { query: unknown; body: unknown }): string =>
  ((request.query as { tenant_id?: string })?.tenant_id ??
    (request.body as { tenant_id?: string })?.tenant_id) as string;

export const registerChannelConfigRoutes = (app: FastifyInstance): void => {
  const adminScope = app.withTenantScope({
    resolveTenantId: (request) =>
      (request.query as { tenant_id?: string })?.tenant_id ??
      (request.body as { tenant_id?: string })?.tenant_id,
    minRole: "ADMIN",
  });

  app.post(
    "/v1/ota-configurations",
    {
      preHandler: adminScope,
      schema: buildRouteSchema({
        tag: CHANNEL_TAG,
        summary: "Onboard a channel connection",
        description:
          "Creates an ota_configurations row. `transport` defaults to NONE, which refuses a push until a property chooses how the channel is reached. Credentials are write-only and never returned.",
        body: ConfigCreateJson,
        response: {
          201: { type: "object", additionalProperties: true },
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = ChannelConfigCreateSchema.parse(request.body);
      const actorId = request.auth.userId;
      if (!actorId) {
        throw request.server.httpErrors.unauthorized("Login required.");
      }
      const row = await orConflict(request, "channel", () =>
        insertChannelConfig(tenantOf(request), actorId, body),
      );
      if (!row) {
        throw request.server.httpErrors.badRequest("The channel could not be created.");
      }
      return reply.status(201).send(row);
    },
  );

  app.put(
    "/v1/ota-configurations/:configId",
    {
      preHandler: adminScope,
      schema: buildRouteSchema({
        tag: CHANNEL_TAG,
        summary: "Change a channel connection",
        description:
          "`property_id` and `ota_code` are not editable: re-pointing a connection would silently re-parent its mappings and its sync history.",
        body: ConfigUpdateJson,
        response: { 200: { type: "object", additionalProperties: true }, 404: errorResponseSchema },
      }),
    },
    async (request, reply) => {
      const { configId } = request.params as { configId: string };
      const body = ChannelConfigUpdateSchema.parse(request.body);
      const actorId = request.auth.userId;
      if (!actorId) {
        throw request.server.httpErrors.unauthorized("Login required.");
      }
      const row = await updateChannelConfig(tenantOf(request), configId, actorId, body);
      if (!row) {
        return reply.notFound(`Channel configuration "${configId}" not found.`);
      }
      return reply.send(row);
    },
  );

  app.post(
    "/v1/channel-mappings",
    {
      preHandler: adminScope,
      schema: buildRouteSchema({
        tag: CHANNEL_TAG,
        summary: "Map an entity to the code a channel knows it by",
        description:
          "The availability push joins on `entity_type = 'room_type'`; a mapping the push cannot read is indistinguishable from no mapping at the point it refuses.",
        body: MappingCreateJson,
        response: {
          201: { type: "object", additionalProperties: true },
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = ChannelMappingCreateSchema.parse(request.body);
      const actorId = request.auth.userId;
      if (!actorId) {
        throw request.server.httpErrors.unauthorized("Login required.");
      }
      const row = await orConflict(request, "channel mapping", () =>
        insertChannelMapping(tenantOf(request), actorId, body),
      );
      if (!row) {
        throw request.server.httpErrors.badRequest("The mapping could not be created.");
      }
      return reply.status(201).send(row);
    },
  );

  app.post(
    "/v1/ota-rate-plans",
    {
      preHandler: adminScope,
      schema: buildRouteSchema({
        tag: CHANNEL_TAG,
        summary: "Map a rate to a channel rate plan",
        description:
          "Read by `integration.ota.rate_push`, joined to `rates` for the base rate and currency. Without one the push refuses with CHANNEL_RATE_PLANS_MISSING.",
        body: RatePlanCreateJson,
        response: {
          201: { type: "object", additionalProperties: true },
          400: errorResponseSchema,
          409: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = OtaRatePlanCreateSchema.parse(request.body);
      const actorId = request.auth.userId;
      if (!actorId) {
        throw request.server.httpErrors.unauthorized("Login required.");
      }
      const row = await orConflict(request, "rate plan mapping", () =>
        insertOtaRatePlan(tenantOf(request), actorId, body),
      );
      if (!row) {
        throw request.server.httpErrors.badRequest("The rate plan mapping could not be created.");
      }
      return reply.status(201).send(row);
    },
  );
};
