import type { CompsetCompetitorInput } from "@tartware/schemas";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { buildCompetitorUpsertSql } from "../sql/compset-queries.js";

const logger = appLogger.child({ module: "compset-service" });

/**
 * Upsert multiple competitor properties into the comp set for a property.
 * Uses ON CONFLICT to update existing entries by competitor_name.
 */
export const configureCompset = async (
  tenantId: string,
  propertyId: string,
  competitors: CompsetCompetitorInput[],
  actorId: string | null,
  metadata?: Record<string, unknown> | null,
): Promise<{ upserted: number }> => {
  // Postgres rejects an ON CONFLICT DO UPDATE that would touch the same row
  // twice in one statement. The previous row-at-a-time loop let a repeated
  // competitor_name overwrite the earlier entry, so keep that: last one wins.
  const deduped = new Map<string, CompsetCompetitorInput>();
  for (const comp of competitors) {
    deduped.set(comp.competitorName, comp);
  }
  const rows = [...deduped.values()];

  if (rows.length === 0) {
    logger.info({ tenantId, propertyId, upserted: 0 }, "comp set configured");
    return { upserted: 0 };
  }

  const params: unknown[] = [tenantId, propertyId, actorId];
  for (const comp of rows) {
    params.push(
      comp.competitorName,
      comp.competitorExternalId ?? null,
      comp.competitorBrand ?? null,
      comp.competitorAddress ?? null,
      comp.competitorCity ?? null,
      comp.competitorCountry ?? null,
      comp.competitorStarRating ?? null,
      comp.competitorTotalRooms ?? null,
      comp.competitorUrl ?? null,
      comp.weight,
      comp.distanceKm ?? null,
      comp.marketSegment ?? null,
      comp.rateShoppingSource ?? null,
      comp.isPrimary,
      comp.isActive,
      comp.sortOrder,
      comp.notes ?? null,
      metadata ? JSON.stringify(metadata) : null,
    );
  }

  const result = await query(buildCompetitorUpsertSql(rows.length), params);
  const upserted = result.rowCount ?? rows.length;

  logger.info({ tenantId, propertyId, upserted }, "comp set configured");
  return { upserted };
};
