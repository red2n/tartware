import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { CommandDefinitionSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { listCommandDefinitions } from "../services/command-registry-service.js";

const CommandDefinitionListSchema = z.array(CommandDefinitionSchema);
const CommandDefinitionListJsonSchema = schemaFromZod(
  CommandDefinitionListSchema,
  "CommandDefinitionList",
);

export const registerCommandDefinitionRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/commands/definitions",
    {
      preHandler: async (request, reply) => {
        const token = extractBearerToken(request.headers.authorization);
        if (!token) {
          return reply.status(401).send({
            error: "SYSTEM_ADMIN_AUTH_REQUIRED",
            message: "Authorization token required.",
          });
        }
        const payload = verifyAccessToken(token);
        if (!payload) {
          return reply.status(401).send({
            error: "SYSTEM_ADMIN_AUTH_REQUIRED",
            message: "Invalid authorization token.",
          });
        }

        const scope = payload.scope;
        const hasSystemAdminScope = Array.isArray(scope)
          ? scope.includes("SYSTEM_ADMIN")
          : scope === "SYSTEM_ADMIN";

        if (!hasSystemAdminScope) {
          return reply.status(403).send({
            error: "SYSTEM_ADMIN_SCOPE_REQUIRED",
            message: "System administrator scope required.",
          });
        }
      },
      schema: buildRouteSchema({
        tag: "Command Center",
        summary: "List supported command definitions",
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
      return CommandDefinitionListSchema.parse(definitions);
    },
  );
};
