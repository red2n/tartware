import type { CompsetCompetitorInput } from "@tartware/schemas";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { UPSERT_COMPETITOR_PROPERTY_SQL } from "../sql/compset-queries.js";

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
    let upserted = 0;

    for (const comp of competitors) {
        await query(UPSERT_COMPETITOR_PROPERTY_SQL, [
            tenantId, // $1
            propertyId, // $2
            comp.competitorName, // $3
            comp.competitorExternalId ?? null, // $4
            comp.competitorBrand ?? null, // $5
            comp.competitorAddress ?? null, // $6
            comp.competitorCity ?? null, // $7
            comp.competitorCountry ?? null, // $8
            comp.competitorStarRating ?? null, // $9
            comp.competitorTotalRooms ?? null, // $10
            comp.competitorUrl ?? null, // $11
            comp.weight, // $12
            comp.distanceKm ?? null, // $13
            comp.marketSegment ?? null, // $14
            comp.rateShoppingSource ?? null, // $15
            comp.isPrimary, // $16
            comp.isActive, // $17
            comp.sortOrder, // $18
            comp.notes ?? null, // $19
            metadata ? JSON.stringify(metadata) : null, // $20
            actorId, // $21
        ]);
        upserted++;
    }

    logger.info({ tenantId, propertyId, upserted }, "comp set configured");
    return { upserted };
};
