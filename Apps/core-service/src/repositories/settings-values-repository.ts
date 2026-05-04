import {
  type CreateSettingsValueInput,
  SettingsValuesSchema,
  type UpdateSettingsValueInput,
  type SettingsValueFilters as ValueFilters,
} from "@tartware/schemas";
import { z } from "zod";

import { query } from "../lib/db.js";

const SettingsValueArraySchema = z.array(SettingsValuesSchema);
const SettingsValueSchema = SettingsValuesSchema;

/**
 * Canonical column list for the `settings_values` table.
 * Kept in sync with the `SettingsValuesSchema` Zod schema in `@tartware/schemas`.
 * Avoids `SELECT *` per AGENTS.md data-access rules.
 */
const SETTINGS_VALUE_COLUMNS = `
  id, setting_id, scope_level, tenant_id, property_id, unit_id, user_id,
  value, is_overridden, is_inherited, inheritance_path, inherited_from_value_id,
  locked_until, effective_from, effective_to, source, status, notes,
  context, metadata,
  created_at, updated_at, created_by, updated_by
`;

export type { ValueFilters, CreateSettingsValueInput, UpdateSettingsValueInput };

export const listValues = async (filters: ValueFilters) => {
  const conditions: string[] = ["tenant_id = $1"];
  const params: unknown[] = [filters.tenantId];

  if (filters.scopeLevel) {
    params.push(filters.scopeLevel);
    conditions.push(`scope_level = $${params.length}`);
  }
  if (filters.settingId) {
    params.push(filters.settingId);
    conditions.push(`setting_id = $${params.length}`);
  }
  if (filters.propertyId) {
    params.push(filters.propertyId);
    conditions.push(`property_id = $${params.length}`);
  }
  if (filters.unitId) {
    params.push(filters.unitId);
    conditions.push(`unit_id = $${params.length}`);
  }
  if (filters.userId) {
    params.push(filters.userId);
    conditions.push(`user_id = $${params.length}`);
  }
  if (filters.activeOnly) {
    params.push("ACTIVE");
    conditions.push(`status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT ${SETTINGS_VALUE_COLUMNS} FROM settings_values ${where} ORDER BY created_at DESC`,
    params,
  );
  return SettingsValueArraySchema.parse(rows);
};

export const createValue = async (input: CreateSettingsValueInput) => {
  const { rows } = await query(
    `INSERT INTO settings_values
      (setting_id, scope_level, tenant_id, property_id, unit_id, user_id, value, status, notes, effective_from, effective_to, context, metadata, created_by, updated_by)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'ACTIVE'), $9, $10, $11, COALESCE($12, '{}'::jsonb), COALESCE($13, '{}'::jsonb), $14, $14)
     RETURNING ${SETTINGS_VALUE_COLUMNS}`,
    [
      input.settingId,
      input.scopeLevel,
      input.tenantId,
      input.propertyId ?? null,
      input.unitId ?? null,
      input.userId ?? null,
      input.value ?? null,
      input.status ?? null,
      input.notes ?? null,
      input.effectiveFrom ?? null,
      input.effectiveTo ?? null,
      input.context ?? null,
      input.metadata ?? null,
      input.createdBy ?? null,
    ],
  );
  return SettingsValueSchema.parse(rows[0]);
};

export const updateValue = async (input: UpdateSettingsValueInput) => {
  const { rows } = await query(
    `UPDATE settings_values
     SET value = COALESCE($1, value),
         status = COALESCE($2, status),
         notes = COALESCE($3, notes),
         effective_from = COALESCE($4, effective_from),
         effective_to = COALESCE($5, effective_to),
         locked_until = COALESCE($6, locked_until),
         context = COALESCE($7, context),
         metadata = COALESCE($8, metadata),
         updated_at = NOW(),
         updated_by = COALESCE($9, updated_by)
     WHERE id = $10 AND tenant_id = $11
     RETURNING ${SETTINGS_VALUE_COLUMNS}`,
    [
      input.value ?? null,
      input.status ?? null,
      input.notes ?? null,
      input.effectiveFrom ?? null,
      input.effectiveTo ?? null,
      input.lockedUntil ?? null,
      input.context ?? null,
      input.metadata ?? null,
      input.updatedBy ?? null,
      input.valueId,
      input.tenantId,
    ],
  );

  if (!rows[0]) {
    return null;
  }
  return SettingsValueSchema.parse(rows[0]);
};
