import {
  type RoomCategoryListQuery,
  type RoomCategoryReferenceItem,
  RoomCategoryReferenceItemSchema,
  type RoomCategoryReferenceRow,
} from "@tartware/schemas";

import { cacheService } from "../lib/cache.js";
import { query } from "../lib/db.js";

const ROOM_CATEGORY_LIST_SQL = `
  WITH ranked_categories AS (
    SELECT
      rc.category_id,
      rc.code,
      rc.name,
      rc.description,
      rc.legacy_enum_value,
      rc.display_order,
      rc.is_system,
      rc.is_active,
      ROW_NUMBER() OVER (
        PARTITION BY rc.code
        ORDER BY
          CASE
            WHEN $2::uuid IS NOT NULL AND rc.property_id = $2::uuid THEN 0
            WHEN rc.tenant_id = $1::uuid THEN 1
            ELSE 2
          END,
          rc.display_order ASC,
          rc.name ASC
      ) AS rank_order
    FROM public.room_categories rc
    WHERE rc.deleted_at IS NULL
      AND ($3::boolean IS NULL OR rc.is_active = $3::boolean)
      AND (rc.tenant_id IS NULL OR rc.tenant_id = $1::uuid)
      AND (
        $2::uuid IS NULL
        OR rc.property_id IS NULL
        OR rc.property_id = $2::uuid
      )
      AND rc.legacy_enum_value IS NOT NULL
  )
  SELECT
    category_id,
    code,
    name,
    description,
    legacy_enum_value,
    display_order,
    is_system,
    is_active
  FROM ranked_categories
  WHERE rank_order = 1
  ORDER BY display_order ASC, name ASC
`;

const ROOM_CATEGORY_COMPATIBILITY_SQL = `
  SELECT rc.legacy_enum_value
  FROM public.room_categories rc
  WHERE rc.deleted_at IS NULL
    AND rc.is_active = true
    AND (rc.tenant_id IS NULL OR rc.tenant_id = $1::uuid)
    AND (
      $2::uuid IS NULL
      OR rc.property_id IS NULL
      OR rc.property_id = $2::uuid
    )
    AND (
      rc.code = $3::text
      OR rc.legacy_enum_value = $3::text
    )
  ORDER BY
    CASE
      WHEN $2::uuid IS NOT NULL AND rc.property_id = $2::uuid THEN 0
      WHEN rc.tenant_id = $1::uuid THEN 1
      ELSE 2
    END,
    rc.display_order ASC,
    rc.name ASC
  LIMIT 1
`;

const RATE_TYPE_COMPATIBILITY_SQL = `
  SELECT rt.legacy_enum_value
  FROM public.rate_types rt
  WHERE rt.deleted_at IS NULL
    AND rt.is_active = true
    AND (rt.tenant_id IS NULL OR rt.tenant_id = $1::uuid)
    AND (
      $2::uuid IS NULL
      OR rt.property_id IS NULL
      OR rt.property_id = $2::uuid
    )
    AND (
      rt.code = $3::text
      OR rt.legacy_enum_value = $3::text
    )
  ORDER BY
    CASE
      WHEN $2::uuid IS NOT NULL AND rt.property_id = $2::uuid THEN 0
      WHEN rt.tenant_id = $1::uuid THEN 1
      ELSE 2
    END,
    rt.display_order ASC,
    rt.name ASC
  LIMIT 1
`;

export class ReferenceDataCompatibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReferenceDataCompatibilityError";
  }
}

const REFERENCE_DATA_CACHE_PREFIX = "reference-data";

const buildScopedCacheKey = (
  domain: string,
  tenantId: string,
  propertyId: string | undefined,
  suffix: string,
): string => `${domain}:${tenantId}:${propertyId ?? "global"}:${suffix}`;

const mapRoomCategoryRow = (row: RoomCategoryReferenceRow): RoomCategoryReferenceItem =>
  RoomCategoryReferenceItemSchema.parse({
    category_id: row.category_id,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    legacy_enum_value: row.legacy_enum_value,
    display_order: row.display_order ?? 0,
    is_system: row.is_system ?? false,
    is_active: row.is_active ?? true,
  });

const resolveLegacyEnumValue = async (
  sql: string,
  domain: string,
  tenantId: string,
  propertyId: string | undefined,
  codeOrLegacyValue: string | undefined,
  fieldLabel: string,
  options?: {
    allowUnmapped?: boolean;
  },
): Promise<string | undefined> => {
  if (!codeOrLegacyValue) {
    return undefined;
  }

  const normalized = codeOrLegacyValue.trim().toUpperCase();
  const cacheKey = buildScopedCacheKey(domain, tenantId, propertyId, normalized);
  const cached = await cacheService.get<string>(cacheKey, {
    prefix: REFERENCE_DATA_CACHE_PREFIX,
    ttl: 300,
  });
  if (cached) {
    return cached;
  }

  const { rows } = await query<{ legacy_enum_value: string | null }>(sql, [
    tenantId,
    propertyId ?? null,
    normalized,
  ]);

  const legacyValue = rows[0]?.legacy_enum_value?.trim().toUpperCase();
  if (legacyValue) {
    await cacheService.set(cacheKey, legacyValue, {
      prefix: REFERENCE_DATA_CACHE_PREFIX,
      ttl: 300,
    });
    return legacyValue;
  }

  if (options?.allowUnmapped) {
    await cacheService.set(cacheKey, normalized, {
      prefix: REFERENCE_DATA_CACHE_PREFIX,
      ttl: 300,
    });
    return normalized;
  }

  throw new ReferenceDataCompatibilityError(
    `${fieldLabel} '${normalized}' is not mapped to legacy enum storage yet.`,
  );
};

export const listRoomCategories = async (
  queryInput: RoomCategoryListQuery,
): Promise<RoomCategoryReferenceItem[]> => {
  const cacheKey = buildScopedCacheKey(
    "room-categories:list",
    queryInput.tenant_id,
    queryInput.property_id,
    queryInput.is_active === undefined ? "active-default" : `active-${queryInput.is_active}`,
  );
  const cached = await cacheService.get<RoomCategoryReferenceItem[]>(cacheKey, {
    prefix: REFERENCE_DATA_CACHE_PREFIX,
    ttl: 300,
  });
  if (cached) {
    return cached;
  }

  const { rows } = await query<RoomCategoryReferenceRow>(ROOM_CATEGORY_LIST_SQL, [
    queryInput.tenant_id,
    queryInput.property_id ?? null,
    queryInput.is_active ?? true,
  ]);

  const categories = rows.map(mapRoomCategoryRow);
  await cacheService.set(cacheKey, categories, {
    prefix: REFERENCE_DATA_CACHE_PREFIX,
    ttl: 300,
  });

  return categories;
};

export const resolveLegacyRoomCategoryValue = async (input: {
  tenantId: string;
  propertyId?: string;
  category?: string;
}): Promise<string | undefined> =>
  resolveLegacyEnumValue(
    ROOM_CATEGORY_COMPATIBILITY_SQL,
    "room-categories:legacy",
    input.tenantId,
    input.propertyId,
    input.category,
    "Room category",
  );

export const resolveLegacyRateTypeValue = async (input: {
  tenantId: string;
  propertyId?: string;
  rateType?: string;
  allowUnmapped?: boolean;
}): Promise<string | undefined> =>
  resolveLegacyEnumValue(
    RATE_TYPE_COMPATIBILITY_SQL,
    "rate-types:legacy",
    input.tenantId,
    input.propertyId,
    input.rateType,
    "Rate type",
    { allowUnmapped: input.allowUnmapped },
  );
