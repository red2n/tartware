import { randomUUID } from "node:crypto";

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { validateCommandPayload } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { ZodError, z } from "zod";

import { acceptCommand, CommandDispatchError } from "../services/command-dispatch-service.js";

const CommandParamSchema = z.object({
  commandName: z.string().min(1),
});

const CommandExecuteBodySchema = z.object({
  tenant_id: z.string().uuid(),
  payload: z.record(z.unknown()),
  correlation_id: z.string().min(1).optional(),
  metadata: z
    .object({
      initiated_by: z
        .object({
          user_id: z.string().uuid(),
          role: z.string().min(1),
        })
        .optional(),
    })
    .optional(),
});

const CommandExecuteResponseSchema = z.object({
  status: z.literal("accepted"),
  commandId: z.string().uuid(),
  commandName: z.string(),
  tenantId: z.string().uuid(),
  correlationId: z.string().optional(),
  targetService: z.string(),
  requestedAt: z.string(),
});

const CommandParamJsonSchema = schemaFromZod(CommandParamSchema, "CommandExecuteParams");
const CommandExecuteBodyJsonSchema = schemaFromZod(CommandExecuteBodySchema, "CommandExecuteBody");
const CommandExecuteResponseJsonSchema = schemaFromZod(
  CommandExecuteResponseSchema,
  "CommandExecuteResponse",
);

export const registerCommandRoutes = (app: FastifyInstance): void => {
  app.post(
    "/v1/commands/:commandName/execute",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof CommandExecuteBodySchema>).tenant_id,
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
      const body = CommandExecuteBodySchema.parse(request.body);

      const membership = request.auth.getMembership(body.tenant_id);
      if (!membership) {
        reply.forbidden("TENANT_ACCESS_DENIED");
        return;
      }

      const initiatedByInput = body.metadata?.initiated_by;
      const initiatedBy = initiatedByInput
        ? {
            userId: initiatedByInput.user_id,
            role: initiatedByInput.role,
          }
        : null;

      let validatedPayload: Record<string, unknown>;
      try {
        validatedPayload = validateCommandPayload(commandName, body.payload);
      } catch (error) {
        if (error instanceof ZodError) {
          reply.status(400).send({
            error: "COMMAND_PAYLOAD_INVALID",
            message: `${commandName} payload failed validation`,
            issues: error.issues,
          });
          return;
        }
        throw error;
      }

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
        reply.status(202).send(result);
      } catch (error) {
        if (error instanceof CommandDispatchError) {
          reply.status(error.statusCode).send({
            error: error.code,
            message: error.message,
          });
          return;
        }
        throw error;
      }
    },
  );
};
