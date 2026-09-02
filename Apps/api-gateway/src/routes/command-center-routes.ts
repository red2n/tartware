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
 *  POST /v1/commands/:commandName/execute    — generic command execution (per-command floor)
 *  GET  /v1/tenants/:tenantId/commands/batches           — recent batch command runs
 *  GET  /v1/tenants/:tenantId/commands/batches/:batchId  — one run, every item outcome
 *  GET  /v1/tenants/:tenantId/commands/approvals              — commands awaiting a second approver
 *  GET  /v1/tenants/:tenantId/commands/approvals/:approvalId  — one request, with its payload
 *  POST /v1/tenants/:tenantId/commands/approvals/:approvalId/approve — release it, and dispatch it
 *  POST /v1/tenants/:tenantId/commands/approvals/:approvalId/reject  — refuse it, with a reason
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  BatchUpdateCommandFeaturesRequestSchema,
  BatchUpdateCommandFeaturesResponseSchema,
  COMMAND_APPROVER_FLOOR,
  COMMAND_AUTHORITY_FLOOR,
  CommandApprovalActionRequestSchema,
  CommandApprovalDecisionSchema,
  CommandApprovalViewSchema,
  CommandBatchDetailSchema,
  CommandBatchSummarySchema,
  CommandDefinitionSchema,
  CommandExecuteRequestSchema,
  CommandFeatureListItemSchema,
  UpdateCommandFeatureRequestSchema,
  UpdateCommandFeatureResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  approveCommandRequest,
  CommandDispatchError,
  findCommandApproval,
  listCommandDefinitions,
  listPendingCommandApprovals,
  rejectCommandRequest,
} from "../command-center/index.js";
import { findCommandBatch, listCommandBatches } from "../command-center/sql/command-batches.js";
import {
  batchUpdateCommandFeatureStatuses,
  listCommandFeatures,
  updateCommandFeatureStatus,
} from "../command-center/sql/command-features.js";
import { gatewayConfig } from "../config.js";
import { extractBearerToken, verifyAccessToken, verifySystemAdminToken } from "../lib/jwt.js";
import { sendCommandProblem, submitCommand } from "../utils/command-publisher.js";

import { commandAcceptedSchema } from "./schemas.js";

const environment = process.env.NODE_ENV ?? "development";

const CommandParamSchema = z.object({ commandName: z.string().min(1) });

const BatchListParamSchema = z.object({ tenantId: z.string().uuid() });
const BatchListParamJsonSchema = schemaFromZod(BatchListParamSchema, "CommandBatchListParams");

const BatchParamSchema = z.object({
  tenantId: z.string().uuid(),
  batchId: z.string().uuid(),
});
const BatchParamJsonSchema = schemaFromZod(BatchParamSchema, "CommandBatchParams");

const BatchQuerySchema = z.object({
  command_name: z.string().min(1).optional(),
  property_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
const BatchQueryJsonSchema = schemaFromZod(BatchQuerySchema, "CommandBatchQuery");
const CommandBatchDetailJsonSchema = schemaFromZod(CommandBatchDetailSchema, "CommandBatchDetail");
const CommandBatchListJsonSchema = schemaFromZod(
  z.array(CommandBatchSummarySchema),
  "CommandBatchList",
);
const CommandParamJsonSchema = schemaFromZod(CommandParamSchema, "CommandCenterParams");

const ApprovalParamSchema = z.object({
  tenantId: z.string().uuid(),
  approvalId: z.string().uuid(),
});
const ApprovalParamJsonSchema = schemaFromZod(ApprovalParamSchema, "CommandApprovalParams");
const ApprovalListQuerySchema = z.object({
  command_name: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
const ApprovalListQueryJsonSchema = schemaFromZod(
  ApprovalListQuerySchema,
  "CommandApprovalListQuery",
);
const ApprovalActionBodyJsonSchema = schemaFromZod(
  CommandApprovalActionRequestSchema,
  "CommandApprovalActionBody",
);
const ApprovalViewJsonSchema = schemaFromZod(CommandApprovalViewSchema, "CommandApproval");
const ApprovalListJsonSchema = schemaFromZod(
  z.array(CommandApprovalViewSchema),
  "CommandApprovalList",
);
const ApprovalDecisionJsonSchema = schemaFromZod(
  CommandApprovalDecisionSchema,
  "CommandApprovalDecision",
);

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
        // System-admin tokens use a distinct issuer/audience, so fall back to
        // that verifier when the token is not a tenant access token.
        const payload = verifyAccessToken(token) ?? verifySystemAdminToken(token);
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

  // ─── Batch command results ────────────────────────────────────────────────
  //
  // A batch command is accepted with 202 and runs asynchronously, so its
  // per-item outcomes have nowhere to be returned to. These two reads are where
  // an operator finds out which of the two hundred bookings did not cancel.

  const batchScopeFromParams = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  app.get(
    "/v1/tenants/:tenantId/commands/batches",
    {
      preHandler: batchScopeFromParams,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "List recent batch command runs",
        params: BatchListParamJsonSchema,
        querystring: BatchQueryJsonSchema,
        response: { 200: CommandBatchListJsonSchema },
      }),
    },
    async (request) => {
      const { tenantId } = BatchListParamSchema.parse(request.params);
      const filters = BatchQuerySchema.parse(request.query ?? {});
      const rows = await listCommandBatches({
        tenantId,
        commandName: filters.command_name,
        propertyId: filters.property_id,
        limit: filters.limit,
      });
      return z.array(CommandBatchSummarySchema).parse(rows);
    },
  );

  app.get(
    "/v1/tenants/:tenantId/commands/batches/:batchId",
    {
      preHandler: batchScopeFromParams,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "Read one batch command run with every item outcome",
        params: BatchParamJsonSchema,
        response: { 200: CommandBatchDetailJsonSchema },
      }),
    },
    async (request, reply) => {
      const { tenantId, batchId } = BatchParamSchema.parse(request.params);
      const batch = await findCommandBatch(tenantId, batchId);
      if (!batch) {
        return reply.notFound(`Batch "${batchId}" not found.`);
      }
      return CommandBatchDetailSchema.parse(batch);
    },
  );

  // ─── Dual control: releasing a deferred command ───────────────────────────
  //
  // A command in `COMMAND_DUAL_CONTROL` never reaches the outbox on one
  // person's authority — `acceptCommand` records it here instead. These routes
  // are the other half: approving *dispatches the stored payload*, so the
  // approval causes the operation rather than annotating it.

  /**
   * The person acting, always from the token.
   *
   * Same rule as billing's approval routes after A01: an identity that arrives
   * in a request body is one the caller chose, and a four-eyes check on two
   * caller-chosen strings is not a check.
   */
  const approvalActor = (request: FastifyRequest, tenantId: string) => {
    const id = request.auth.userId;
    if (!id) return null;
    const membership = request.auth.getMembership(tenantId);
    return {
      // No display name on the token; `actioned_by_name` stays null rather than
      // being invented, and the id is what the record is read by anyway.
      actor: { id, name: null, role: membership?.role },
      membership,
    };
  };

  // Seeing the queue is not deciding on it, so this is the same membership gate
  // as submitting a command: a requester must be able to watch the request they
  // raised. The decision routes below are gated at the approver floor, and the
  // row's own `required_role` decides in the end.
  const approvalReadScope = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: COMMAND_AUTHORITY_FLOOR,
    requiredModules: "core",
  });
  const approvalDecideScope = app.withTenantScope({
    resolveTenantId: (request) => (request.params as { tenantId?: string }).tenantId,
    minRole: COMMAND_APPROVER_FLOOR,
    requiredModules: "core",
  });

  app.get(
    "/v1/tenants/:tenantId/commands/approvals",
    {
      preHandler: approvalReadScope,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "List commands waiting on a second approver",
        params: BatchListParamJsonSchema,
        querystring: ApprovalListQueryJsonSchema,
        response: { 200: ApprovalListJsonSchema },
      }),
    },
    async (request) => {
      const { tenantId } = BatchListParamSchema.parse(request.params);
      const query = ApprovalListQuerySchema.parse(request.query ?? {});
      const rows = await listPendingCommandApprovals({
        tenantId,
        commandName: query.command_name,
        limit: query.limit,
        offset: query.offset,
      });
      return z.array(CommandApprovalViewSchema).parse(rows);
    },
  );

  app.get(
    "/v1/tenants/:tenantId/commands/approvals/:approvalId",
    {
      preHandler: approvalReadScope,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "Read one approval request, including the payload to be run",
        params: ApprovalParamJsonSchema,
        response: { 200: ApprovalViewJsonSchema },
      }),
    },
    async (request, reply) => {
      const { tenantId, approvalId } = ApprovalParamSchema.parse(request.params);
      const row = await findCommandApproval(tenantId, approvalId);
      if (!row) {
        return reply.notFound(`Approval "${approvalId}" not found.`);
      }
      return CommandApprovalViewSchema.parse(row);
    },
  );

  app.post(
    "/v1/tenants/:tenantId/commands/approvals/:approvalId/approve",
    {
      preHandler: approvalDecideScope,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "Approve a deferred command and dispatch it",
        description:
          "Four-eyes: the approver must hold the request's `required_role` and must not be the requester. On success the stored payload is dispatched and the resulting command id is returned.",
        params: ApprovalParamJsonSchema,
        body: ApprovalActionBodyJsonSchema,
        response: { 200: ApprovalDecisionJsonSchema },
      }),
    },
    async (request, reply) => {
      const { tenantId, approvalId } = ApprovalParamSchema.parse(request.params);
      const body = CommandApprovalActionRequestSchema.parse(request.body ?? {});
      const who = approvalActor(request, tenantId);
      if (!who?.membership) {
        return reply.unauthorized("An authenticated user is required to approve a command.");
      }

      try {
        const result = await approveCommandRequest({
          tenantId,
          approvalId,
          actor: who.actor,
          membership: who.membership,
          reason: body.reason,
          correlationId: (request.headers["x-correlation-id"] as string | undefined) ?? undefined,
        });
        return CommandApprovalDecisionSchema.parse({
          approval: CommandApprovalViewSchema.parse(result.approval),
          command_id: result.commandId,
        });
      } catch (error) {
        if (error instanceof CommandDispatchError) {
          return sendCommandProblem(request, reply, error);
        }
        throw error;
      }
    },
  );

  app.post(
    "/v1/tenants/:tenantId/commands/approvals/:approvalId/reject",
    {
      preHandler: approvalDecideScope,
      schema: buildRouteSchema({
        tag: COMMAND_CENTER_TAG,
        summary: "Refuse a deferred command",
        description:
          "Nothing is dispatched. A reason is required — the refusal is the record of why the operation did not happen.",
        params: ApprovalParamJsonSchema,
        body: ApprovalActionBodyJsonSchema,
        response: { 200: ApprovalViewJsonSchema },
      }),
    },
    async (request, reply) => {
      const { tenantId, approvalId } = ApprovalParamSchema.parse(request.params);
      const body = CommandApprovalActionRequestSchema.parse(request.body ?? {});
      if (!body.reason || body.reason.trim() === "") {
        return reply.badRequest("A reason is required to reject an approval request.");
      }
      const who = approvalActor(request, tenantId);
      if (!who) {
        return reply.unauthorized("An authenticated user is required to reject a command.");
      }

      try {
        const row = await rejectCommandRequest({
          tenantId,
          approvalId,
          actor: who.actor,
          reason: body.reason,
        });
        return CommandApprovalViewSchema.parse(row);
      } catch (error) {
        if (error instanceof CommandDispatchError) {
          return sendCommandProblem(request, reply, error);
        }
        throw error;
      }
    },
  );

  // ─── Generic command execution ────────────────────────────────────────────

  app.post(
    "/v1/commands/:commandName/execute",
    {
      // The route gate is membership, not authority: `COMMAND_AUTHORITY_FLOOR`
      // is the lowest role any command declares, so anything stricter here
      // would refuse a clerk their own check-in before the per-command floor
      // in `COMMAND_MIN_ROLE` ever got to answer. That floor is computed from
      // the declarations, so it cannot fall out of step with them.
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as { tenant_id?: string })?.tenant_id ?? undefined,
        minRole: COMMAND_AUTHORITY_FLOOR,
        requiredModules: "core",
      }),
      config: {
        // Was hardcoded to 120/minute — two commands a second, on the endpoint
        // every write in the system goes through, with no way to raise it. The
        // config it now reads is the same one `self-service-routes` and
        // `misc-routes` already use for their command writes, so the limit is
        // consistent across them and tunable per environment via
        // `API_GATEWAY_RATE_COMMAND_MAX`.
        rateLimit: {
          max: gatewayConfig.rateLimit.commandMax,
          timeWindow: gatewayConfig.rateLimit.commandTimeWindow,
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
        requiredModules: "core",
      });
    },
  );
};
