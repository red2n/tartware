import { buildValuesRows } from "@tartware/config/sql-batch";

// ── Comp Set SQL Queries ─────────────────────────────

/** Parameters each competitor row contributes to the batched upsert. */
export const COMPETITOR_UPSERT_COLUMN_COUNT = 18;

/**
 * Build a batched comp-set upsert for `rowCount` competitors.
 *
 * One statement per competitor turned a 40-property comp set into 40 round
 * trips. tenant_id, property_id and the actor are identical for every row, so
 * they stay scalar ($1, $2, $3) and only the per-competitor values repeat.
 *
 * Callers must de-duplicate by competitor_name first: Postgres rejects an
 * ON CONFLICT DO UPDATE that would touch the same row twice in one statement,
 * where the previous row-at-a-time loop simply let the later row win.
 */
export const buildCompetitorUpsertSql = (rowCount: number): string => {
  return `
  INSERT INTO public.competitor_properties (
    tenant_id, property_id, competitor_name, competitor_external_id,
    competitor_brand, competitor_address, competitor_city, competitor_country,
    competitor_star_rating, competitor_total_rooms, competitor_url,
    weight, distance_km, market_segment, rate_shopping_source,
    is_primary, is_active, sort_order, notes, metadata,
    created_by, updated_by
  ) VALUES
    ${buildValuesRows({
      rowCount,
      columnsPerRow: COMPETITOR_UPSERT_COLUMN_COUNT,
      scalarCount: 3,
      render: (p) =>
        `($1::uuid, $2::uuid, ${p(1)}, ${p(2)}, ` +
        `${p(3)}, ${p(4)}, ${p(5)}, ${p(6)}, ` +
        `${p(7)}, ${p(8)}, ${p(9)}, ` +
        `${p(10)}, ${p(11)}, ${p(12)}, ${p(13)}, ` +
        `${p(14)}, ${p(15)}, ${p(16)}, ${p(17)}, ${p(18)}::jsonb, ` +
        `$3::uuid, $3::uuid)`,
    })}
  ON CONFLICT (tenant_id, property_id, competitor_name) DO UPDATE SET
    competitor_external_id = COALESCE(EXCLUDED.competitor_external_id, competitor_properties.competitor_external_id),
    competitor_brand = COALESCE(EXCLUDED.competitor_brand, competitor_properties.competitor_brand),
    competitor_address = COALESCE(EXCLUDED.competitor_address, competitor_properties.competitor_address),
    competitor_city = COALESCE(EXCLUDED.competitor_city, competitor_properties.competitor_city),
    competitor_country = COALESCE(EXCLUDED.competitor_country, competitor_properties.competitor_country),
    competitor_star_rating = COALESCE(EXCLUDED.competitor_star_rating, competitor_properties.competitor_star_rating),
    competitor_total_rooms = COALESCE(EXCLUDED.competitor_total_rooms, competitor_properties.competitor_total_rooms),
    competitor_url = COALESCE(EXCLUDED.competitor_url, competitor_properties.competitor_url),
    weight = EXCLUDED.weight,
    distance_km = COALESCE(EXCLUDED.distance_km, competitor_properties.distance_km),
    market_segment = COALESCE(EXCLUDED.market_segment, competitor_properties.market_segment),
    rate_shopping_source = COALESCE(EXCLUDED.rate_shopping_source, competitor_properties.rate_shopping_source),
    is_primary = EXCLUDED.is_primary,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    notes = COALESCE(EXCLUDED.notes, competitor_properties.notes),
    metadata = COALESCE(EXCLUDED.metadata, competitor_properties.metadata),
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by,
    is_deleted = false,
    deleted_at = NULL,
    deleted_by = NULL
  RETURNING competitor_property_id, created_at
`;
};
