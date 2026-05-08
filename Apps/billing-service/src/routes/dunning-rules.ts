import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  ArDunningRuleSchema,
  CreateArDunningRuleSchema,
  UpdateArDunningRuleSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createDunningRule,
  deleteDunningRule,
  listDunningRules,
  updateDunningRule,
} from "../repositories/ar-dunning-rule-repository.js";

const TAG = "AR Dunning Rules";

export const registerDunningRuleRoutes = (app: FastifyInstance): void => {
  // ─── GET /v1/billing/ar/dunning-rules ─────────────────────────────────────
  const DunningRuleListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
  });

  app.get<{ Querystring: z.infer<typeof DunningRuleListQuerySchema> }>(
    "/v1/billing/ar/dunning-rules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "List AR dunning escalation rules",
        querystring: schemaFromZod(DunningRuleListQuerySchema, "DunningRuleListQuery"),
        response: {
          200: {
            type: "object",
            properties: {
              data: { type: "array", items: schemaFromZod(ArDunningRuleSchema, "ArDunningRule") },
            },
          },
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id } = request.query;
      const rows = await listDunningRules(tenant_id, property_id);
      return { data: rows };
    },
  );

  // ─── POST /v1/billing/ar/dunning-rules ────────────────────────────────────
  app.post<{ Body: z.infer<typeof CreateArDunningRuleSchema> & { tenant_id: string } }>(
    "/v1/billing/ar/dunning-rules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Create a new AR dunning escalation rule",
        body: schemaFromZod(
          CreateArDunningRuleSchema.extend({ tenant_id: z.string().uuid() }),
          "CreateArDunningRule",
        ),
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
      const body = CreateArDunningRuleSchema.parse(request.body);
      const tenantId = (request.body as { tenant_id: string }).tenant_id;
      const userId = request.auth.userId;

      if (!userId) {
        return reply.code(401).send({ error: "User ID missing from auth context." });
      }

      const id = await createDunningRule(tenantId, userId, body);
      return reply.code(201).send({
        id,
        message: "AR dunning rule created successfully.",
      });
    },
  );

  // ─── PATCH /v1/billing/ar/dunning-rules/:id ───────────────────────────────
  app.patch<{
    Params: { id: string };
    Body: z.infer<typeof UpdateArDunningRuleSchema> & { tenant_id: string };
  }>(
    "/v1/billing/ar/dunning-rules/:id",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Update an AR dunning escalation rule",
        params: schemaFromZod(z.object({ id: z.string().uuid() }), "DunningRuleParams"),
        body: schemaFromZod(
          UpdateArDunningRuleSchema.extend({ tenant_id: z.string().uuid() }),
          "UpdateArDunningRule",
        ),
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      }),
    },
    async (request, reply) => {
      const body = UpdateArDunningRuleSchema.parse({
        ...((request.body as object) || {}),
        rule_id: request.params.id,
      });
      const tenantId = (request.body as { tenant_id: string }).tenant_id;
      const userId = request.auth.userId;

      if (!userId) {
        return reply.code(401).send({ error: "User ID missing from auth context." });
      }

      const success = await updateDunningRule(tenantId, userId, body);
      if (!success) {
        return reply.code(404).send({ error: "Dunning rule not found or access denied." });
      }
      return { success: true };
    },
  );

  // ─── DELETE /v1/billing/ar/dunning-rules/:id ──────────────────────────────
  const DunningRuleDeleteQuerySchema = z.object({ tenant_id: z.string().uuid() });
  app.delete<{
    Params: { id: string };
    Querystring: z.infer<typeof DunningRuleDeleteQuerySchema>;
  }>(
    "/v1/billing/ar/dunning-rules/:id",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: TAG,
        summary: "Delete an AR dunning escalation rule",
        params: schemaFromZod(z.object({ id: z.string().uuid() }), "DunningRuleParams"),
        querystring: schemaFromZod(DunningRuleDeleteQuerySchema, "DunningRuleDeleteQuery"),
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          404: { type: "object", properties: { error: { type: "string" } } },
        },
      }),
    },
    async (request, reply) => {
      const { tenant_id } = request.query;
      const userId = request.auth.userId;

      if (!userId) {
        return reply.code(401).send({ error: "User ID missing from auth context." });
      }

      const success = await deleteDunningRule(tenant_id, userId, request.params.id);
      if (!success) {
        return reply.code(404).send({ error: "Dunning rule not found or access denied." });
      }
      return { success: true };
    },
  );
};
