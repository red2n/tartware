import { query } from "../lib/db.js";

export interface ChannelPerformance {
  id: string;
  name: string;
  type: string | null;
  average_daily_rate: number | null;
  pickup_change_percent: number | null;
  next_sync_eta_minutes: number | null;
  last_sync_at: string | null;
  status: "synced" | "attention";
  total_bookings: number;
  total_revenue: number;
}

export interface CampaignSummary {
  id: string;
  name: string;
  audience: string | null;
  status: string;
  click_through_rate: number | null;
  budget_amount: number | null;
  actual_spend: number | null;
  budget_currency: string | null;
  budget_utilization_percent: number | null;
}

export interface LeadSourceSummary {
  source: string;
  leads: number;
  conversion_rate: number | null;
  average_booking_value: number | null;
  quality: "great" | "ok" | "watch";
}

export interface MarketingQueryOptions {
  tenantId: string;
  propertyId?: string;
  limit?: number;
}

interface ChannelPerformanceRow {
  source_id: string;
  channel_name: string | null;
  source_name: string | null;
  source_type: string | null;
  total_revenue: string | null;
  total_room_nights: string | null;
  total_bookings: number | null;
  conversion_rate: string | null;
  has_integration: boolean | null;
  last_sync_at: Date | null;
  sync_frequency_minutes: number | null;
  average_booking_value: string | null;
}

interface CampaignSummaryRow {
  campaign_id: string;
  campaign_name: string;
  target_audience_type: string | null;
  campaign_status: string;
  click_through_rate: string | null;
  budget_amount: string | null;
  actual_spend: string | null;
  budget_currency: string | null;
  budget_utilization_percent: string | null;
}

interface LeadSourceRow {
  source_type: string | null;
  total_leads: string | null;
  avg_conversion_rate: string | null;
  avg_booking_value: string | null;
}

const DEFAULT_LIMIT = 8;

const parseNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return null;
  }
  return numeric;
};

const computeNextSyncEta = (
  lastSync: Date | null,
  frequencyMinutes: number | null,
): number | null => {
  if (!lastSync || !frequencyMinutes || frequencyMinutes <= 0) {
    return null;
  }
  const minutesSinceSync = (Date.now() - lastSync.getTime()) / 60000;
  const eta = Math.max(0, Math.round(frequencyMinutes - minutesSinceSync));
  return eta;
};

const determineChannelStatus = (
  hasIntegration: boolean,
  lastSync: Date | null,
  frequencyMinutes: number | null,
): "synced" | "attention" => {
  if (!hasIntegration) {
    return "attention";
  }
  if (!lastSync || !frequencyMinutes || frequencyMinutes <= 0) {
    return "synced";
  }
  const minutesSinceSync = (Date.now() - lastSync.getTime()) / 60000;
  const isStale = minutesSinceSync > frequencyMinutes * 2;
  return isStale ? "attention" : "synced";
};

const buildTenantFilters = (
  tenantId: string,
  propertyId?: string,
): { clause: string; params: unknown[] } => {
  const clauses = ["tenant_id = $1"];
  const params: unknown[] = [tenantId];

  if (propertyId && propertyId !== "all") {
    clauses.push(`(property_id = $${params.length + 1} OR property_id IS NULL)`);
    params.push(propertyId);
  }

  clauses.push("is_deleted = false");

  return { clause: clauses.join(" AND "), params };
};

export const getChannelPerformance = async (
  options: MarketingQueryOptions,
): Promise<ChannelPerformance[]> => {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const { clause, params } = buildTenantFilters(options.tenantId, options.propertyId);
  params.push(limit);

  const sql = `
    SELECT
      source_id,
      COALESCE(display_name, channel_name, source_name) AS channel_name,
      source_name,
      source_type,
      total_revenue,
      total_room_nights,
      total_bookings,
      conversion_rate,
      has_integration,
      last_sync_at,
      sync_frequency_minutes,
      average_booking_value
    FROM booking_sources
    WHERE ${clause} AND is_active = true
    ORDER BY COALESCE(ranking, 9999), total_revenue DESC NULLS LAST
    LIMIT $${params.length}
  `;

  const result = await query<ChannelPerformanceRow>(sql, params);
  return result.rows.map((row) => {
    const revenue = parseNumber(row.total_revenue) ?? 0;
    const roomNights = parseNumber(row.total_room_nights) ?? 0;
    const avgBookingValue = parseNumber(row.average_booking_value);
    const averageDailyRate =
      roomNights > 0 ? Number((revenue / roomNights).toFixed(2)) : avgBookingValue;
    const pickup = parseNumber(row.conversion_rate);
    const bookings = Number(row.total_bookings ?? 0);
    const eta = computeNextSyncEta(row.last_sync_at, row.sync_frequency_minutes);
    const status = determineChannelStatus(
      Boolean(row.has_integration),
      row.last_sync_at,
      row.sync_frequency_minutes,
    );

    return {
      id: row.source_id,
      name: row.channel_name ?? row.source_name ?? "Channel",
      type: row.source_type,
      average_daily_rate: averageDailyRate,
      pickup_change_percent: pickup,
      next_sync_eta_minutes: eta,
      last_sync_at: row.last_sync_at ? row.last_sync_at.toISOString() : null,
      status,
      total_bookings: bookings,
      total_revenue: Number(revenue.toFixed(2)),
    };
  });
};

export const getCampaignSummaries = async (
  options: MarketingQueryOptions,
): Promise<CampaignSummary[]> => {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const { clause, params } = buildTenantFilters(options.tenantId, options.propertyId);
  params.push(limit);

  const sql = `
    SELECT
      campaign_id,
      campaign_name,
      target_audience_type,
      campaign_status,
      click_through_rate,
      budget_amount,
      actual_spend,
      budget_currency,
      budget_utilization_percent
    FROM marketing_campaigns
    WHERE ${clause}
    ORDER BY
      CASE campaign_status
        WHEN 'active' THEN 0
        WHEN 'scheduled' THEN 1
        ELSE 2
      END,
      start_date DESC NULLS LAST
    LIMIT $${params.length}
  `;

  const result = await query<CampaignSummaryRow>(sql, params);
  return result.rows.map((row) => ({
    id: row.campaign_id,
    name: row.campaign_name,
    audience: row.target_audience_type,
    status: row.campaign_status,
    click_through_rate: parseNumber(row.click_through_rate),
    budget_amount: parseNumber(row.budget_amount),
    actual_spend: parseNumber(row.actual_spend),
    budget_currency: row.budget_currency,
    budget_utilization_percent: parseNumber(row.budget_utilization_percent),
  }));
};

export const getLeadSources = async (
  options: MarketingQueryOptions,
): Promise<LeadSourceSummary[]> => {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const { clause, params } = buildTenantFilters(options.tenantId, options.propertyId);
  params.push(limit);

  const sql = `
    SELECT
      COALESCE(source_type, 'OTHER') AS source_type,
      SUM(total_bookings) AS total_leads,
      AVG(conversion_rate) AS avg_conversion_rate,
      AVG(average_booking_value) AS avg_booking_value
    FROM booking_sources
    WHERE ${clause}
    GROUP BY source_type
    ORDER BY SUM(total_bookings) DESC NULLS LAST
    LIMIT $${params.length}
  `;

  const result = await query<LeadSourceRow>(sql, params);
  return result.rows.map((row) => {
    const leads = parseNumber(row.total_leads) ?? 0;
    const conversion = parseNumber(row.avg_conversion_rate);
    const avgBookingValue = parseNumber(row.avg_booking_value);
    let quality: "great" | "ok" | "watch" = "watch";
    if (conversion !== null) {
      if (conversion >= 35) {
        quality = "great";
      } else if (conversion >= 20) {
        quality = "ok";
      }
    }

    return {
      source: row.source_type ?? "OTHER",
      leads: Math.round(leads),
      conversion_rate: conversion,
      average_booking_value: avgBookingValue,
      quality,
    };
  });
};
