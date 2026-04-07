/**
 * Command Center routes — now hosted directly in the API Gateway.
 *
 * Previously these lived in the standalone `command-center-service` and were
 * reached through a proxy.  By absorbing them here we eliminate that extra
 * network hop on every admin read and generic command dispatch, and reduce
 * the number of running processes from 20 to 19 (Phase 1 of the service
 * consolidation plan).
 *
 * Routes:
 *  GET  /v1/commands/definitions       — list all registered command templates (system-admin only)
 *  GET  /v1/commands/features          — list commands with feature-flag status (authenticated)
 *  PATCH /v1/commands/:commandName/features  — update a single command's feature status
 *  PATCH /v1/commands/features/batch         — bulk-update feature statuses
 *  POST /v1/commands/:commandName/execute    — generic command execution (MANAGER+ role)
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  BatchUpdateCommandFeaturesRequestSchema,
  BatchUpdateCommandFeaturesResponseSchema,
  CommandDefinitionSchema,
  CommandExecuteRequestSchema,
  CommandFeatureListItemSchema,
  UpdateCommandFeatureRequestSchema,
  UpdateCommandFeatureResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listCommandDefinitions } from "../command-center/index.js";
import {
  batchUpdateCommandFeatureStatuses,
  listCommandFeatures,
  updateCommandFeatureStatus,
} from "../command-center/sql/command-features.js";
import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { submitCommand } from "../utils/command-publisher.js";

import { commandAcceptedSchema } from "./schemas.js";

const environment = process.env.NODE_ENV ?? "development";

const CommandParamSchema = z.object({ commandName: z.string().min(1) });
const CommandParamJsonSchema = schemaFromZod(CommandParamSchema, "CommandCenterParams");

const CommandDefinitionListJsonSchema = schemaFromZod(
  z.array(CommandDefinitionSchema),
  "CommandDefinitionList",
);
const CommandExecuteBodyJsonSchema = schemaFromZod(
  CommandExecuteRequestSchema,
  "CommandExecuteBody",
);
const CommandFeatureListJsonSchema = schemaFromZod(
  z.array(CommandFeatureListItemSchema),
  "CommandFeatureList",
);
const UpdateBodyJsonSchema = schemaFromZod(
  UpdateCommandFeatureRequestSchema,
  "UpdateCommandFeatureBody",
);
const UpdateResponseJsonSchema = schemaFromZod(
  UpdateCommandFeatureResponseSchema,
  "UpdateCommandFeatureResponse",
);
const BatchUpdateBodyJsonSchema = schemaFromZod(
  BatchUpdateCommandFeaturesRequestSchema,
  "BatchUpdateCommandFeaturesBody",
);
const BatchUpdateResponseJsonSchema = schemaFromZod(
  BatchUpdateCommandFeaturesResponseSchema,
  "BatchUpdateCommandFeaturesResponse",
);

const COMMAND_CENTER_TAG = "Command Center";

/** Register all command-center management and execution routes. */
export const registerCommandCenterRoutes = (app: FastifyInstance): void => {
  const authenticatedOnly = app.withTenantScope({ allowMissingTenantId: true });

  // ─── Definitions (system-admin only) ─────────────────────────────────────

  app.get(
    "/v1/commands/definitions",
    {
      preHandler: async (request, reply) => {
        const token = extractBearerToken(request.headers.authorization);
        if (!token) {
          return reply.unauthorized("Authorization token required.");
        }
        const payload = verifyAccessToken(token);
        if (!payload) {
          return reply.unauthorized("Invalid authorization token.");
        }
        const scope = payload.scope;
        const hasSystemAdminScope = Array.isArray(scope)
          ? scope.includes("SYSTEM_ADMIN")
          : scope === "SYSTEM_ADMIN";
        if (!hasSystemAdminScope) {
          return reply.forbidden("System administrator scope required.");
        }
      },
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "List all registered command definitions",
        response: { 200: CommandDefinitionListJsonSchema },
      }),
    },
    async () => {
      const definitions = listCommandDefinitions().map(
        ({ name, label, description, samplePayload }) => ({
          name,
          label,
          description,
          samplePayload,
        }),
      );
      return z.array(CommandDefinitionSchema).parse(definitions);
    },
  );

  // ─── Feature flags ────────────────────────────────────────────────────────

  app.get(
    "/v1/commands/features",
    {
      preHandler: authenticatedOnly,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "List all commands with their feature-flag status",
        response: { 200: CommandFeatureListJsonSchema },
      }),
    },
    async () => {
      const rows = await listCommandFeatures(environment);
      return z.array(CommandFeatureListItemSchema).parse(rows);
    },
  );

  app.patch(
    "/v1/commands/features/batch",
    {
      preHandler: authenticatedOnly,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "Batch-update the feature-flag status of multiple commands",
        body: BatchUpdateBodyJsonSchema,
        response: { 200: BatchUpdateResponseJsonSchema },
      }),
    },
    async (request) => {
      const { updates } = BatchUpdateCommandFeaturesRequestSchema.parse(request.body);
      const result = await batchUpdateCommandFeatureStatuses(updates, environment);
      return BatchUpdateCommandFeaturesResponseSchema.parse(result);
    },
  );

  app.patch(
    "/v1/commands/:commandName/features",
    {
      preHandler: authenticatedOnly,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "Update the feature-flag status of a single command",
        params: CommandParamJsonSchema,
        body: UpdateBodyJsonSchema,
        response: { 200: UpdateResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { commandName } = CommandParamSchema.parse(request.params);
      const { status } = UpdateCommandFeatureRequestSchema.parse(request.body);

      try {
        const result = await updateCommandFeatureStatus(commandName, environment, status);
        if (!result) {
          return reply.notFound(`Command "${commandName}" not found.`);
        }
        return UpdateCommandFeatureResponseSchema.parse(result);
      } catch (error) {
        const err = error as { code?: string } | undefined;
        if (err?.code === "23503") {
          return reply.notFound(`Command "${commandName}" not found.`);
        }
        throw error;
      }
    },
  );

  // ─── Generic command execution ────────────────────────────────────────────

  app.post(
    "/v1/commands/:commandName/execute",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as { tenant_id?: string })?.tenant_id ?? undefined,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      config: {
        rateLimit: {
          max: 120,
          timeWindow: "1 minute",
        },
      },
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "Submit a named command for asynchronous execution",
        params: CommandParamJsonSchema,
        body: CommandExecuteBodyJsonSchema,
        response: { 202: commandAcceptedSchema },
      }),
    },
    async (request, reply) => {
      const { commandName } = CommandParamSchema.parse(request.params);
      const body = CommandExecuteRequestSchema.parse(request.body);

      return submitCommand({
        request,
        reply,
        commandName,
        tenantId: body.tenant_id,
        payload: body.payload,
        requiredRole: "MANAGER",
        requiredModules: "core",
      });
    },
  );
};
