import { randomUUID } from "node:crypto";
import { STATUS_CODES } from "node:http";

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  type CommandExecuteRequest,
  CommandExecuteRequestSchema,
  CommandExecuteResponseSchema,
  validateCommandPayload,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { acceptCommand, CommandDispatchError } from "../services/command-dispatch-service.js";

const CommandParamSchema = z.object({
  commandName: z.string().min(1),
});

const CommandParamJsonSchema = schemaFromZod(CommandParamSchema, "CommandExecuteParams");
const CommandExecuteBodyJsonSchema = schemaFromZod(
  CommandExecuteRequestSchema,
  "CommandExecuteBody",
);
const CommandExecuteResponseJsonSchema = schemaFromZod(
  CommandExecuteResponseSchema,
  "CommandExecuteResponse",
);

export const registerCommandRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/commands/:commandName/execute",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as CommandExecuteRequest).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: "Command Center",
        summary: "Submit a command for asynchronous execution",
        params: CommandParamJsonSchema,
        body: CommandExecuteBodyJsonSchema,
        response: {
          202: CommandExecuteResponseJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { commandName } = CommandParamSchema.parse(request.params);
      const body = CommandExecuteRequestSchema.parse(request.body);

      const membership = request.auth.getMembership(body.tenant_id);
      if (!membership) {
        return reply.forbidden("TENANT_ACCESS_DENIED");
      }

      const initiatedByInput = body.metadata?.initiated_by;
      const initiatedBy = initiatedByInput
        ? {
            userId: initiatedByInput.user_id,
            role: initiatedByInput.role,
          }
        : null;

      const validatedPayload = validateCommandPayload(commandName, body.payload);

      try {
        const result = await acceptCommand({
          commandName,
          tenantId: body.tenant_id,
          payload: validatedPayload,
          correlationId: body.correlation_id,
          initiatedBy,
          membership,
          requestId: (request.headers["x-request-id"] as string | undefined) ?? randomUUID(),
        });
        return reply.status(202).send(result);
      } catch (error) {
        if (error instanceof CommandDispatchError) {
          return reply
            .status(error.statusCode)
            .header("content-type", "application/problem+json")
            .send({
              type: "about:blank",
              title: STATUS_CODES[error.statusCode] ?? "Error",
              status: error.statusCode,
              detail: error.message,
              instance: request.url,
              code: error.code,
            });
        }
        throw error;
      }
    },
  );
};
