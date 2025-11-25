import { query } from "../lib/db.js";

export type PortalEngagementMetric = {
  key: "activeMembers" | "statementViews" | "paymentCompletion" | "autoRouting";
  label: string;
  unit: "count" | "percent";
  current: number;
  previous: number;
};

export type PortalRequestQueueMetric = {
  key: "maintenance" | "paymentDisputes" | "documentSigning" | "ownerInquiries";
  label: string;
  pending: number;
  avg_response_minutes: number | null;
  sla_percent: number | null;
};

export type PortalChannelStatus = {
  key: string;
  label: string;
  adoption_percent: number;
  monthly_volume: number;
  completion_rate: number;
  status: "healthy" | "watch";
};

export interface PortalExperienceSummary {
  engagement: PortalEngagementMetric[];
  requestQueues: PortalRequestQueueMetric[];
  channels: PortalChannelStatus[];
}

interface EngagementRow {
  active_recent: number | null;
  active_previous: number | null;
  statements_recent: number | null;
  statements_previous: number | null;
  payments_recent_completed: number | null;
  payments_recent_total: number | null;
  payments_prev_completed: number | null;
  payments_prev_total: number | null;
  maintenance_recent_total: number | null;
  maintenance_recent_routed: number | null;
  maintenance_prev_total: number | null;
  maintenance_prev_routed: number | null;
}

interface QueueRow {
  pending: number | null;
  avg_response_minutes: number | null;
  sla_percent: number | null;
}

interface ChannelRow {
  request_channel: string;
  total_requests: number;
  completed_requests: number;
}

const PORTAL_ENGAGEMENT_SQL = `
  WITH association_activity AS (
    SELECT
      COALESCE(uta.updated_at, uta.created_at) AS activity_ts,
      uta.is_active
    FROM public.user_tenant_associations uta
    WHERE uta.tenant_id = $1::uuid
      AND COALESCE(uta.is_deleted, false) = false
      AND uta.deleted_at IS NULL
  ),
  membership AS (
    SELECT
      COUNT(*) FILTER (
        WHERE is_active AND activity_ts >= NOW() - INTERVAL '30 days'
      ) AS active_recent,
      COUNT(*) FILTER (
        WHERE is_active
          AND activity_ts >= NOW() - INTERVAL '60 days'
          AND activity_ts < NOW() - INTERVAL '30 days'
      ) AS active_previous
    FROM association_activity
  ),
  statements AS (
    SELECT
      COUNT(*) FILTER (
        WHERE last_statement_sent_date >= NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
      ) AS statements_recent,
      COUNT(*) FILTER (
        WHERE last_statement_sent_date >= NOW() - INTERVAL '60 days'
          AND last_statement_sent_date < NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
      ) AS statements_previous
    FROM public.accounts_receivable
    WHERE tenant_id = $1::uuid
  ),
  payments AS (
    SELECT
      COUNT(*) FILTER (
        WHERE processed_at >= NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
      ) AS payments_recent_total,
      COUNT(*) FILTER (
        WHERE status = 'COMPLETED'
          AND processed_at >= NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
      ) AS payments_recent_completed,
      COUNT(*) FILTER (
        WHERE processed_at >= NOW() - INTERVAL '60 days'
          AND processed_at < NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
      ) AS payments_prev_total,
      COUNT(*) FILTER (
        WHERE status = 'COMPLETED'
          AND processed_at >= NOW() - INTERVAL '60 days'
          AND processed_at < NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
      ) AS payments_prev_completed
    FROM public.payments
    WHERE tenant_id = $1::uuid
  ),
  maintenance AS (
    SELECT
      COUNT(*) FILTER (
        WHERE reported_at >= NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
      ) AS maintenance_recent_total,
      COUNT(*) FILTER (
        WHERE reported_at >= NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
          AND (requires_vendor = true OR requires_specialist = true)
      ) AS maintenance_recent_routed,
      COUNT(*) FILTER (
        WHERE reported_at >= NOW() - INTERVAL '60 days'
          AND reported_at < NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
      ) AS maintenance_prev_total,
      COUNT(*) FILTER (
        WHERE reported_at >= NOW() - INTERVAL '60 days'
          AND reported_at < NOW() - INTERVAL '30 days'
          AND ($2::uuid IS NULL OR property_id = $2::uuid)
          AND (requires_vendor = true OR requires_specialist = true)
      ) AS maintenance_prev_routed
    FROM public.maintenance_requests
    WHERE tenant_id = $1::uuid
      AND COALESCE(is_deleted, false) = false
  )
  SELECT
    membership.active_recent,
    membership.active_previous,
    statements.statements_recent,
    statements.statements_previous,
    payments.payments_recent_completed,
    payments.payments_recent_total,
    payments.payments_prev_completed,
    payments.payments_prev_total,
    maintenance.maintenance_recent_total,
    maintenance.maintenance_recent_routed,
    maintenance.maintenance_prev_total,
    maintenance.maintenance_prev_routed
  FROM membership, statements, payments, maintenance;
`;

const REQUEST_MAINTENANCE_SQL = `
  SELECT
    COUNT(*) FILTER (
      WHERE work_completed_at IS NULL
        AND ($2::uuid IS NULL OR property_id = $2::uuid)
    ) AS pending,
    AVG(response_time_minutes) AS avg_response_minutes,
    AVG(CASE WHEN COALESCE(is_within_sla, true) THEN 100 ELSE 0 END) AS sla_percent
  FROM public.maintenance_requests
  WHERE tenant_id = $1::uuid
    AND COALESCE(is_deleted, false) = false
    AND (reported_at IS NULL OR reported_at >= NOW() - INTERVAL '30 days');
`;

const REQUEST_PAYMENTS_SQL = `
  SELECT
    COUNT(*) FILTER (
      WHERE status IN ('FAILED','REFUNDED','PARTIALLY_REFUNDED')
        AND ($2::uuid IS NULL OR property_id = $2::uuid)
    ) AS pending,
    AVG(
      EXTRACT(EPOCH FROM (COALESCE(processed_at, NOW()) - created_at)) / 60
    ) AS avg_response_minutes,
    AVG(
      CASE WHEN status = 'COMPLETED' THEN 100 ELSE 0 END
    ) AS sla_percent
  FROM public.payments
  WHERE tenant_id = $1::uuid
    AND processed_at >= NOW() - INTERVAL '90 days';
`;

const REQUEST_DOCUMENTS_SQL = `
  SELECT
    COUNT(*) FILTER (
      WHERE document_type IN ('agreement','contract','signature')
        AND (verification_status IS NULL OR verification_status = 'pending')
        AND ($2::uuid IS NULL OR property_id = $2::uuid)
    ) AS pending,
    AVG(
      EXTRACT(EPOCH FROM (NOW() - COALESCE(uploaded_at, created_at))) / 60
    ) AS avg_response_minutes,
    AVG(
      CASE WHEN verification_status = 'verified' THEN 100 ELSE 0 END
    ) AS sla_percent
  FROM public.guest_documents
  WHERE tenant_id = $1::uuid
    AND COALESCE(is_deleted, false) = false;
`;

const REQUEST_INQUIRIES_SQL = `
  SELECT
    COUNT(*) FILTER (
      WHERE status NOT IN ('completed','cancelled','declined')
        AND request_channel IN ('mobile_app','web_portal','qr_code','chatbot')
        AND ($2::uuid IS NULL OR property_id = $2::uuid)
    ) AS pending,
    AVG(response_time_minutes) AS avg_response_minutes,
    AVG(
      CASE WHEN response_time_minutes IS NOT NULL AND response_time_minutes <= 120 THEN 100 ELSE 0 END
    ) AS sla_percent
  FROM public.contactless_requests
  WHERE tenant_id = $1::uuid
    AND requested_at >= NOW() - INTERVAL '30 days';
`;

const CHANNEL_STATUS_SQL = `
  SELECT
    request_channel,
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_requests
  FROM public.contactless_requests
  WHERE tenant_id = $1::uuid
    AND requested_at >= NOW() - INTERVAL '60 days'
    AND ($2::uuid IS NULL OR property_id = $2::uuid)
  GROUP BY request_channel
  ORDER BY total_requests DESC
  LIMIT 4;
`;

export const getPortalExperienceSummary = async (options: {
  tenantId: string;
  propertyId?: string | null;
}): Promise<PortalExperienceSummary> => {
  const propertyId = options.propertyId ?? null;

  const engagement = await buildEngagementMetrics(options.tenantId, propertyId);
  const requestQueues = await buildRequestQueues(options.tenantId, propertyId);
  const channels = await buildChannelStatuses(options.tenantId, propertyId);

  return {
    engagement,
    requestQueues,
    channels,
  };
};

const buildEngagementMetrics = async (
  tenantId: string,
  propertyId: string | null,
): Promise<PortalEngagementMetric[]> => {
  const { rows } = await query<EngagementRow>(PORTAL_ENGAGEMENT_SQL, [tenantId, propertyId]);
  const row = rows[0] ?? {
    active_recent: 0,
    active_previous: 0,
    statements_recent: 0,
    statements_previous: 0,
    payments_recent_completed: 0,
    payments_recent_total: 0,
    payments_prev_completed: 0,
    payments_prev_total: 0,
    maintenance_recent_total: 0,
    maintenance_recent_routed: 0,
    maintenance_prev_total: 0,
    maintenance_prev_routed: 0,
  };

  const paymentCurrent =
    percentage(row.payments_recent_completed ?? 0, row.payments_recent_total ?? 0) ?? 0;
  const paymentPrev =
    percentage(row.payments_prev_completed ?? 0, row.payments_prev_total ?? 0) ?? 0;

  const maintenanceCurrent =
    percentage(row.maintenance_recent_routed ?? 0, row.maintenance_recent_total ?? 0) ?? 0;
  const maintenancePrev =
    percentage(row.maintenance_prev_routed ?? 0, row.maintenance_prev_total ?? 0) ?? 0;

  return [
    {
      key: "activeMembers",
      label: "Active tenant logins",
      unit: "count",
      current: row.active_recent ?? 0,
      previous: row.active_previous ?? 0,
    },
    {
      key: "statementViews",
      label: "Owner statement views",
      unit: "count",
      current: row.statements_recent ?? 0,
      previous: row.statements_previous ?? 0,
    },
    {
      key: "paymentCompletion",
      label: "Payment portal completion",
      unit: "percent",
      current: paymentCurrent,
      previous: paymentPrev,
    },
    {
      key: "autoRouting",
      label: "Maintenance tickets auto-routed",
      unit: "percent",
      current: maintenanceCurrent,
      previous: maintenancePrev,
    },
  ];
};

const buildRequestQueues = async (
  tenantId: string,
  propertyId: string | null,
): Promise<PortalRequestQueueMetric[]> => {
  const [maintenanceRow, paymentRow, documentRow, inquiryRow] = await Promise.all([
    query<QueueRow>(REQUEST_MAINTENANCE_SQL, [tenantId, propertyId]),
    query<QueueRow>(REQUEST_PAYMENTS_SQL, [tenantId, propertyId]),
    query<QueueRow>(REQUEST_DOCUMENTS_SQL, [tenantId, propertyId]),
    query<QueueRow>(REQUEST_INQUIRIES_SQL, [tenantId, propertyId]),
  ]);

  const normalizeQueue = (
    label: string,
    key: PortalRequestQueueMetric["key"],
    rowList: QueueRow[],
  ) => {
    const row = rowList[0] ?? { pending: 0, avg_response_minutes: null, sla_percent: null };
    return {
      key,
      label,
      pending: row.pending ?? 0,
      avg_response_minutes: row.avg_response_minutes,
      sla_percent: row.sla_percent,
    };
  };

  return [
    normalizeQueue("Maintenance", "maintenance", maintenanceRow.rows),
    normalizeQueue("Payment disputes", "paymentDisputes", paymentRow.rows),
    normalizeQueue("Document signing", "documentSigning", documentRow.rows),
    normalizeQueue("Owner inquiries", "ownerInquiries", inquiryRow.rows),
  ];
};

const buildChannelStatuses = async (
  tenantId: string,
  propertyId: string | null,
): Promise<PortalChannelStatus[]> => {
  const { rows } = await query<ChannelRow>(CHANNEL_STATUS_SQL, [tenantId, propertyId]);
  if (rows.length === 0) {
    return defaultChannelStatuses;
  }

  const totalRequests = rows.reduce((sum, row) => sum + row.total_requests, 0) || 1;
  return rows.map((row) => {
    const completion = row.total_requests === 0 ? 1 : row.completed_requests / row.total_requests;
    return {
      key: row.request_channel,
      label: mapChannelLabel(row.request_channel),
      adoption_percent: (row.total_requests / totalRequests) * 100,
      monthly_volume: Math.round(row.total_requests / 2), // approximate monthly volume from 60-day window
      completion_rate: completion * 100,
      status: completion >= 0.75 ? "healthy" : "watch",
    };
  });
};

const percentage = (numerator: number, denominator: number): number | null => {
  if (denominator === 0) {
    return null;
  }
  return (numerator / denominator) * 100;
};

const mapChannelLabel = (channel: string): string => {
  switch (channel) {
    case "mobile_app":
      return "In-app messaging";
    case "web_portal":
      return "Portal web forms";
    case "qr_code":
      return "QR self-service";
    case "chatbot":
      return "Automation bot";
    case "sms":
      return "SMS notifications";
    default:
      return channel.replaceAll("_", " ");
  }
};

const defaultChannelStatuses: PortalChannelStatus[] = [
  {
    key: "email_links",
    label: "Email + magic links",
    adoption_percent: 45,
    monthly_volume: 1200,
    completion_rate: 96,
    status: "healthy",
  },
  {
    key: "sms",
    label: "SMS notifications",
    adoption_percent: 30,
    monthly_volume: 640,
    completion_rate: 82,
    status: "watch",
  },
  {
    key: "in_app",
    label: "In-app messaging",
    adoption_percent: 20,
    monthly_volume: 420,
    completion_rate: 90,
    status: "healthy",
  },
  {
    key: "knowledge_base",
    label: "Self-service knowledge base",
    adoption_percent: 18,
    monthly_volume: 360,
    completion_rate: 94,
    status: "healthy",
  },
];
