import { query } from "../lib/db.js";

export interface EnterpriseIntegrationStatus {
  name: string;
  type: string | null;
  entity: string | null;
  status: "healthy" | "warning";
  latency_ms: number | null;
  last_sync_at: string | null;
  next_sync_eta_minutes: number | null;
}

export interface EnterpriseApiUsage {
  api_calls_24h: number;
  success_rate: number;
  p95_latency_ms: number | null;
  webhook_calls_24h: number;
}

export interface EnterpriseSecurityEvent {
  title: string;
  timestamp: string | null;
  action: string;
  severity: "info" | "warning";
}

export interface EnterpriseInsights {
  integrations: EnterpriseIntegrationStatus[];
  apiUsage: EnterpriseApiUsage;
  securityLog: EnterpriseSecurityEvent[];
}

interface IntegrationRow {
  sync_name: string;
  sync_type: string | null;
  entity_type: string | null;
  status: string | null;
  duration_seconds: number | null;
  completed_at: Date | null;
  next_sync_at: Date | null;
}

interface ApiUsageRow {
  total_calls: number | null;
  success_calls: number | null;
  p95_latency: number | null;
  webhook_calls: number | null;
}

interface SecurityRow {
  api_name: string | null;
  endpoint: string | null;
  http_method: string | null;
  status_code: number | null;
  request_timestamp: Date | null;
  success: boolean | null;
  error_message: string | null;
}

const INTEGRATION_STATUS_SQL = `
  SELECT DISTINCT ON (sync_name)
    sync_name,
    sync_type,
    entity_type,
    status,
    duration_seconds,
    completed_at,
    next_sync_at
  FROM public.data_sync_status
  WHERE tenant_id = $1::uuid
    AND COALESCE(is_deleted, false) = false
    AND ($2::uuid IS NULL OR property_id = $2::uuid OR property_id IS NULL)
  ORDER BY sync_name, completed_at DESC NULLS LAST
  LIMIT 6;
`;

const API_USAGE_SQL = `
  SELECT
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE success = true) AS success_calls,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY COALESCE(duration_ms, 0)) AS p95_latency,
    COUNT(*) FILTER (WHERE endpoint ILIKE '%webhook%') AS webhook_calls
  FROM public.api_logs
  WHERE tenant_id = $1::uuid
    AND request_timestamp >= NOW() - INTERVAL '24 hours'
    AND COALESCE(is_deleted, false) = false
    AND ($2::uuid IS NULL OR property_id = $2::uuid OR property_id IS NULL);
`;

const SECURITY_LOG_SQL = `
  SELECT
    api_name,
    endpoint,
    http_method,
    status_code,
    request_timestamp,
    success,
    error_message
  FROM public.api_logs
  WHERE tenant_id = $1::uuid
    AND request_timestamp >= NOW() - INTERVAL '7 days'
    AND COALESCE(is_deleted, false) = false
    AND ($2::uuid IS NULL OR property_id = $2::uuid OR property_id IS NULL)
    AND (
      success = false
      OR status_code >= 400
      OR endpoint ILIKE '%impersonation%'
    )
  ORDER BY request_timestamp DESC
  LIMIT 5;
`;

export const getEnterpriseInsights = async (options: {
  tenantId: string;
  propertyId?: string | null;
}): Promise<EnterpriseInsights> => {
  const propertyId = options.propertyId ?? null;

  const [integrationResult, apiUsageResult, securityResult] = await Promise.all([
    query<IntegrationRow>(INTEGRATION_STATUS_SQL, [options.tenantId, propertyId]),
    query<ApiUsageRow>(API_USAGE_SQL, [options.tenantId, propertyId]),
    query<SecurityRow>(SECURITY_LOG_SQL, [options.tenantId, propertyId]),
  ]);

  const integrations =
    integrationResult.rows.length > 0
      ? integrationResult.rows.map(mapIntegrationRow)
      : defaultIntegrationStatuses;

  const apiUsage = mapApiUsageRow(apiUsageResult.rows[0]);
  const securityLog =
    securityResult.rows.length > 0 ? securityResult.rows.map(mapSecurityRow) : defaultSecurityLog;

  return {
    integrations,
    apiUsage,
    securityLog,
  };
};

const mapIntegrationRow = (row: IntegrationRow): EnterpriseIntegrationStatus => {
  const latencyMs = row.duration_seconds ? Math.max(row.duration_seconds * 1000, 0) : null;
  return {
    name: row.sync_name,
    type: row.sync_type,
    entity: row.entity_type,
    status: normalizeStatus(row.status),
    latency_ms: latencyMs,
    last_sync_at: row.completed_at?.toISOString() ?? null,
    next_sync_eta_minutes: computeEta(row.next_sync_at),
  };
};

const mapApiUsageRow = (row?: ApiUsageRow): EnterpriseApiUsage => {
  if (!row) {
    return {
      api_calls_24h: 0,
      success_rate: 100,
      p95_latency_ms: null,
      webhook_calls_24h: 0,
    };
  }
  const total = row.total_calls ?? 0;
  const success = row.success_calls ?? 0;
  return {
    api_calls_24h: total,
    success_rate: total === 0 ? 100 : (success / total) * 100,
    p95_latency_ms: row.p95_latency,
    webhook_calls_24h: row.webhook_calls ?? 0,
  };
};

const mapSecurityRow = (row: SecurityRow): EnterpriseSecurityEvent => {
  const title = row.api_name ?? row.endpoint ?? "API request";
  const actionParts = [row.http_method ?? "API", row.status_code ? `(${row.status_code})` : null]
    .filter(Boolean)
    .join(" ");
  return {
    title,
    timestamp: row.request_timestamp?.toISOString() ?? null,
    action: actionParts || "Request logged",
    severity: row.success === false || (row.status_code ?? 0) >= 500 ? "warning" : "info",
  };
};

const normalizeStatus = (status: string | null): "healthy" | "warning" => {
  if (!status) {
    return "healthy";
  }
  const normalized = status.toLowerCase();
  return normalized === "completed" || normalized === "success" ? "healthy" : "warning";
};

const computeEta = (date: Date | null): number | null => {
  if (!date) {
    return null;
  }
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  return diffMinutes < 0 ? 0 : diffMinutes;
};

const defaultIntegrationStatuses: EnterpriseIntegrationStatus[] = [
  {
    name: "Oracle NetSuite",
    type: "ledger",
    entity: "Financials",
    status: "healthy",
    latency_ms: 420,
    last_sync_at: null,
    next_sync_eta_minutes: 12,
  },
  {
    name: "Okta SSO",
    type: "identity",
    entity: "Authentication",
    status: "healthy",
    latency_ms: 180,
    last_sync_at: null,
    next_sync_eta_minutes: 0,
  },
  {
    name: "Salesforce",
    type: "crm",
    entity: "Pipeline",
    status: "warning",
    latency_ms: 1800,
    last_sync_at: null,
    next_sync_eta_minutes: 20,
  },
  {
    name: "Kafka bridge",
    type: "events",
    entity: "Streaming",
    status: "healthy",
    latency_ms: 95,
    last_sync_at: null,
    next_sync_eta_minutes: 1,
  },
];

const defaultSecurityLog: EnterpriseSecurityEvent[] = [
  {
    title: "Admin API token generated",
    timestamp: null,
    action: "POST (201)",
    severity: "info",
  },
  {
    title: "SSO assertion failure",
    timestamp: null,
    action: "POST (401)",
    severity: "warning",
  },
];
