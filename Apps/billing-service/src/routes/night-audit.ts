import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  BusinessDateStatusResponseSchema,
  NightAuditRunDetailResponseSchema,
  NightAuditRunListResponseSchema,
  UpsertBusinessDateBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { query } from "../lib/db.js";

const NIGHT_AUDIT_TAG = "Night Audit";

// ── Query schemas (route-local, allowed per AGENTS.md) ──

const NightAuditStatusQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
});

type NightAuditStatusQuery = z.infer<typeof NightAuditStatusQuerySchema>;

const NightAuditHistoryQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

type NightAuditHistoryQuery = z.infer<typeof NightAuditHistoryQuerySchema>;

const RunDetailParamsSchema = z.object({
  runId: z.string().uuid(),
});

type RunDetailParams = z.infer<typeof RunDetailParamsSchema>;

const RunDetailQuerySchema = z.object({
  tenant_id: z.string().uuid(),
});

type RunDetailQuery = z.infer<typeof RunDetailQuerySchema>;

// ── JSON schemas for OpenAPI docs ──

const StatusQueryJsonSchema = schemaFromZod(NightAuditStatusQuerySchema, "NightAuditStatusQuery");
const StatusResponseJsonSchema = schemaFromZod(
  z.object({ data: BusinessDateStatusResponseSchema }),
  "NightAuditStatusResponse",
);

const HistoryQueryJsonSchema = schemaFromZod(
  NightAuditHistoryQuerySchema,
  "NightAuditHistoryQuery",
);
const HistoryResponseJsonSchema = schemaFromZod(
  NightAuditRunListResponseSchema,
  "NightAuditHistoryResponse",
);

const RunDetailParamsJsonSchema = schemaFromZod(RunDetailParamsSchema, "RunDetailParams");
const RunDetailQueryJsonSchema = schemaFromZod(RunDetailQuerySchema, "RunDetailQuery");
const RunDetailResponseJsonSchema = schemaFromZod(
  z.object({ data: NightAuditRunDetailResponseSchema }),
  "NightAuditRunDetailResponse",
);

export const registerNightAuditRoutes = (app: FastifyInstance): void => {
  // ==========================================================================
  // GET /v1/night-audit/status — current business date status for a property
  // ==========================================================================
  app.get<{ Querystring: NightAuditStatusQuery }>(
    "/v1/night-audit/status",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as NightAuditStatusQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: NIGHT_AUDIT_TAG,
        summary: "Get current business date status for a property",
        description:
          "Returns the current business date, audit status, posting locks, and daily statistics",
        querystring: StatusQueryJsonSchema,
        response: { 200: StatusResponseJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id } = NightAuditStatusQuerySchema.parse(request.query);

      const result = await query<{
        business_date_id: string;
        tenant_id: string;
        property_id: string;
        business_date: string;
        system_date: string;
        date_status: string;
        night_audit_status: string | null;
        night_audit_started_at: string | null;
        night_audit_completed_at: string | null;
        is_locked: boolean;
        allow_postings: boolean;
        allow_check_ins: boolean;
        allow_check_outs: boolean;
        arrivals_count: number | null;
        departures_count: number | null;
        stayovers_count: number | null;
        total_revenue: string | null;
        audit_errors: number | null;
        audit_warnings: number | null;
        is_reconciled: boolean | null;
        notes: string | null;
      }>(
        `SELECT
           bd.business_date_id,
           bd.tenant_id,
           bd.property_id,
           bd.business_date::text,
           bd.system_date::text,
           bd.date_status,
           bd.night_audit_status,
           bd.night_audit_started_at::text,
           bd.night_audit_completed_at::text,
           COALESCE(bd.is_locked, false) AS is_locked,
           COALESCE(bd.allow_postings, true) AS allow_postings,
           COALESCE(bd.allow_check_ins, true) AS allow_check_ins,
           COALESCE(bd.allow_check_outs, true) AS allow_check_outs,
           bd.arrivals_count,
           bd.departures_count,
           bd.stayovers_count,
           bd.total_revenue::text,
           bd.audit_errors,
           bd.audit_warnings,
           COALESCE(bd.is_reconciled, false) AS is_reconciled,
           bd.notes
         FROM public.business_dates bd
         WHERE bd.tenant_id = $1 AND bd.property_id = $2
           AND COALESCE(bd.is_deleted, false) = false
         ORDER BY bd.business_date DESC
         LIMIT 1`,
        [tenant_id, property_id],
      );

      const row = result.rows[0];
      if (!row) {
        return {
          data: {
            business_date_id: "00000000-0000-0000-0000-000000000000",
            tenant_id,
            property_id,
            business_date: new Date().toISOString().slice(0, 10),
            system_date: new Date().toISOString().slice(0, 10),
            date_status: "OPEN",
            date_status_display: "Open",
            is_locked: false,
            allow_postings: true,
            allow_check_ins: true,
            allow_check_outs: true,
          },
        };
      }

      // Fetch property name
      const propResult = await query<{ property_name: string }>(
        `SELECT property_name FROM public.properties WHERE id = $1 LIMIT 1`,
        [property_id],
      );

      const dateStatusDisplay = formatStatus(row.date_status);
      const nightAuditStatusDisplay = row.night_audit_status
        ? formatStatus(row.night_audit_status)
        : undefined;

      return {
        data: {
          business_date_id: row.business_date_id,
          tenant_id: row.tenant_id,
          property_id: row.property_id,
          property_name: propResult.rows[0]?.property_name,
          business_date: row.business_date,
          system_date: row.system_date,
          date_status: row.date_status,
          date_status_display: dateStatusDisplay,
          night_audit_status: row.night_audit_status ?? undefined,
          night_audit_status_display: nightAuditStatusDisplay,
          night_audit_started_at: row.night_audit_started_at ?? undefined,
          night_audit_completed_at: row.night_audit_completed_at ?? undefined,
          is_locked: row.is_locked,
          allow_postings: row.allow_postings,
          allow_check_ins: row.allow_check_ins,
          allow_check_outs: row.allow_check_outs,
          arrivals_count: row.arrivals_count ?? undefined,
          departures_count: row.departures_count ?? undefined,
          stayovers_count: row.stayovers_count ?? undefined,
          total_revenue: row.total_revenue ?? undefined,
          audit_errors: row.audit_errors ?? undefined,
          audit_warnings: row.audit_warnings ?? undefined,
          is_reconciled: row.is_reconciled ?? undefined,
          notes: row.notes ?? undefined,
        },
      };
    },
  );

  // ==========================================================================
  // GET /v1/night-audit/history — list of night audit runs
  // ==========================================================================
  app.get<{ Querystring: NightAuditHistoryQuery }>(
    "/v1/night-audit/history",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as NightAuditHistoryQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: NIGHT_AUDIT_TAG,
        summary: "List night audit run history",
        description: "Returns past audit runs with summary statistics, ordered by most recent",
        querystring: HistoryQueryJsonSchema,
        response: { 200: HistoryResponseJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, limit, offset } = NightAuditHistoryQuerySchema.parse(
        request.query,
      );

      const conditions = ["nal.tenant_id = $1", "COALESCE(nal.is_deleted, false) = false"];
      const params: (string | number)[] = [tenant_id];
      let paramIdx = 2;

      if (property_id) {
        conditions.push(`nal.property_id = $${paramIdx}`);
        params.push(property_id);
        paramIdx++;
      }

      const whereClause = conditions.join(" AND ");

      // Group by audit_run_id to get one row per run (the log has one row per step)
      const result = await query<{
        audit_run_id: string;
        tenant_id: string;
        property_id: string;
        business_date: string;
        next_business_date: string | null;
        audit_status: string;
        execution_mode: string | null;
        is_test_run: boolean | null;
        started_at: string;
        completed_at: string | null;
        duration_seconds: number | null;
        total_steps: number;
        steps_completed: number;
        steps_failed: number;
        error_count: number;
        warning_count: number;
        is_successful: boolean | null;
        requires_attention: boolean | null;
        is_acknowledged: boolean | null;
        initiated_by: string;
        initiated_by_name: string | null;
        occupancy_percent: string | null;
        adr: string | null;
        revpar: string | null;
        total_revenue: string | null;
        total_rooms_sold: number | null;
      }>(
        `SELECT
           nal.audit_run_id,
           nal.tenant_id,
           nal.property_id,
           nal.business_date::text,
           nal.next_business_date::text,
           MAX(nal.audit_status) AS audit_status,
           MAX(nal.execution_mode) AS execution_mode,
           BOOL_OR(COALESCE(nal.is_test_run, false)) AS is_test_run,
           MIN(nal.started_at)::text AS started_at,
           MAX(nal.completed_at)::text AS completed_at,
           MAX(nal.duration_seconds) AS duration_seconds,
           COUNT(*)::int AS total_steps,
           COUNT(*) FILTER (WHERE nal.step_status = 'COMPLETED')::int AS steps_completed,
           COUNT(*) FILTER (WHERE nal.step_status = 'FAILED')::int AS steps_failed,
           COALESCE(SUM(nal.error_count), 0)::int AS error_count,
           COALESCE(SUM(nal.warning_count), 0)::int AS warning_count,
           BOOL_AND(COALESCE(nal.is_successful, true)) AS is_successful,
           BOOL_OR(COALESCE(nal.requires_attention, false)) AS requires_attention,
           BOOL_AND(COALESCE(nal.is_acknowledged, false)) AS is_acknowledged,
           nal.initiated_by,
           MAX(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, ''))) AS initiated_by_name,
           MAX(nal.occupancy_percent)::text AS occupancy_percent,
           MAX(nal.adr)::text AS adr,
           MAX(nal.revpar)::text AS revpar,
           MAX(nal.total_revenue)::text AS total_revenue,
           MAX(nal.total_rooms_sold) AS total_rooms_sold
         FROM public.night_audit_log nal
         LEFT JOIN public.users u ON u.id = nal.initiated_by
         WHERE ${whereClause}
         GROUP BY nal.audit_run_id, nal.tenant_id, nal.property_id,
                  nal.business_date, nal.next_business_date, nal.initiated_by
         ORDER BY MIN(nal.started_at) DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset],
      );

      // Count total runs
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT audit_run_id)::text AS count
         FROM public.night_audit_log nal
         WHERE ${whereClause}`,
        params,
      );

      const data = result.rows.map((row) => ({
        audit_run_id: row.audit_run_id,
        tenant_id: row.tenant_id,
        property_id: row.property_id,
        business_date: row.business_date,
        next_business_date: row.next_business_date ?? undefined,
        audit_status: row.audit_status,
        audit_status_display: formatStatus(row.audit_status),
        execution_mode: row.execution_mode ?? undefined,
        execution_mode_display: row.execution_mode ? formatStatus(row.execution_mode) : undefined,
        is_test_run: row.is_test_run ?? undefined,
        started_at: row.started_at,
        completed_at: row.completed_at ?? undefined,
        duration_seconds: row.duration_seconds ?? undefined,
        total_steps: row.total_steps,
        steps_completed: row.steps_completed,
        steps_failed: row.steps_failed,
        error_count: row.error_count,
        warning_count: row.warning_count,
        is_successful: row.is_successful ?? undefined,
        requires_attention: row.requires_attention ?? undefined,
        is_acknowledged: row.is_acknowledged ?? undefined,
        initiated_by: row.initiated_by,
        initiated_by_name: row.initiated_by_name ?? undefined,
        occupancy_percent: row.occupancy_percent ?? undefined,
        adr: row.adr ?? undefined,
        revpar: row.revpar ?? undefined,
        total_revenue: row.total_revenue ?? undefined,
        total_rooms_sold: row.total_rooms_sold ?? undefined,
      }));

      return {
        data,
        meta: { count: Number(countResult.rows[0]?.count ?? 0) },
      };
    },
  );

  // ==========================================================================
  // GET /v1/night-audit/runs/:runId — detailed audit run with step breakdown
  // ==========================================================================
  app.get<{ Params: RunDetailParams; Querystring: RunDetailQuery }>(
    "/v1/night-audit/runs/:runId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as RunDetailQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: NIGHT_AUDIT_TAG,
        summary: "Get detailed night audit run with step-level breakdown",
        description:
          "Returns full audit run details including each step's status, records processed, and any errors",
        params: RunDetailParamsJsonSchema,
        querystring: RunDetailQueryJsonSchema,
        response: { 200: RunDetailResponseJsonSchema },
      }),
    },
    async (request) => {
      const { runId } = RunDetailParamsSchema.parse(request.params);
      const { tenant_id } = RunDetailQuerySchema.parse(request.query);

      // Fetch all steps for this run
      const result = await query<{
        audit_run_id: string;
        tenant_id: string;
        property_id: string;
        business_date: string;
        next_business_date: string | null;
        audit_status: string;
        execution_mode: string | null;
        is_test_run: boolean | null;
        started_at: string;
        completed_at: string | null;
        duration_seconds: number | null;
        step_number: number;
        step_name: string;
        step_category: string | null;
        step_status: string;
        step_started_at: string | null;
        step_completed_at: string | null;
        step_duration_ms: number | null;
        records_processed: number | null;
        records_succeeded: number | null;
        records_failed: number | null;
        records_skipped: number | null;
        amount_posted: string | null;
        transactions_created: number | null;
        error_count: number | null;
        warning_count: number | null;
        error_message: string | null;
        is_successful: boolean | null;
        requires_attention: boolean | null;
        is_acknowledged: boolean | null;
        initiated_by: string;
        initiated_by_name: string | null;
        occupancy_percent: string | null;
        adr: string | null;
        revpar: string | null;
        total_revenue: string | null;
        total_rooms_sold: number | null;
        reports_generated: string[] | null;
        actions_taken: string[] | null;
        notes: string | null;
        resolution_notes: string | null;
      }>(
        `SELECT
           nal.audit_run_id,
           nal.tenant_id,
           nal.property_id,
           nal.business_date::text,
           nal.next_business_date::text,
           nal.audit_status,
           nal.execution_mode,
           nal.is_test_run,
           nal.started_at::text,
           nal.completed_at::text,
           nal.duration_seconds,
           nal.step_number,
           nal.step_name,
           nal.step_category,
           nal.step_status,
           nal.step_started_at::text,
           nal.step_completed_at::text,
           nal.step_duration_ms,
           nal.records_processed,
           nal.records_succeeded,
           nal.records_failed,
           nal.records_skipped,
           nal.amount_posted::text,
           nal.transactions_created,
           nal.error_count,
           nal.warning_count,
           nal.error_message,
           nal.is_successful,
           nal.requires_attention,
           nal.is_acknowledged,
           nal.initiated_by,
           TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS initiated_by_name,
           nal.occupancy_percent::text,
           nal.adr::text,
           nal.revpar::text,
           nal.total_revenue::text,
           nal.total_rooms_sold,
           nal.reports_generated,
           nal.actions_taken,
           nal.notes,
           nal.resolution_notes
         FROM public.night_audit_log nal
         LEFT JOIN public.users u ON u.id = nal.initiated_by
         WHERE nal.audit_run_id = $1 AND nal.tenant_id = $2
           AND COALESCE(nal.is_deleted, false) = false
         ORDER BY nal.step_number ASC`,
        [runId, tenant_id],
      );

      if (result.rows.length === 0) {
        throw app.httpErrors.notFound(`Audit run ${runId} not found`);
      }

      // Build the run summary from the first row, steps from all rows
      // biome-ignore lint: row existence is guaranteed by the length check above
      const first = result.rows[0]!;
      const steps = result.rows.map((r) => ({
        step_number: r.step_number,
        step_name: r.step_name,
        step_category: r.step_category ?? undefined,
        step_status: r.step_status,
        step_status_display: formatStatus(r.step_status),
        step_started_at: r.step_started_at ?? undefined,
        step_completed_at: r.step_completed_at ?? undefined,
        step_duration_ms: r.step_duration_ms ?? undefined,
        records_processed: r.records_processed ?? undefined,
        records_succeeded: r.records_succeeded ?? undefined,
        records_failed: r.records_failed ?? undefined,
        records_skipped: r.records_skipped ?? undefined,
        amount_posted: r.amount_posted ?? undefined,
        transactions_created: r.transactions_created ?? undefined,
        error_count: r.error_count ?? undefined,
        warning_count: r.warning_count ?? undefined,
        error_message: r.error_message ?? undefined,
      }));

      return {
        data: {
          audit_run_id: first.audit_run_id,
          tenant_id: first.tenant_id,
          property_id: first.property_id,
          business_date: first.business_date,
          next_business_date: first.next_business_date ?? undefined,
          audit_status: first.audit_status,
          audit_status_display: formatStatus(first.audit_status),
          execution_mode: first.execution_mode ?? undefined,
          execution_mode_display: first.execution_mode
            ? formatStatus(first.execution_mode)
            : undefined,
          is_test_run: first.is_test_run ?? undefined,
          started_at: first.started_at,
          completed_at: first.completed_at ?? undefined,
          duration_seconds: first.duration_seconds ?? undefined,
          total_steps: result.rows.length,
          steps_completed: steps.filter((s) => s.step_status === "COMPLETED").length,
          steps_failed: steps.filter((s) => s.step_status === "FAILED").length,
          error_count: steps.reduce((sum, s) => sum + (s.error_count ?? 0), 0),
          warning_count: steps.reduce((sum, s) => sum + (s.warning_count ?? 0), 0),
          is_successful: first.is_successful ?? undefined,
          requires_attention: first.requires_attention ?? undefined,
          is_acknowledged: first.is_acknowledged ?? undefined,
          initiated_by: first.initiated_by,
          initiated_by_name: first.initiated_by_name ?? undefined,
          occupancy_percent: first.occupancy_percent ?? undefined,
          adr: first.adr ?? undefined,
          revpar: first.revpar ?? undefined,
          total_revenue: first.total_revenue ?? undefined,
          total_rooms_sold: first.total_rooms_sold ?? undefined,
          steps,
          reports_generated: first.reports_generated ?? undefined,
          actions_taken: first.actions_taken ?? undefined,
          notes: first.notes ?? undefined,
          resolution_notes: first.resolution_notes ?? undefined,
        },
      };
    },
  );

  // ==========================================================================
  // PUT /v1/night-audit/business-date — upsert a business date for a property
  // ==========================================================================

  const UpsertBodyJsonSchema = schemaFromZod(
    UpsertBusinessDateBodySchema,
    "UpsertBusinessDateBody",
  );
  const UpsertResponseJsonSchema = schemaFromZod(
    z.object({ data: BusinessDateStatusResponseSchema }),
    "UpsertBusinessDateResponse",
  );

  type UpsertBusinessDateBody = z.infer<typeof UpsertBusinessDateBodySchema>;

  app.put<{ Body: UpsertBusinessDateBody }>(
    "/v1/night-audit/business-date",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as UpsertBusinessDateBody).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: NIGHT_AUDIT_TAG,
        summary: "Upsert a business date for a property",
        description:
          "Creates or updates the business date record for a property. Used for initial setup and date management.",
        body: UpsertBodyJsonSchema,
        response: { 200: UpsertResponseJsonSchema },
      }),
    },
    async (request) => {
      const body = UpsertBusinessDateBodySchema.parse(request.body);

      const result = await query<{
        business_date_id: string;
        tenant_id: string;
        property_id: string;
        business_date: string;
        system_date: string;
        date_status: string;
        night_audit_status: string | null;
        is_locked: boolean;
        allow_postings: boolean;
        allow_check_ins: boolean;
        allow_check_outs: boolean;
      }>(
        `INSERT INTO public.business_dates
           (tenant_id, property_id, business_date, date_status, night_audit_status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, property_id, business_date)
         DO UPDATE SET
           date_status = EXCLUDED.date_status,
           night_audit_status = EXCLUDED.night_audit_status,
           updated_at = NOW()
         RETURNING
           business_date_id,
           tenant_id,
           property_id,
           business_date::text,
           system_date::text,
           date_status,
           night_audit_status,
           COALESCE(is_locked, false) AS is_locked,
           COALESCE(allow_postings, true) AS allow_postings,
           COALESCE(allow_check_ins, true) AS allow_check_ins,
           COALESCE(allow_check_outs, true) AS allow_check_outs`,
        [
          body.tenant_id,
          body.property_id,
          body.business_date,
          body.date_status,
          body.night_audit_status,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        throw new Error("Failed to upsert business date");
      }

      return {
        data: {
          business_date_id: row.business_date_id,
          tenant_id: row.tenant_id,
          property_id: row.property_id,
          business_date: row.business_date,
          system_date: row.system_date,
          date_status: row.date_status,
          date_status_display: formatStatus(row.date_status),
          night_audit_status: row.night_audit_status ?? undefined,
          night_audit_status_display: row.night_audit_status
            ? formatStatus(row.night_audit_status)
            : undefined,
          is_locked: row.is_locked,
          allow_postings: row.allow_postings,
          allow_check_ins: row.allow_check_ins,
          allow_check_outs: row.allow_check_outs,
        },
      };
    },
  );
};

/** Format an UPPER_SNAKE_CASE status string to Title Case for display. */
function formatStatus(status: string): string {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
