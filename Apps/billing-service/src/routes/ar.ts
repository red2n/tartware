/**
 * AR (Accounts Receivable) read endpoints — ARA Sprint 1.
 *
 * Provides read-only access to:
 *   - AR accounts (city ledger accounts per company / travel agent)
 *   - City ledger entries per AR account
 *   - Aging snapshots
 *   - Suspense folio items
 *   - Group billing summaries
 */
import { buildRouteSchema } from "@tartware/openapi";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { query } from "../lib/db.js";

const AR_TAG = "Accounts Receivable";

export const registerArRoutes = (app: FastifyInstance): void => {
  // ── AR Accounts ─────────────────────────────────────────────────────────────

  const ArAccountListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });
  type ArAccountListQuery = z.infer<typeof ArAccountListQuerySchema>;

  app.get<{ Querystring: ArAccountListQuery }>(
    "/v1/billing/ar/accounts",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ArAccountListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: AR_TAG,
        summary: "List AR accounts",
      }),
    },
    async (request) => {
      const q = ArAccountListQuerySchema.parse(request.query);
      const { rows } = await query(
        `SELECT ar_account_id, account_number, company_name, contact_name, contact_email,
                credit_limit, outstanding_balance, available_credit, payment_terms, currency,
                account_status, dunning_level, created_at
           FROM ar_accounts
          WHERE tenant_id = $1::uuid
            AND ($2::uuid IS NULL OR property_id = $2::uuid)
            AND ($3::text IS NULL OR account_status = $3::text)
            AND is_deleted = FALSE
          ORDER BY company_name ASC
          LIMIT $4 OFFSET $5`,
        [q.tenant_id, q.property_id ?? null, q.status ?? null, q.limit, q.offset],
      );
      return { data: rows, limit: q.limit, offset: q.offset };
    },
  );

  // ── City Ledger (per account) ────────────────────────────────────────────────

  const CityLedgerQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    status: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });
  type CityLedgerQuery = z.infer<typeof CityLedgerQuerySchema>;

  app.get<{ Params: { accountId: string }; Querystring: CityLedgerQuery }>(
    "/v1/billing/ar/accounts/:accountId/statement",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as CityLedgerQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: AR_TAG,
        summary: "City ledger statement for an AR account",
      }),
    },
    async (request) => {
      const q = CityLedgerQuerySchema.parse(request.query);
      const { accountId } = request.params;
      const { rows } = await query(
        `SELECT cl.entry_id, cl.entry_number, cl.transfer_date, cl.due_date,
                cl.original_amount, cl.outstanding_balance, cl.currency,
                cl.entry_status, cl.aging_bucket, cl.days_outstanding,
                cl.folio_id, cl.reservation_id, cl.invoice_id,
                cl.write_off_reason, cl.written_off_at
           FROM ar_city_ledger cl
          WHERE cl.tenant_id = $1::uuid
            AND cl.ar_account_id = $2::uuid
            AND ($3::uuid IS NULL OR cl.property_id = $3::uuid)
            AND ($4::text IS NULL OR cl.entry_status = $4::text)
          ORDER BY cl.transfer_date DESC
          LIMIT $5 OFFSET $6`,
        [q.tenant_id, accountId, q.property_id ?? null, q.status ?? null, q.limit, q.offset],
      );
      return { ar_account_id: accountId, data: rows, limit: q.limit, offset: q.offset };
    },
  );

  // ── Aging Report ─────────────────────────────────────────────────────────────

  const AgingReportQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid(),
    snapshot_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  });
  type AgingReportQuery = z.infer<typeof AgingReportQuerySchema>;

  app.get<{ Querystring: AgingReportQuery }>(
    "/v1/billing/ar/aging-report",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as AgingReportQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: AR_TAG,
        summary: "AR aging report — aggregated by account and aging bucket",
      }),
    },
    async (request) => {
      const q = AgingReportQuerySchema.parse(request.query);
      const { rows } = await query(
        `SELECT s.ar_account_id, a.company_name, a.account_number,
                s.snapshot_date,
                s.current_amount, s.bucket_1_30, s.bucket_31_60,
                s.bucket_61_90, s.bucket_91_120, s.bucket_over_120,
                s.total_outstanding, s.currency
           FROM ar_aging_snapshots s
           JOIN ar_accounts a ON a.ar_account_id = s.ar_account_id
          WHERE s.tenant_id = $1::uuid
            AND s.property_id = $2::uuid
            AND s.snapshot_date = COALESCE($3::date, CURRENT_DATE)
          ORDER BY s.total_outstanding DESC`,
        [q.tenant_id, q.property_id, q.snapshot_date ?? null],
      );
      return { snapshot_date: q.snapshot_date ?? "today", data: rows };
    },
  );

  // ── Suspense Items ────────────────────────────────────────────────────────────

  const SuspenseQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  });
  type SuspenseQuery = z.infer<typeof SuspenseQuerySchema>;

  app.get<{ Querystring: SuspenseQuery }>(
    "/v1/billing/suspense-items",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as SuspenseQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: AR_TAG,
        summary: "List unresolved charge postings on the suspense folio",
      }),
    },
    async (request) => {
      const q = SuspenseQuerySchema.parse(request.query);
      const { rows } = await query(
        `SELECT cp.posting_id, cp.charge_code, cp.charge_description,
                cp.total_amount, cp.currency_code, cp.posting_date,
                cp.notes, cp.created_at, cp.created_by
           FROM charge_postings cp
           JOIN folios f ON f.folio_id = cp.folio_id
          WHERE cp.tenant_id = $1::uuid
            AND cp.property_id = $2::uuid
            AND f.folio_type = 'SUSPENSE'
            AND cp.posting_type != 'VOID'
            AND f.folio_status = 'OPEN'
          ORDER BY cp.posting_date DESC, cp.created_at DESC
          LIMIT $3 OFFSET $4`,
        [q.tenant_id, q.property_id, q.limit, q.offset],
      );
      return { data: rows, limit: q.limit, offset: q.offset };
    },
  );

  // ── Group Billing Summary ─────────────────────────────────────────────────────

  const GroupSummaryQuerySchema = z.object({
    tenant_id: z.string().uuid(),
  });
  type GroupSummaryQuery = z.infer<typeof GroupSummaryQuerySchema>;

  app.get<{ Params: { groupId: string }; Querystring: GroupSummaryQuery }>(
    "/v1/billing/groups/:groupId/summary",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GroupSummaryQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: AR_TAG,
        summary: "Group billing summary — master folio + per-reservation folios",
      }),
    },
    async (request) => {
      const q = GroupSummaryQuerySchema.parse(request.query);
      const { groupId } = request.params;

      const { rows: masterRows } = await query(
        `SELECT folio_id, folio_number, folio_status, balance, currency_code
           FROM folios
          WHERE tenant_id = $1::uuid AND group_booking_id = $2::uuid AND folio_type = 'MASTER'
          LIMIT 1`,
        [q.tenant_id, groupId],
      );

      const { rows: reservationRows } = await query(
        `SELECT r.reservation_id, r.confirmation_number, r.guest_name,
                f.folio_id, f.folio_number, f.folio_status, f.balance, f.currency_code
           FROM reservations r
           LEFT JOIN folios f ON f.reservation_id = r.reservation_id
             AND f.tenant_id = r.tenant_id AND f.folio_type = 'INDIVIDUAL'
          WHERE r.tenant_id = $1::uuid AND r.group_booking_id = $2::uuid
          ORDER BY r.confirmation_number`,
        [q.tenant_id, groupId],
      );

      return {
        group_booking_id: groupId,
        master_folio: masterRows[0] ?? null,
        reservations: reservationRows,
      };
    },
  );

  // ── DSO — Days Sales Outstanding ─────────────────────────────────────────────

  const DsoQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid(),
    days: z.coerce.number().int().positive().max(365).default(90),
  });
  type DsoQuery = z.infer<typeof DsoQuerySchema>;

  app.get<{ Querystring: DsoQuery }>(
    "/v1/billing/ar/dso",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DsoQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: AR_TAG,
        summary: "Days Sales Outstanding (DSO) — AR health KPI",
      }),
    },
    async (request) => {
      const q = DsoQuerySchema.parse(request.query);
      // total_outstanding from latest aging snapshot
      const { rows: balanceRows } = await query<{ total_outstanding: string }>(
        `SELECT SUM(total_outstanding) AS total_outstanding
           FROM ar_aging_snapshots
          WHERE tenant_id = $1::uuid AND property_id = $2::uuid
            AND snapshot_date = (
              SELECT MAX(snapshot_date) FROM ar_aging_snapshots
              WHERE tenant_id = $1::uuid AND property_id = $2::uuid
            )`,
        [q.tenant_id, q.property_id],
      );
      // avg daily revenue over rolling window from GL journal entries
      const { rows: revenueRows } = await query<{ avg_daily_revenue: string }>(
        `SELECT COALESCE(
            SUM(amount) / NULLIF($3::int, 0), 0
          ) AS avg_daily_revenue
           FROM gl_journal_entries
          WHERE tenant_id = $1::uuid AND property_id = $2::uuid
            AND posting_date >= CURRENT_DATE - ($3::int || ' days')::interval
            AND account_number LIKE '4%'
            AND debit_credit = 'CREDIT'`,
        [q.tenant_id, q.property_id, q.days],
      );
      const totalOutstanding = Number(balanceRows[0]?.total_outstanding ?? 0);
      const avgDailyRevenue = Number(revenueRows[0]?.avg_daily_revenue ?? 0);
      const dso = avgDailyRevenue > 0 ? (totalOutstanding / avgDailyRevenue) * q.days : null;
      return {
        property_id: q.property_id,
        window_days: q.days,
        total_outstanding: totalOutstanding,
        avg_daily_revenue: avgDailyRevenue,
        dso: dso !== null ? Number(dso.toFixed(2)) : null,
        note: dso === null ? "Insufficient revenue data to compute DSO" : undefined,
      };
    },
  );

  // ── Collection Rate ────────────────────────────────────────────────────────

  const CollectionRateQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid(),
    period_days: z.coerce.number().int().positive().max(365).default(30),
  });
  type CollectionRateQuery = z.infer<typeof CollectionRateQuerySchema>;

  app.get<{ Querystring: CollectionRateQuery }>(
    "/v1/billing/ar/collection-rate",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as CollectionRateQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: AR_TAG,
        summary: "Collection rate — % of AR collected within payment terms in a given period",
      }),
    },
    async (request) => {
      const q = CollectionRateQuerySchema.parse(request.query);
      const { rows } = await query<{
        total_invoiced: string;
        collected_within_terms: string;
        late_collected: string;
        uncollected: string;
      }>(
        `SELECT
            SUM(original_amount)                                                 AS total_invoiced,
            SUM(CASE WHEN entry_status = 'PAID'
                      AND written_off_at IS NULL
                      AND due_date >= transfer_date   THEN original_amount ELSE 0 END) AS collected_within_terms,
            SUM(CASE WHEN entry_status = 'PAID'
                      AND due_date < transfer_date    THEN original_amount ELSE 0 END) AS late_collected,
            SUM(CASE WHEN entry_status IN ('OPEN','PARTIAL','DISPUTED')          THEN outstanding_balance ELSE 0 END) AS uncollected
           FROM ar_city_ledger
          WHERE tenant_id = $1::uuid AND property_id = $2::uuid
            AND transfer_date >= CURRENT_DATE - ($3::int || ' days')::interval`,
        [q.tenant_id, q.property_id, q.period_days],
      );
      const row = rows[0];
      const totalInvoiced = Number(row?.total_invoiced ?? 0);
      const withinTerms = Number(row?.collected_within_terms ?? 0);
      const collectionRate = totalInvoiced > 0 ? (withinTerms / totalInvoiced) * 100 : null;
      return {
        property_id: q.property_id,
        period_days: q.period_days,
        total_invoiced: totalInvoiced,
        collected_within_terms: withinTerms,
        late_collected: Number(row?.late_collected ?? 0),
        uncollected: Number(row?.uncollected ?? 0),
        collection_rate_pct: collectionRate !== null ? Number(collectionRate.toFixed(2)) : null,
      };
    },
  );

  // ── Dunning Effectiveness ────────────────────────────────────────────────────

  const DunningEffectivenessQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid(),
    period_days: z.coerce.number().int().positive().max(365).default(90),
  });
  type DunningEffectivenessQuery = z.infer<typeof DunningEffectivenessQuerySchema>;

  app.get<{ Querystring: DunningEffectivenessQuery }>(
    "/v1/billing/ar/dunning-effectiveness",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DunningEffectivenessQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: AR_TAG,
        summary: "Dunning effectiveness — actions taken vs amount recovered per bucket",
      }),
    },
    async (request) => {
      const q = DunningEffectivenessQuerySchema.parse(request.query);
      const { rows } = await query<{
        event_type: string;
        actions_taken: string;
        accounts_affected: string;
      }>(
        `SELECT
            event_type,
            COUNT(*)                     AS actions_taken,
            COUNT(DISTINCT ar_account_id) AS accounts_affected
           FROM ar_dunning_events
          WHERE tenant_id = $1::uuid AND property_id = $2::uuid
            AND created_at >= NOW() - ($3::int || ' days')::interval
          GROUP BY event_type
          ORDER BY actions_taken DESC`,
        [q.tenant_id, q.property_id, q.period_days],
      );
      return {
        property_id: q.property_id,
        period_days: q.period_days,
        by_event_type: rows.map((r) => ({
          event_type: r.event_type,
          actions_taken: Number(r.actions_taken),
          accounts_affected: Number(r.accounts_affected),
        })),
      };
    },
  );

  // ── Risk Score per AR Account ─────────────────────────────────────────────────

  const RiskScoreQuerySchema = z.object({
    tenant_id: z.string().uuid(),
  });
  type RiskScoreQuery = z.infer<typeof RiskScoreQuerySchema>;

  app.get<{ Params: { accountId: string }; Querystring: RiskScoreQuery }>(
    "/v1/billing/ar/accounts/:accountId/risk-score",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as RiskScoreQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: AR_TAG,
        summary: "Composite risk score for an AR account",
      }),
    },
    async (request) => {
      const q = RiskScoreQuerySchema.parse(request.query);
      const { accountId } = request.params;

      // Fetch account summary
      const { rows: accountRows } = await query<{
        company_name: string;
        outstanding_balance: string;
        dunning_level: number;
        account_status: string;
      }>(
        `SELECT company_name, outstanding_balance, dunning_level, account_status
           FROM ar_accounts
          WHERE ar_account_id = $1::uuid AND tenant_id = $2::uuid AND is_deleted = FALSE`,
        [accountId, q.tenant_id],
      );
      const account = accountRows[0];
      if (!account) {
        return request.server.httpErrors
          ? request.server.httpErrors.notFound(`AR account ${accountId} not found`)
          : { error: "NOT_FOUND" };
      }

      // Aging from latest snapshot
      const { rows: agingRows } = await query<{
        bucket_over_120: string;
        bucket_91_120: string;
        total_outstanding: string;
      }>(
        `SELECT bucket_over_120, bucket_91_120, total_outstanding
           FROM ar_aging_snapshots
          WHERE ar_account_id = $1::uuid AND tenant_id = $2::uuid
          ORDER BY snapshot_date DESC LIMIT 1`,
        [accountId, q.tenant_id],
      );
      const aging = agingRows[0];

      // Open disputes
      const { rows: disputeRows } = await query<{ open_disputes: string }>(
        `SELECT COUNT(*) AS open_disputes FROM ar_disputes
          WHERE ar_account_id = $1::uuid AND tenant_id = $2::uuid
            AND dispute_status IN ('OPEN', 'UNDER_REVIEW')`,
        [accountId, q.tenant_id],
      );
      const openDisputes = Number(disputeRows[0]?.open_disputes ?? 0);

      // Risk score formula (0–100, higher = more risk):
      //   - dunning_level (0–3) × 15 pts max
      //   - over-120 bucket as % of total × 40 pts max
      //   - open disputes × 10 pts each (capped at 30 pts)
      //   - account_status COLLECTIONS = +15 pts
      const dunningScore = (account.dunning_level ?? 0) * 15;
      const total = Number(aging?.total_outstanding ?? 0);
      const over120 = Number(aging?.bucket_over_120 ?? 0) + Number(aging?.bucket_91_120 ?? 0);
      const agingScore = total > 0 ? (over120 / total) * 40 : 0;
      const disputeScore = Math.min(openDisputes * 10, 30);
      const statusScore = account.account_status === "COLLECTIONS" ? 15 : 0;
      const riskScore = Math.min(
        Math.round(dunningScore + agingScore + disputeScore + statusScore),
        100,
      );

      const riskBand = riskScore >= 70 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";

      return {
        ar_account_id: accountId,
        company_name: account.company_name,
        risk_score: riskScore,
        risk_band: riskBand,
        components: {
          dunning_level: account.dunning_level ?? 0,
          dunning_score: Math.round(dunningScore),
          aging_90plus_pct: total > 0 ? Number(((over120 / total) * 100).toFixed(1)) : 0,
          aging_score: Math.round(agingScore),
          open_disputes: openDisputes,
          dispute_score: disputeScore,
          account_status: account.account_status,
          status_score: statusScore,
        },
        outstanding_balance: Number(account.outstanding_balance),
      };
    },
  );
};
