import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { CreateFlowApprovalSchema, FlowApprovalSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getApprovalsByEntity,
  listFlowApprovals,
  recordFlowApproval,
} from "../repositories/flow-approval-repository.js";

const TAG = "Flow Gate Approvals";

const FlowApprovalListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const FlowApprovalEntityParamsSchema = z.object({
  entity_type: z.string().min(1).max(60),
  entity_id: z.string().uuid(),
});

export const registerFlowApprovalRoutes = (app: FastifyInstance): void => {
  // ─── GET /v1/billing/flow-approvals ────────────────────────────────────────
  app.get<{ Querystring: z.infer<typeof FlowApprovalListQuerySchema> }>(
    "/v1/billing/flow-approvals",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "List all flow gate bypass approvals",
        querystring: schemaFromZod(FlowApprovalListQuerySchema, "FlowApprovalListQuery"),
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: schemaFromZod(FlowApprovalSchema, "FlowApproval") },
              meta: { type: "object" },
            },
          },
        },
      }),
    },
    async (request) => {
      const q = FlowApprovalListQuerySchema.parse(request.query);
      const { rows, total } = await listFlowApprovals(q.tenant_id, q.limit, q.offset);
      return { data: rows, meta: { total, limit: q.limit, offset: q.offset } };
    },
  );

  // ─── GET /v1/billing/flow-approvals/:entity_type/:entity_id ────────────────
  const FlowApprovalEntityQuerySchema = z.object({ tenant_id: z.string().uuid() });
  app.get<{
    Params: z.infer<typeof FlowApprovalEntityParamsSchema>;
    Querystring: z.infer<typeof FlowApprovalEntityQuerySchema>;
  }>(
    "/v1/billing/flow-approvals/:entity_type/:entity_id",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Get bypass history for a specific entity",
        params: schemaFromZod(FlowApprovalEntityParamsSchema, "FlowApprovalEntityParams"),
        querystring: schemaFromZod(FlowApprovalEntityQuerySchema, "FlowApprovalEntityQuery"),
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: schemaFromZod(FlowApprovalSchema, "FlowApproval") },
            },
          },
        },
      }),
    },
    async (request) => {
      const { tenant_id } = request.query;
      const { entity_type, entity_id } = request.params;
      const rows = await getApprovalsByEntity(tenant_id, entity_type, entity_id);
      return { data: rows };
    },
  );

  // ─── POST /v1/billing/flow-approvals ───────────────────────────────────────
  app.post(
    "/v1/billing/flow-approvals",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Record a flow gate bypass approval",
        body: schemaFromZod(CreateFlowApprovalSchema, "CreateFlowApproval"),
        response: {
          201: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              message: { type: "string" },
            },
          },
        },
      }),
    },
    async (request, reply) => {
      const body = CreateFlowApprovalSchema.parse(request.body);
      // Override approver fields with authenticated user context
      const approvedBy = request.auth.user.sub as string;
      const roleAtApproval = request.auth.user.role || "SYSTEM";
      const id = await recordFlowApproval({
        ...body,
        approved_by: approvedBy,
        role_at_approval: roleAtApproval,
      });
      return reply.code(201).send({
        id,
        message: "Flow gate bypass approval recorded successfully.",
      });
    },
  );
};
