import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { CommandDefinitionSchema } from "@tartware/schemas";
import { extractBearerToken, createTokenVerifier } from "@tartware/tenant-auth/jwt";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { config } from "../config.js";
import { listCommandDefinitions } from "../services/command-registry-service.js";

const verifyAccessToken = createTokenVerifier(config.auth.jwt);

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
