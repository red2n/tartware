import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import {
  LoyaltyPointTransactionsSchema,
  LoyaltyTierRulesSchema,
  ProgramBalanceResponseSchema,
} from "@tartware/schemas";
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

// tier_name is constrained by a CHECK on loyalty_tier_rules — keep in sync.
const TierRuleCreateBodySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().nullish(),
  tier_name: z.enum(["bronze", "silver", "gold", "platinum", "diamond", "elite"]),
  tier_rank: z.coerce.number().int().min(1),
  display_name: z.string().max(100).optional(),
  min_nights: z.coerce.number().int().min(0).default(0),
  min_stays: z.coerce.number().int().min(0).default(0),
  min_points: z.coerce.number().int().min(0).default(0),
  min_spend: z.coerce.number().min(0).default(0),
  qualification_period_months: z.coerce.number().int().min(1).default(12),
  points_per_dollar: z.coerce.number().min(0).default(1),
  bonus_multiplier: z.coerce.number().min(0).default(1),
  points_expiry_months: z.coerce.number().int().min(0).optional(),
  benefits: z.record(z.unknown()).default({}),
  welcome_bonus_points: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

type TierRuleCreateBody = z.infer<typeof TierRuleCreateBodySchema>;

const TierRuleCreateBodyJsonSchema = schemaFromZod(
  TierRuleCreateBodySchema,
  "TierRuleCreateBody",
);
const TierRuleCreateResponseJsonSchema = schemaFromZod(
  LoyaltyTierRulesSchema,
  "TierRuleCreateResponse",
);

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
// DB ROW → API SHAPE
// =====================================================

/**
 * Normalises a raw pg row to what the response schemas expect.
 *
 * node-postgres returns NUMERIC columns as strings and empty nullable columns
 * as null, while the shared table schemas use `z.number()` and `.optional()`
 * (undefined, not null). Parsing raw rows therefore 400s as soon as real data
 * exists, so every loyalty read must go through here.
 */
const normalizeRow = <T extends Record<string, unknown>>(
  row: T,
  numericFields: readonly string[],
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null) continue; // null → undefined, satisfying .optional()
    out[key] =
      numericFields.includes(key) && typeof value === "string" ? Number(value) : value;
  }
  return out;
};

const TIER_RULE_NUMERIC_FIELDS = ["min_spend", "points_per_dollar", "bonus_multiplier"] as const;
const TRANSACTION_NUMERIC_FIELDS = ["currency_value"] as const;

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

      return LoyaltyTransactionListResponseSchema.parse(
        rows.map((row) => normalizeRow(row, TRANSACTION_NUMERIC_FIELDS)),
      );
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

      return TierRulesResponseSchema.parse(
        rows.map((row) => normalizeRow(row, TIER_RULE_NUMERIC_FIELDS)),
      );
    },
  );

  // -------------------------------------------------
  // CREATE / UPSERT LOYALTY TIER RULE
  // -------------------------------------------------

  app.post<{ Body: TierRuleCreateBody }>(
    "/v1/loyalty/tier-rules",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as TierRuleCreateBody)?.tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: LOYALTY_TAG,
        summary: "Create or update a loyalty tier rule",
        description:
          "Upserts a tier qualification rule. Conflicts on the tenant/property/tier_name " +
          "unique index update the existing rule, so the call is safe to replay.",
        body: TierRuleCreateBodyJsonSchema,
        response: {
          201: TierRuleCreateResponseJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = TierRuleCreateBodySchema.parse(request.body);

      // Two partial unique indexes cover this table — one for property-scoped
      // rules and one for tenant-wide rules — so the conflict target depends on
      // whether property_id is set.
      const conflictTarget = body.property_id
        ? "(tenant_id, property_id, tier_name) WHERE property_id IS NOT NULL"
        : "(tenant_id, tier_name) WHERE property_id IS NULL";

      const { rows } = await query(
        `
          INSERT INTO loyalty_tier_rules (
            tenant_id, property_id, tier_name, tier_rank, display_name,
            min_nights, min_stays, min_points, min_spend,
            qualification_period_months, points_per_dollar, bonus_multiplier,
            points_expiry_months, benefits, welcome_bonus_points, is_active
          ) VALUES (
            $1::uuid, $2::uuid, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14::jsonb, $15, $16
          )
          ON CONFLICT ${conflictTarget} DO UPDATE SET
            tier_rank                   = EXCLUDED.tier_rank,
            display_name                = EXCLUDED.display_name,
            min_nights                  = EXCLUDED.min_nights,
            min_stays                   = EXCLUDED.min_stays,
            min_points                  = EXCLUDED.min_points,
            min_spend                   = EXCLUDED.min_spend,
            qualification_period_months = EXCLUDED.qualification_period_months,
            points_per_dollar           = EXCLUDED.points_per_dollar,
            bonus_multiplier            = EXCLUDED.bonus_multiplier,
            points_expiry_months        = EXCLUDED.points_expiry_months,
            benefits                    = EXCLUDED.benefits,
            welcome_bonus_points        = EXCLUDED.welcome_bonus_points,
            is_active                   = EXCLUDED.is_active,
            updated_at                  = NOW()
          RETURNING
            rule_id, tenant_id, property_id,
            tier_name, tier_rank, display_name,
            min_nights, min_stays, min_points, min_spend,
            qualification_period_months,
            points_per_dollar, bonus_multiplier, points_expiry_months,
            benefits, welcome_bonus_points,
            is_active,
            created_at, updated_at, created_by, updated_by
        `,
        [
          body.tenant_id,
          body.property_id ?? null,
          body.tier_name,
          body.tier_rank,
          body.display_name ?? null,
          body.min_nights,
          body.min_stays,
          body.min_points,
          body.min_spend,
          body.qualification_period_months,
          body.points_per_dollar,
          body.bonus_multiplier,
          body.points_expiry_months ?? null,
          JSON.stringify(body.benefits),
          body.welcome_bonus_points,
          body.is_active,
        ],
      );

      const [created] = rows;
      if (!created) {
        // Unreachable: the upsert always returns a row, but keeps the type honest.
        return reply.internalServerError("TIER_RULE_UPSERT_RETURNED_NO_ROW");
      }

      reply.code(201);
      return LoyaltyTierRulesSchema.parse(normalizeRow(created, TIER_RULE_NUMERIC_FIELDS));
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
