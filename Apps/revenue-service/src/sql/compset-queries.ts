// ── Comp Set SQL Queries ─────────────────────────────

/**
 * Upsert a competitor property into the comp set.
 * Uses ON CONFLICT on (tenant_id, property_id, competitor_name) to update existing.
 */
export const UPSERT_COMPETITOR_PROPERTY_SQL = `
  INSERT INTO public.competitor_properties (
    tenant_id, property_id, competitor_name, competitor_external_id,
    competitor_brand, competitor_address, competitor_city, competitor_country,
    competitor_star_rating, competitor_total_rooms, competitor_url,
    weight, distance_km, market_segment, rate_shopping_source,
    is_primary, is_active, sort_order, notes, metadata,
    created_by, updated_by
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4,
    $5, $6, $7, $8,
    $9, $10, $11,
    $12, $13, $14, $15,
    $16, $17, $18, $19, $20::jsonb,
    $21::uuid, $21::uuid
  )
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
