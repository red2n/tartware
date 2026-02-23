import { MetasearchConfigurationsSchema } from "@tartware/schemas";

import { query } from "../../lib/db.js";
import {
  METASEARCH_CLICK_PERFORMANCE_SQL,
  METASEARCH_CONFIG_BY_ID_SQL,
  METASEARCH_CONFIG_LIST_SQL,
} from "../../sql/booking-config/metasearch.js";

import { toIsoString, toNumber } from "./common.js";

// =====================================================
// METASEARCH CONFIGURATION SERVICE
// =====================================================

type MetasearchConfigRow = {
  config_id: string;
  tenant_id: string;
  property_id: string;
  platform: string;
  platform_account_id: string | null;
  is_active: boolean;
  bid_strategy: string;
  max_cpc: number | string | null;
  default_cpc: number | string | null;
  cpc_multipliers: Record<string, unknown> | null;
  target_cpa: number | string | null;
  cpa_commission_percent: number | string | null;
  budget_daily: number | string | null;
  budget_monthly: number | string | null;
  currency: string;
  rate_feed_url: string | null;
  rate_feed_format: string | null;
  rate_feed_frequency: string | null;
  target_roas: number | string | null;
  min_booking_value: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  created_by: string | null;
  updated_by: string | null;
};

const mapConfigRow = (row: MetasearchConfigRow) =>
  MetasearchConfigurationsSchema.parse({
    config_id: row.config_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    platform: row.platform,
    platform_account_id: row.platform_account_id ?? undefined,
    is_active: Boolean(row.is_active),
    bid_strategy: row.bid_strategy,
    max_cpc: toNumber(row.max_cpc) ?? undefined,
    default_cpc: toNumber(row.default_cpc) ?? undefined,
    cpc_multipliers: row.cpc_multipliers ?? undefined,
    target_cpa: toNumber(row.target_cpa) ?? undefined,
    cpa_commission_percent: toNumber(row.cpa_commission_percent) ?? undefined,
    budget_daily: toNumber(row.budget_daily) ?? undefined,
    budget_monthly: toNumber(row.budget_monthly) ?? undefined,
    currency: row.currency,
    rate_feed_url: row.rate_feed_url ?? undefined,
    rate_feed_format: row.rate_feed_format ?? undefined,
    rate_feed_frequency: row.rate_feed_frequency ?? undefined,
    target_roas: toNumber(row.target_roas) ?? undefined,
    min_booking_value: toNumber(row.min_booking_value) ?? undefined,
    metadata: row.metadata ?? undefined,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
  });

export const listMetasearchConfigs = async (params: {
  tenantId: string;
  propertyId?: string;
  platform?: string;
  isActive?: boolean;
  limit: number;
  offset: number;
}) => {
  const { rows } = await query<MetasearchConfigRow>(METASEARCH_CONFIG_LIST_SQL, [
    params.limit,
    params.tenantId,
    params.propertyId ?? null,
    params.platform ?? null,
    params.isActive ?? null,
    params.offset,
  ]);

  return rows.map(mapConfigRow);
};

export const getMetasearchConfigById = async (params: { configId: string; tenantId: string }) => {
  const { rows } = await query<MetasearchConfigRow>(METASEARCH_CONFIG_BY_ID_SQL, [
    params.configId,
    params.tenantId,
  ]);

  return rows[0] ? mapConfigRow(rows[0]) : null;
};

// =====================================================
// METASEARCH CLICK PERFORMANCE SERVICE
// =====================================================

type ClickPerformanceRow = {
  config_id: string;
  platform: string;
  total_clicks: number | string;
  total_cost: number | string;
  total_conversions: number | string;
  total_conversion_value: number | string;
  conversion_rate_pct: number | string;
  roas: number | string;
};

export const getMetasearchClickPerformance = async (params: {
  tenantId: string;
  propertyId?: string;
  configId?: string;
  from?: string;
  to?: string;
}) => {
  const { rows } = await query<ClickPerformanceRow>(METASEARCH_CLICK_PERFORMANCE_SQL, [
    params.tenantId,
    params.propertyId ?? null,
    params.configId ?? null,
    params.from ?? null,
    params.to ?? null,
  ]);

  return rows.map((row) => ({
    config_id: row.config_id,
    platform: row.platform,
    total_clicks: Number(row.total_clicks),
    total_cost: toNumber(row.total_cost) ?? 0,
    total_conversions: Number(row.total_conversions),
    total_conversion_value: toNumber(row.total_conversion_value) ?? 0,
    conversion_rate_pct: toNumber(row.conversion_rate_pct) ?? 0,
    roas: toNumber(row.roas) ?? 0,
  }));
};
