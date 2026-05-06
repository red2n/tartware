import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  approveRequest,
  cancelApprovalRequest,
  createApprovalRequest,
  getApprovalRequest,
  listPendingApprovals,
  rejectRequest,
} from "../services/approval-service.js";

const TAG = "Approval Workflows";

const ApprovalListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  operation_type: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

type ApprovalListQuery = z.infer<typeof ApprovalListQuerySchema>;

const ApprovalListQueryJsonSchema = schemaFromZod(ApprovalListQuerySchema, "ApprovalListQuery");

const ApprovalRequestBodySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  operation_type: z.string().min(1),
  entity_type: z.string().min(1).max(60),
  entity_id: z.string().uuid(),
  operation_payload: z.record(z.unknown()).optional(),
  description: z.string().max(500).optional(),
  required_role: z.string().max(60).optional(),
  requested_by: z.string().min(1).max(100),
  requested_by_name: z.string().max(200).optional(),
});
type ApprovalRequestBody = z.infer<typeof ApprovalRequestBodySchema>;
const ApprovalRequestBodyJsonSchema = schemaFromZod(
  ApprovalRequestBodySchema,
  "ApprovalRequestBody",
);

const ApprovalActionBodySchema = z.object({
  actioned_by: z.string().min(1).max(100),
  actioned_by_name: z.string().max(200).optional(),
  reason: z.string().max(500).optional(),
});
type ApprovalActionBody = z.infer<typeof ApprovalActionBodySchema>;
const ApprovalActionBodyJsonSchema = schemaFromZod(ApprovalActionBodySchema, "ApprovalActionBody");

const ApprovalRejectBodySchema = z.object({
  actioned_by: z.string().min(1).max(100),
  actioned_by_name: z.string().max(200).optional(),
  reason: z.string().min(1).max(500),
});
type ApprovalRejectBody = z.infer<typeof ApprovalRejectBodySchema>;
const ApprovalRejectBodyJsonSchema = schemaFromZod(ApprovalRejectBodySchema, "ApprovalRejectBody");

const ApprovalCancelBodySchema = z.object({
  cancelled_by: z.string().min(1).max(100),
  reason: z.string().max(500).optional(),
});
type ApprovalCancelBody = z.infer<typeof ApprovalCancelBodySchema>;
const ApprovalCancelBodyJsonSchema = schemaFromZod(ApprovalCancelBodySchema, "ApprovalCancelBody");

export const registerApprovalRoutes = (app: FastifyInstance): void => {
  // ─── GET /v1/billing/approvals/pending ─────────────────────────────────────
  app.get<{ Querystring: ApprovalListQuery }>(
    "/v1/billing/approvals/pending",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ApprovalListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "List pending approval requests",
        description:
          "Returns pending four-eyes approval requests, ordered by expiry (most urgent first).",
        querystring: ApprovalListQueryJsonSchema,
        response: {
          200: {
            type: "object",
            properties: { data: { type: "array" }, meta: { type: "object" } },
          },
        },
      }),
    },
    async (request) => {
      const q = ApprovalListQuerySchema.parse(request.query);
      const data = await listPendingApprovals({
        tenantId: q.tenant_id,
        propertyId: q.property_id,
        operationType: q.operation_type,
        limit: q.limit,
        offset: q.offset,
      });
      return { data, meta: { count: data.length, limit: q.limit, offset: q.offset } };
    },
  );

  // ─── GET /v1/billing/approvals/:id ─────────────────────────────────────────
  const ApprovalGetQuerySchema = z.object({ tenant_id: z.string().uuid() });
  type ApprovalGetQuery = z.infer<typeof ApprovalGetQuerySchema>;
  const ApprovalGetQueryJsonSchema = schemaFromZod(ApprovalGetQuerySchema, "ApprovalGetQuery");

  app.get<{ Params: { id: string }; Querystring: ApprovalGetQuery }>(
    "/v1/billing/approvals/:id",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ApprovalGetQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Get a single approval request",
        querystring: ApprovalGetQueryJsonSchema,
        response: {
          200: { type: "object" },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      }),
    },
    async (request, reply) => {
      const { tenant_id } = ApprovalGetQuerySchema.parse(request.query);
      const row = await getApprovalRequest(request.params.id, tenant_id);
      if (!row) {
        return reply.code(404).send({ error: "Approval request not found." });
      }
      return row;
    },
  );

  // ─── POST /v1/billing/approvals ────────────────────────────────────────────
  app.post<{ Body: ApprovalRequestBody }>(
    "/v1/billing/approvals",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as ApprovalRequestBody).tenant_id,
        minRole: "STAFF",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Request an approval for a high-risk billing operation",
        description:
          "Creates a PENDING approval request. The operation is NOT executed until approved by a second user (four-eyes principle).",
        body: ApprovalRequestBodyJsonSchema,
        response: {
          202: {
            type: "object",
            properties: {
              approval_id: { type: "string" },
              message: { type: "string" },
            },
          },
        },
      }),
    },
    async (request, reply) => {
      const body = ApprovalRequestBodySchema.parse(request.body);
      const approvalId = await createApprovalRequest(body, body.tenant_id);
      return reply.code(202).send({
        approval_id: approvalId,
        message: "Approval request created. Awaiting second authorisation (four-eyes principle).",
      });
    },
  );

  // ─── POST /v1/billing/approvals/:id/approve ────────────────────────────────
  app.post<{ Params: { id: string }; Body: ApprovalActionBody }>(
    "/v1/billing/approvals/:id/approve",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as ApprovalActionBody & { tenant_id?: string }).tenant_id ?? "",
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Approve a pending approval request",
        description:
          "Approves the request. Enforces the four-eyes principle — the approver must not be the original requester.",
        body: ApprovalActionBodyJsonSchema,
        response: {
          200: { type: "object" },
          403: { type: "object", properties: { error: { type: "string" } } },
        },
      }),
    },
    async (request, reply) => {
      const body = ApprovalActionBodySchema.parse(request.body);
      const extBody = request.body as ApprovalActionBody & { tenant_id?: string };
      if (!extBody.tenant_id) {
        return reply.code(400).send({ error: "tenant_id required in body." });
      }
      const row = await approveRequest(
        { approval_id: request.params.id, ...body },
        extBody.tenant_id,
      );
      return { data: row, message: "Approval granted." };
    },
  );

  // ─── POST /v1/billing/approvals/:id/reject ─────────────────────────────────
  app.post<{ Params: { id: string }; Body: ApprovalRejectBody }>(
    "/v1/billing/approvals/:id/reject",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as ApprovalRejectBody & { tenant_id?: string }).tenant_id ?? "",
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Reject a pending approval request",
        body: ApprovalRejectBodyJsonSchema,
        response: {
          200: { type: "object" },
        },
      }),
    },
    async (request, reply) => {
      const body = ApprovalRejectBodySchema.parse(request.body);
      const extBody = request.body as ApprovalRejectBody & { tenant_id?: string };
      if (!extBody.tenant_id) {
        return reply.code(400).send({ error: "tenant_id required in body." });
      }
      const row = await rejectRequest(
        { approval_id: request.params.id, ...body },
        extBody.tenant_id,
      );
      return { data: row, message: "Approval rejected." };
    },
  );

  // ─── POST /v1/billing/approvals/:id/cancel ─────────────────────────────────
  app.post<{ Params: { id: string }; Body: ApprovalCancelBody }>(
    "/v1/billing/approvals/:id/cancel",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as ApprovalCancelBody & { tenant_id?: string }).tenant_id ?? "",
        minRole: "STAFF",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Cancel a pending approval request",
        description: "Withdraws the approval request. Only the original requester should cancel.",
        body: ApprovalCancelBodyJsonSchema,
        response: {
          200: { type: "object" },
        },
      }),
    },
    async (request, reply) => {
      const body = ApprovalCancelBodySchema.parse(request.body);
      const extBody = request.body as ApprovalCancelBody & { tenant_id?: string };
      if (!extBody.tenant_id) {
        return reply.code(400).send({ error: "tenant_id required in body." });
      }
      const approvalId = await cancelApprovalRequest(
        { approval_id: request.params.id, ...body },
        extBody.tenant_id,
      );
      return { approval_id: approvalId, message: "Approval request cancelled." };
    },
  );
};
