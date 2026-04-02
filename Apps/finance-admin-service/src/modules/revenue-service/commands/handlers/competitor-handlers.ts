import type { CommandMetadata } from "@tartware/command-consumer-utils";
import type { CompetitiveResponseRuleInput, CompsetCompetitorInput } from "@tartware/schemas";
import { upsertCompetitiveResponseRule } from "../../services/competitive-response-service.js";
import { createCompetitorRate } from "../../services/competitor-rate-service.js";
import { configureCompset } from "../../services/compset-service.js";
import { getProvider } from "../../services/rate-shopping-service.js";

export const handleCompetitorRecord = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ competitorRateId: string }> => {
  const result = await createCompetitorRate(
    metadata.tenantId,
    payload.property_id as string,
    {
      competitorName: payload.competitor_name as string,
      competitorPropertyName: (payload.competitor_property_name as string) ?? null,
      roomTypeCategory: (payload.room_type_category as string) ?? null,
      rateDate: payload.rate_date as string,
      rateAmount: payload.rate_amount as number,
      currency: (payload.currency as string) ?? "USD",
      source: (payload.source as string) ?? null,
      includesBreakfast: payload.includes_breakfast as boolean | undefined,
      includesParking: payload.includes_parking as boolean | undefined,
      includesWifi: payload.includes_wifi as boolean | undefined,
      taxesIncluded: payload.taxes_included as boolean | undefined,
      roomsLeft: payload.rooms_left as number | undefined,
      estimatedOccupancyPercent: payload.estimated_occupancy_percent as number | undefined,
      notes: (payload.notes as string) ?? null,
    },
    actorId,
  );
  return { competitorRateId: result.competitorRateId };
};

export const handleCompetitorBulkImport = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ imported: number }> => {
  const rates = payload.rates as Array<{
    competitor_name: string;
    competitor_property_name?: string;
    room_type_category?: string;
    rate_date: string;
    rate_amount: number;
    currency?: string;
    includes_breakfast?: boolean;
    includes_parking?: boolean;
    includes_wifi?: boolean;
    taxes_included?: boolean;
    rooms_left?: number;
    estimated_occupancy_percent?: number;
  }>;
  let imported = 0;
  for (const rate of rates) {
    await createCompetitorRate(
      metadata.tenantId,
      payload.property_id as string,
      {
        competitorName: rate.competitor_name,
        competitorPropertyName: rate.competitor_property_name ?? null,
        roomTypeCategory: rate.room_type_category ?? null,
        rateDate: rate.rate_date,
        rateAmount: rate.rate_amount,
        currency: rate.currency ?? "USD",
        source: (payload.source as string) ?? null,
        includesBreakfast: rate.includes_breakfast,
        includesParking: rate.includes_parking,
        includesWifi: rate.includes_wifi,
        taxesIncluded: rate.taxes_included,
        roomsLeft: rate.rooms_left,
        estimatedOccupancyPercent: rate.estimated_occupancy_percent,
      },
      actorId,
    );
    imported++;
  }
  return { imported };
};

export const handleCompetitorConfigureCompset = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ upserted: number }> => {
  const rawCompetitors = payload.competitors as Array<Record<string, unknown>>;

  const competitors: CompsetCompetitorInput[] = rawCompetitors.map((c) => ({
    competitorName: c.competitor_name as string,
    competitorExternalId: (c.competitor_external_id as string) ?? null,
    competitorBrand: (c.competitor_brand as string) ?? null,
    competitorAddress: (c.competitor_address as string) ?? null,
    competitorCity: (c.competitor_city as string) ?? null,
    competitorCountry: (c.competitor_country as string) ?? null,
    competitorStarRating: (c.competitor_star_rating as number) ?? null,
    competitorTotalRooms: (c.competitor_total_rooms as number) ?? null,
    competitorUrl: (c.competitor_url as string) ?? null,
    weight: (c.weight as number) ?? 1.0,
    distanceKm: (c.distance_km as number) ?? null,
    marketSegment: (c.market_segment as string) ?? null,
    rateShoppingSource: (c.rate_shopping_source as string) ?? null,
    isPrimary: (c.is_primary as boolean) ?? false,
    isActive: (c.is_active as boolean) ?? true,
    sortOrder: (c.sort_order as number) ?? 0,
    notes: (c.notes as string) ?? null,
  }));

  return configureCompset(
    metadata.tenantId,
    payload.property_id as string,
    competitors,
    actorId,
    (payload.metadata as Record<string, unknown>) ?? null,
  );
};

// ── R15: Rate Shopping Auto-Collect ─────────────────

export const handleCompetitorAutoCollect = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ collected: number }> => {
  const propertyId = payload.property_id as string;
  const startDate = payload.start_date as string;
  const endDate = payload.end_date as string;
  const providerName = payload.provider as string | undefined;

  const provider = getProvider(providerName);
  const rates = await provider.collectRates(metadata.tenantId, propertyId, startDate, endDate);

  let collected = 0;
  for (const rate of rates) {
    await createCompetitorRate(
      metadata.tenantId,
      propertyId,
      {
        competitorName: rate.competitor_name,
        competitorPropertyName: rate.competitor_property_name ?? null,
        roomTypeCategory: rate.room_type_category ?? null,
        rateDate: rate.rate_date,
        rateAmount: rate.rate_amount,
        currency: rate.currency ?? "USD",
        source: rate.source ?? provider.name,
        roomsLeft: rate.rooms_left,
        estimatedOccupancyPercent: rate.estimated_occupancy_percent,
      },
      actorId,
    );
    collected++;
  }
  return { collected };
};

// ── R16: Competitive Response Rule Configure ────────

export const handleCompetitiveResponseConfigure = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ ruleId: string }> => {
  const data: CompetitiveResponseRuleInput = {
    trackCompetitor: payload.track_competitor as string,
    roomTypeId: payload.room_type_id as string | undefined,
    responseStrategy: payload.response_strategy as string,
    responseValue: (payload.response_value as number) ?? 0,
    minRate: payload.min_rate as number,
    maxRate: payload.max_rate as number,
    autoApply: (payload.auto_apply as boolean) ?? false,
    triggerThresholdPercent: (payload.trigger_threshold_percent as number) ?? 5,
    isActive: (payload.is_active as boolean) ?? true,
    notes: payload.notes as string | undefined,
  };

  return upsertCompetitiveResponseRule(
    metadata.tenantId,
    payload.property_id as string,
    data,
    actorId,
  );
};
