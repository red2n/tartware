import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { LoyaltyPointTransactionsSchema, LoyaltyTierRulesSchema, ProgramBalanceResponseSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { query } from "../lib/db.js";

// =====================================================
// LOCAL QUERY / PARAM SCHEMAS
// =====================================================

const LoyaltyTransactionListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  program_id: z.string().uuid(),
  transaction_type: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type LoyaltyTransactionListQuery = z.infer<typeof LoyaltyTransactionListQuerySchema>;

const LoyaltyTransactionListResponseSchema = z.array(LoyaltyPointTransactionsSchema);
const LoyaltyTransactionListQueryJsonSchema = schemaFromZod(
  LoyaltyTransactionListQuerySchema,
  "LoyaltyTransactionListQuery",
);
const LoyaltyTransactionListResponseJsonSchema = schemaFromZod(
  LoyaltyTransactionListResponseSchema,
  "LoyaltyTransactionListResponse",
);

const TierRulesQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  is_active: z.coerce.boolean().optional(),
});

type TierRulesQuery = z.infer<typeof TierRulesQuerySchema>;

const TierRulesResponseSchema = z.array(LoyaltyTierRulesSchema);
const TierRulesQueryJsonSchema = schemaFromZod(TierRulesQuerySchema, "TierRulesQuery");
const TierRulesResponseJsonSchema = schemaFromZod(TierRulesResponseSchema, "TierRulesResponse");

const ProgramBalanceParamsSchema = z.object({
  programId: z.string().uuid(),
});

const ProgramBalanceQuerySchema = z.object({
  tenant_id: z.string().uuid(),
});


const ProgramBalanceResponseJsonSchema = schemaFromZod(
  ProgramBalanceResponseSchema,
  "ProgramBalanceResponse",
);
const ProgramBalanceParamJsonSchema = schemaFromZod(
  ProgramBalanceParamsSchema,
  "ProgramBalanceParam",
);

// =====================================================
// TAGS
// =====================================================

const LOYALTY_TAG = "Loyalty";

// =====================================================
// ROUTE REGISTRATION
// =====================================================

export const registerLoyaltyRoutes = (app: FastifyInstance): void => {
  // -------------------------------------------------
  // LOYALTY TRANSACTION HISTORY
  // -------------------------------------------------

  app.get<{ Querystring: LoyaltyTransactionListQuery }>(
    "/v1/loyalty/transactions",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as LoyaltyTransactionListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: LOYALTY_TAG,
        summary: "List loyalty point transactions",
        description:
          "Retrieve the points ledger for a loyalty program (earn, redeem, expire, adjust, bonus, transfer)",
        querystring: LoyaltyTransactionListQueryJsonSchema,
        response: {
          200: LoyaltyTransactionListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, program_id, transaction_type, limit, offset } =
        LoyaltyTransactionListQuerySchema.parse(request.query);

      const { rows } = await query(
        `
          SELECT
            transaction_id, tenant_id, program_id, guest_id,
            transaction_type, points, balance_after,
            currency_value, reference_type, reference_id,
            description, expires_at, expired,
            performed_by, created_at
          FROM loyalty_point_transactions
          WHERE tenant_id = $1::uuid
            AND program_id = $2::uuid
            AND ($3::text IS NULL OR transaction_type = $3::text)
          ORDER BY created_at DESC
          LIMIT $4 OFFSET $5
        `,
        [tenant_id, program_id, transaction_type ?? null, limit, offset],
      );

      return LoyaltyTransactionListResponseSchema.parse(rows);
    },
  );

  // -------------------------------------------------
  // LOYALTY TIER RULES
  // -------------------------------------------------

  app.get<{ Querystring: TierRulesQuery }>(
    "/v1/loyalty/tier-rules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as TierRulesQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: LOYALTY_TAG,
        summary: "List loyalty tier rules",
        description:
          "Retrieve tier qualification thresholds, earning rates, and benefits configuration",
        querystring: TierRulesQueryJsonSchema,
        response: {
          200: TierRulesResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, is_active } = TierRulesQuerySchema.parse(request.query);

      const { rows } = await query(
        `
          SELECT
            rule_id, tenant_id, property_id,
            tier_name, tier_rank, display_name,
            min_nights, min_stays, min_points, min_spend,
            qualification_period_months,
            points_per_dollar, bonus_multiplier, points_expiry_months,
            benefits, welcome_bonus_points,
            is_active,
            created_at, updated_at, created_by, updated_by
          FROM loyalty_tier_rules
          WHERE tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR property_id = $2::uuid OR property_id IS NULL)
            AND ($3::boolean IS NULL OR is_active = $3::boolean)
          ORDER BY tier_rank ASC
        `,
        [tenant_id, property_id ?? null, is_active ?? null],
      );

      return TierRulesResponseSchema.parse(rows);
    },
  );

  // -------------------------------------------------
  // LOYALTY PROGRAM BALANCE
  // -------------------------------------------------

  app.get<{
    Params: z.infer<typeof ProgramBalanceParamsSchema>;
    Querystring: z.infer<typeof ProgramBalanceQuerySchema>;
  }>(
    "/v1/loyalty/programs/:programId/balance",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.query as z.infer<typeof ProgramBalanceQuerySchema>).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: LOYALTY_TAG,
        summary: "Get loyalty program balance",
        description: "Retrieve current points balance and lifetime stats for a loyalty program",
        params: ProgramBalanceParamJsonSchema,
        querystring: schemaFromZod(ProgramBalanceQuerySchema, "ProgramBalanceQuery"),
        response: {
          200: ProgramBalanceResponseJsonSchema,
          404: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const { programId } = ProgramBalanceParamsSchema.parse(request.params);
      const { tenant_id } = ProgramBalanceQuerySchema.parse(request.query);

      const { rows } = await query(
        `
          SELECT
            program_id, guest_id, tier_name,
            COALESCE(points_balance, 0) AS points_balance,
            COALESCE(points_earned_lifetime, 0) AS points_earned_lifetime,
            COALESCE(points_redeemed_lifetime, 0) AS points_redeemed_lifetime,
            last_activity_date
          FROM guest_loyalty_programs
          WHERE tenant_id = $1::uuid
            AND program_id = $2::uuid
            AND COALESCE(is_deleted, false) = false
        `,
        [tenant_id, programId],
      );

      if (rows.length === 0) {
        return reply.notFound("Loyalty program not found");
      }

      return ProgramBalanceResponseSchema.parse(rows[0]);
    },
  );
};
