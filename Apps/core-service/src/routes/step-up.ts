/**
 * DEV DOC
 * Module: routes/step-up.ts
 * Purpose: The one endpoint a supervisor's credentials reach for an override.
 * Ownership: core-service
 */

import { STATUS_CODES } from "node:http";

import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { StepUpGrantResponseSchema, StepUpRequestSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { mintStepUpGrant } from "../services/step-up-service.js";

const STEP_UP_TAG = "Authentication";

const StepUpRequestJsonSchema = schemaFromZod(StepUpRequestSchema, "StepUpRequest");
const StepUpGrantResponseJsonSchema = schemaFromZod(StepUpGrantResponseSchema, "StepUpGrant");

export const registerStepUpRoutes = (app: FastifyInstance): void => {
  /**
   * Authorise one override at the terminal.
   *
   * The route gate is the **operator's** membership, at the shift floor: this
   * is a front-desk action, and the authority being asked for is the
   * supervisor's, verified in the body. Gating the endpoint itself at MANAGER
   * would mean only the people who do not need a step-up could ask for one.
   *
   * The grant that comes back is a reference to a row, not a token and not a
   * session — the operator never holds the supervisor's identity, only a note
   * that says one command on one record was authorised, once, for five minutes.
   */
  app.post(
    "/v1/tenants/:tenantId/commands/step-up",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
        minRole: "STAFF",
      }),
      schema: buildRouteSchema({
        tag: STEP_UP_TAG,
        summary: "Authorise one override with a supervisor's credentials",
        description:
          "A supervisor enters their own credentials at the terminal and the " +
          "response is a single-use grant, scoped to one command and one record, " +
          "that the operator attaches to that command. Dual-control commands are " +
          "refused: those need a second approver through the approval queue.",
        body: StepUpRequestJsonSchema,
        response: {
          200: StepUpGrantResponseJsonSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          423: errorResponseSchema,
          429: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const { tenantId } = request.params as { tenantId: string };
      const body = StepUpRequestSchema.parse(request.body);

      const operatorId = request.auth.userId;
      if (!operatorId) {
        throw request.server.httpErrors.unauthorized("You must be logged in to ask for a step-up.");
      }

      const result = await mintStepUpGrant({
        tenantId,
        propertyId: body.property_id ?? null,
        // From the token. A body-supplied operator is A01's defect exactly: the
        // self-approval check would then compare two strings the caller wrote.
        requestedBy: operatorId,
        commandName: body.command_name,
        entityId: body.entity_id ?? null,
        username: body.username,
        password: body.password,
        mfaCode: body.mfa_code,
      });

      if (!result.ok) {
        if (result.retryAfterMs) {
          reply.header("Retry-After", Math.ceil(result.retryAfterMs / 1000).toString());
        }
        return reply
          .status(result.status)
          .header("content-type", "application/problem+json")
          .send({
            type: "about:blank",
            title: STATUS_CODES[result.status] ?? "Error",
            status: result.status,
            detail: result.message,
            instance: request.url,
            code: result.code,
          });
      }

      return StepUpGrantResponseSchema.parse({
        grant_id: result.grant.grant_id,
        command_name: result.grant.command_name,
        entity_id: result.grant.entity_id,
        supervisor_name: result.supervisorName,
        supervisor_role: result.grant.supervisor_role,
        expires_at: new Date(result.grant.expires_at).toISOString(),
      });
    },
  );
};
