import {
  CreateRoomAmenitySchema,
  RoomAmenityCatalogSchema,
  UpdateRoomAmenitySchema,
} from "@tartware/schemas";
import type { QueryResultRow } from "pg";
import { z } from "zod";

import { query } from "../lib/db.js";

const amenityRowSchema = RoomAmenityCatalogSchema.transform((row) => ({
  id: row.id,
  tenantId: row.tenant_id,
  propertyId: row.property_id,
  amenityCode: row.amenity_code,
  displayName: row.display_name,
  description: row.description ?? undefined,
  category: row.category,
  icon: row.icon ?? undefined,
  tags: row.tags ?? [],
  sortOrder: row.sort_order ?? 0,
  isDefault: row.is_default ?? false,
  isActive: row.is_active ?? true,
  isRequired: row.is_required ?? false,
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? undefined,
  createdBy: row.created_by ?? undefined,
  updatedBy: row.updated_by ?? undefined,
}));

export type AmenityRecord = z.infer<typeof amenityRowSchema>;

const AMENITY_COLUMNS = `
  id,
  tenant_id,
  property_id,
  amenity_code,
  display_name,
  description,
  category,
  icon,
  tags,
  sort_order,
  is_default,
  is_active,
  is_required,
  metadata,
  created_at,
  updated_at,
  created_by,
  updated_by
`;

const parseRows = (rows: QueryResultRow[]): AmenityRecord[] =>
  z.array(amenityRowSchema).parse(rows);

type ListAmenitiesInput = {
  tenantId: string;
  propertyId: string;
};

export const listAmenities = async ({
  tenantId,
  propertyId,
}: ListAmenitiesInput): Promise<AmenityRecord[]> => {
  const result = await query(
    `
      SELECT ${AMENITY_COLUMNS}
      FROM room_amenity_catalog
      WHERE tenant_id = $1 AND property_id = $2
      ORDER BY sort_order ASC, display_name ASC
    `,
    [tenantId, propertyId],
  );
  return parseRows(result.rows);
};

type GetAmenityInput = ListAmenitiesInput & {
  amenityCode: string;
};

export const getAmenityByCode = async ({
  tenantId,
  propertyId,
  amenityCode,
}: GetAmenityInput): Promise<AmenityRecord | null> => {
  const result = await query(
    `
      SELECT ${AMENITY_COLUMNS}
      FROM room_amenity_catalog
      WHERE tenant_id = $1 AND property_id = $2 AND amenity_code = $3
      LIMIT 1
    `,
    [tenantId, propertyId, amenityCode],
  );
  if (result.rowCount === 0) {
    return null;
  }
  return amenityRowSchema.parse(result.rows[0]);
};

type CreateAmenityInput = ListAmenitiesInput & {
  createdBy: string;
  payload: {
    amenityCode: string;
    displayName: string;
    description?: string;
    category?: string;
    icon?: string;
    tags?: string[];
    sortOrder?: number;
    isDefault?: boolean;
    isActive?: boolean;
    isRequired?: boolean;
    metadata?: Record<string, unknown>;
  };
};

export const createAmenity = async ({
  tenantId,
  propertyId,
  createdBy,
  payload,
}: CreateAmenityInput): Promise<AmenityRecord> => {
  const parsed = CreateRoomAmenitySchema.parse({
    tenant_id: tenantId,
    property_id: propertyId,
    amenity_code: payload.amenityCode.toUpperCase(),
    display_name: payload.displayName,
    description: payload.description ?? null,
    category: payload.category ?? "GENERAL",
    icon: payload.icon ?? null,
    tags: payload.tags ?? [],
    sort_order: payload.sortOrder ?? 0,
    is_default: payload.isDefault ?? false,
    is_active: payload.isActive ?? true,
    is_required: payload.isRequired ?? false,
    metadata: payload.metadata ?? {},
    created_by: createdBy,
  });

  const result = await query(
    `
      INSERT INTO room_amenity_catalog (
        tenant_id,
        property_id,
        amenity_code,
        display_name,
        description,
        category,
        icon,
        tags,
        sort_order,
        is_default,
        is_active,
        is_required,
        metadata,
        created_by,
        updated_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $14
      )
      RETURNING ${AMENITY_COLUMNS}
    `,
    [
      parsed.tenant_id,
      parsed.property_id,
      parsed.amenity_code,
      parsed.display_name,
      parsed.description,
      parsed.category,
      parsed.icon,
      parsed.tags,
      parsed.sort_order,
      parsed.is_default,
      parsed.is_active,
      parsed.is_required,
      parsed.metadata ?? {},
      parsed.created_by ?? createdBy,
    ],
  );

  return amenityRowSchema.parse(result.rows[0]);
};

type UpdateAmenityInput = GetAmenityInput & {
  updatedBy: string;
  payload: {
    displayName?: string;
    description?: string | null;
    category?: string;
    icon?: string | null;
    tags?: string[];
    sortOrder?: number;
    isActive?: boolean;
    isRequired?: boolean;
    metadata?: Record<string, unknown>;
  };
};

export const updateAmenity = async ({
  tenantId,
  propertyId,
  amenityCode,
  updatedBy,
  payload,
}: UpdateAmenityInput): Promise<AmenityRecord | null> => {
  const parsed = UpdateRoomAmenitySchema.parse({
    display_name: payload.displayName,
    description: payload.description ?? undefined,
    category: payload.category,
    icon: payload.icon ?? undefined,
    tags: payload.tags,
    sort_order: payload.sortOrder,
    is_active: payload.isActive,
    is_required: payload.isRequired,
    metadata: payload.metadata,
    updated_by: updatedBy,
  });

  const fields: string[] = [];
  const values: unknown[] = [];

  (
    [
      ["display_name", parsed.display_name],
      ["description", parsed.description ?? null],
      ["category", parsed.category],
      ["icon", parsed.icon ?? null],
      ["tags", parsed.tags],
      ["sort_order", parsed.sort_order],
      ["is_active", parsed.is_active],
      ["is_required", parsed.is_required],
      ["metadata", parsed.metadata],
    ] as const
  ).forEach(([column, value]) => {
    if (value === undefined) {
      return;
    }
    values.push(value);
    fields.push(`${column} = $${values.length + 3}`);
  });

  if (fields.length === 0) {
    const existing = await getAmenityByCode({ tenantId, propertyId, amenityCode });
    return existing;
  }

  values.push(updatedBy);
  fields.push(`updated_by = $${values.length + 3}`);
  fields.push("updated_at = NOW()");

  const result = await query(
    `
      UPDATE room_amenity_catalog
      SET ${fields.join(", ")}
      WHERE tenant_id = $1 AND property_id = $2 AND amenity_code = $3
      RETURNING ${AMENITY_COLUMNS}
    `,
    [tenantId, propertyId, amenityCode, ...values],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return amenityRowSchema.parse(result.rows[0]);
};
