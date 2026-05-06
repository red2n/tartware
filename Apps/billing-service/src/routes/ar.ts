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
};
