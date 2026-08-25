/**
 * FX Reference Rate Routes — ACCT-13
 *
 * GET  /v1/billing/fx-rates   — list rates visible to a tenant
 * POST /v1/billing/fx-rates   — set (or correct) the rate for a currency pair on a date
 *
 * Reference/config data, so plain REST rather than the command pipeline
 * (AGENTS.md: CRUD REST is for low-velocity admin/config data).
 *
 * Without this write path `fx_rates` could only be populated by direct SQL,
 * which left `lockFxRate` permanently on its fail-open 1.0 fallback for every
 * cross-currency posting.
 *
 * Ref: USALI 12th Edition §9.3, BA §13.5 | Issue: ACCT-13
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import type { FxRateListQuery, FxRateRow, FxRateUpsertRequest } from "@tartware/schemas";
import {
  FxRateListQuerySchema,
  FxRateListResponseSchema,
  FxRateUpsertRequestSchema,
  FxRateUpsertResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { listFxRates, upsertFxRate } from "../repositories/fx-rate-repository.js";

const FX_TAG = "FX Rates";

const FxRateListQueryJsonSchema = schemaFromZod(FxRateListQuerySchema, "FxRateListQuery");
const FxRateListResponseJsonSchema = schemaFromZod(FxRateListResponseSchema, "FxRateListResponse");
const FxRateUpsertRequestJsonSchema = schemaFromZod(
  FxRateUpsertRequestSchema,
  "FxRateUpsertRequest",
);
const FxRateUpsertResponseJsonSchema = schemaFromZod(
  FxRateUpsertResponseSchema,
  "FxRateUpsertResponse",
);

/** Normalise a raw row for the API: numeric rate, date-only `rate_date`. */
const toFxRateItem = (row: FxRateRow) => ({
  rate_id: row.rate_id,
  tenant_id: row.tenant_id,
  from_currency: row.from_currency.trim(),
  to_currency: row.to_currency.trim(),
  rate: Number(row.rate),
  rate_date:
    row.rate_date instanceof Date
      ? row.rate_date.toISOString().slice(0, 10)
      : String(row.rate_date).slice(0, 10),
  rate_source: row.rate_source,
  rate_source_ref: row.rate_source_ref,
  created_at:
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
});

export const registerFxRateRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: FxRateListQuery }>(
    "/v1/billing/fx-rates",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "VIEWER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: FX_TAG,
        summary: "List FX reference rates for a tenant (optionally including global rates)",
        querystring: FxRateListQueryJsonSchema,
        response: { 200: FxRateListResponseJsonSchema },
      }),
    },
    async (request) => {
      const params = FxRateListQuerySchema.parse(request.query);
      const rows = await listFxRates(params);
      const data = rows.map(toFxRateItem);
      return { data, meta: { count: data.length } };
    },
  );

  app.post<{ Body: FxRateUpsertRequest }>(
    "/v1/billing/fx-rates",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: FX_TAG,
        summary: "Set or correct the FX rate for a currency pair on a given date",
        body: FxRateUpsertRequestJsonSchema,
        response: { 200: FxRateUpsertResponseJsonSchema, 201: FxRateUpsertResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const input = FxRateUpsertRequestSchema.parse(request.body);
      const userId = request.auth?.userId;

      if (!userId) {
        return reply.code(401).send({ error: "User ID missing from auth context." });
      }

      const { rateId, created } = await upsertFxRate(userId, input);

      return reply.code(created ? 201 : 200).send({
        rate_id: rateId,
        created,
        message: created
          ? `FX rate ${input.from_currency}→${input.to_currency} recorded for ${input.rate_date}.`
          : `FX rate ${input.from_currency}→${input.to_currency} for ${input.rate_date} corrected.`,
      });
    },
  );
};
