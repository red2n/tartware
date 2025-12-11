import { query } from "../lib/db.js";

export interface ProjectionSummary {
  totalRows: number;
  averageLagSeconds: number;
  maxLagSeconds: number;
  staleOver5Minutes: number;
  staleOver15Minutes: number;
}

export interface ProjectionRowInsight {
  id: string;
  tenant_id: string;
  property_id: string;
  status: string | null;
  last_event_type: string | null;
  last_event_timestamp: string | null;
  lag_seconds: number | null;
  last_refreshed_at: string | null;
}

export interface ProjectionMonitorResponse {
  summary: ProjectionSummary;
  topLagging: ProjectionRowInsight[];
}

const SUMMARY_SQL = `
  SELECT
    COUNT(*)::int AS total_rows,
    COALESCE(AVG(lag_seconds), 0)::double precision AS avg_lag_seconds,
    COALESCE(MAX(lag_seconds), 0)::double precision AS max_lag_seconds,
    COUNT(*) FILTER (WHERE lag_seconds > 300)::int AS stale_5m,
    COUNT(*) FILTER (WHERE lag_seconds > 900)::int AS stale_15m
  FROM reservations_projection
  WHERE tenant_id = $1;
`;

const TOP_LAGGING_SQL = `
  SELECT
    id,
    tenant_id,
    property_id,
    status,
    last_event_type,
    last_event_timestamp,
    lag_seconds,
    last_refreshed_at
  FROM reservations_projection
  WHERE tenant_id = $1
  ORDER BY lag_seconds DESC NULLS LAST
  LIMIT $2;
`;

export const getProjectionMonitorStats = async (
  tenantId: string,
  limit = 25,
): Promise<ProjectionMonitorResponse> => {
  const summaryResult = await query<{
    total_rows: number;
    avg_lag_seconds: number;
    max_lag_seconds: number;
    stale_5m: number;
    stale_15m: number;
  }>(SUMMARY_SQL, [tenantId]);

  const summaryRow = summaryResult.rows[0] ?? {
    total_rows: 0,
    avg_lag_seconds: 0,
    max_lag_seconds: 0,
    stale_5m: 0,
    stale_15m: 0,
  };

  const topLaggingResult = await query<ProjectionRowInsight>(TOP_LAGGING_SQL, [tenantId, limit]);

  return {
    summary: {
      totalRows: summaryRow.total_rows,
      averageLagSeconds: summaryRow.avg_lag_seconds,
      maxLagSeconds: summaryRow.max_lag_seconds,
      staleOver5Minutes: summaryRow.stale_5m,
      staleOver15Minutes: summaryRow.stale_15m,
    },
    topLagging: topLaggingResult.rows,
  };
};
