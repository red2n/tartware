import type { QueryResultRow } from "pg";

import { query } from "../lib/db.js";

export type AmenityCatalogRow = {
  id: string;
  tenantId: string;
  propertyId: string;
  amenityCode: string;
  amenityName: string;
  category: string;
  description: string | null;
  icon: string | null;
  isDefault: boolean;
  isActive: boolean;
  rank: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date | null;
};

export type ListAmenitiesInput = {
  tenantId: string;
  propertyId: string;
  includeInactive?: boolean;
};

export type InsertAmenityInput = {
  tenantId: string;
  propertyId: string;
  amenityCode: string;
  amenityName: string;
  category: string;
  description?: string;
  icon?: string;
  isDefault?: boolean;
  isActive?: boolean;
  rank?: number;
  metadata?: Record<string, unknown>;
};

export type UpdateAmenityInput = {
  tenantId: string;
  propertyId: string;
  amenityCode: string;
  amenityName?: string;
  category?: string;
  description?: string | null;
  icon?: string | null;
  isActive?: boolean;
  rank?: number;
  metadata?: Record<string, unknown>;
};

const amenityColumns = `
  id::text AS "id",
  tenant_id::text AS "tenantId",
  property_id::text AS "propertyId",
  amenity_code AS "amenityCode",
  amenity_name AS "amenityName",
  category,
  description,
  icon,
  is_default AS "isDefault",
  is_active AS "isActive",
  rank,
  metadata,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

/**
 * Returns amenity catalog rows for a property/tenant pair.
 */
export const listAmenities = async ({
  tenantId,
  propertyId,
  includeInactive = false,
}: ListAmenitiesInput): Promise<AmenityCatalogRow[]> => {
  const result = await query<AmenityCatalogRow & QueryResultRow>(
    `
      SELECT ${amenityColumns}
      FROM room_amenity_catalog
      WHERE tenant_id = $1
        AND property_id = $2
        ${includeInactive ? "" : "AND is_active = TRUE"}
      ORDER BY rank ASC, amenity_name ASC
    `,
    [tenantId, propertyId],
  );
  return result.rows.map((row) => ({
    ...row,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  }));
};

/**
 * Persists a new amenity catalog row for a property.
 */
export const insertAmenity = async (input: InsertAmenityInput): Promise<AmenityCatalogRow> => {
  const result = await query<AmenityCatalogRow & QueryResultRow>(
    `
      INSERT INTO room_amenity_catalog (
        tenant_id,
        property_id,
        amenity_code,
        amenity_name,
        category,
        description,
        icon,
        is_default,
        is_active,
        rank,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        COALESCE($9, TRUE),
        COALESCE($10, 0),
        $11::jsonb
      )
      RETURNING ${amenityColumns}
    `,
    [
      input.tenantId,
      input.propertyId,
      input.amenityCode,
      input.amenityName,
      input.category,
      input.description ?? null,
      input.icon ?? null,
      input.isDefault ?? false,
      input.isActive ?? true,
      input.rank ?? 0,
      JSON.stringify(input.metadata ?? {}),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to insert amenity catalog row");
  }
  return {
    ...row,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  };
};

/**
 * Updates an amenity row in-place and returns the latest state.
 */
export const updateAmenity = async (
  input: UpdateAmenityInput,
): Promise<AmenityCatalogRow | null> => {
  const updates: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  if (input.amenityName !== undefined) {
    updates.push(`amenity_name = $${index}`);
    values.push(input.amenityName);
    index += 1;
  }
  if (input.category !== undefined) {
    updates.push(`category = $${index}`);
    values.push(input.category);
    index += 1;
  }
  if (input.description !== undefined) {
    updates.push(`description = $${index}`);
    values.push(input.description);
    index += 1;
  }
  if (input.icon !== undefined) {
    updates.push(`icon = $${index}`);
    values.push(input.icon);
    index += 1;
  }
  if (input.isActive !== undefined) {
    updates.push(`is_active = $${index}`);
    values.push(input.isActive);
    index += 1;
  }
  if (input.rank !== undefined) {
    updates.push(`rank = $${index}`);
    values.push(input.rank);
    index += 1;
  }
  if (input.metadata !== undefined) {
    updates.push(`metadata = $${index}::jsonb`);
    values.push(JSON.stringify(input.metadata));
    index += 1;
  }

  if (updates.length === 0) {
    return null;
  }

  const tenantIndex = index;
  values.push(input.tenantId);
  const propertyIndex = index + 1;
  values.push(input.propertyId);
  const codeIndex = index + 2;
  values.push(input.amenityCode);

  const result = await query<AmenityCatalogRow & QueryResultRow>(
    `
      UPDATE room_amenity_catalog
      SET ${updates.join(", ")}, updated_at = NOW()
      WHERE tenant_id = $${tenantIndex}
        AND property_id = $${propertyIndex}
        AND amenity_code = $${codeIndex}
      RETURNING ${amenityColumns}
    `,
    values,
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    ...row,
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
  };
};
