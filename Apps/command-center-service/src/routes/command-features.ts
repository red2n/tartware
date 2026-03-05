import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  BatchUpdateCommandFeaturesRequestSchema,
  BatchUpdateCommandFeaturesResponseSchema,
  CommandFeatureListItemSchema,
  UpdateCommandFeatureRequestSchema,
  UpdateCommandFeatureResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  batchUpdateCommandFeatureStatuses,
  listCommandFeatures,
  updateCommandFeatureStatus,
} from "../sql/command-features.js";

const environment = process.env.NODE_ENV ?? "development";

const CommandFeatureListJsonSchema = schemaFromZod(
  z.array(CommandFeatureListItemSchema),
  "CommandFeatureList",
);

const CommandParamSchema = z.object({
  commandName: z.string().min(1),
});
const CommandParamJsonSchema = schemaFromZod(CommandParamSchema, "CommandFeatureParams");

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

export const registerCommandFeatureRoutes = (app: FastifyInstance): void => {
  /** Gateway enforces adminOnly; service-level guard ensures authentication. */
  const authenticatedOnly = app.withTenantScope({ allowMissingTenantId: true });

  app.get(
    "/v1/commands/features",
    {
      preHandler: authenticatedOnly,
      schema: buildRouteSchema({
        tag: "Command Center",
        summary: "List all commands with their feature status",
        response: { 200: CommandFeatureListJsonSchema },
      }),
    },
    async () => {
      const rows = await listCommandFeatures(environment);
      return z.array(CommandFeatureListItemSchema).parse(rows);
    },
  );

  app.patch(
    "/v1/commands/:commandName/features",
    {
      preHandler: authenticatedOnly,
      schema: buildRouteSchema({
        tag: "Command Center",
        summary: "Update the feature status of a command",
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

  app.patch(
    "/v1/commands/features/batch",
    {
      preHandler: authenticatedOnly,
      schema: buildRouteSchema({
        tag: "Command Center",
        summary: "Batch-update the feature status of multiple commands",
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
};
