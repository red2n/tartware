import { SettingsValuesSchema } from "@tartware/schemas";
import { z } from "zod";

import { query } from "../lib/db.js";

const SettingsValueArraySchema = z.array(SettingsValuesSchema);
const SettingsValueSchema = SettingsValuesSchema;

export type ValueFilters = {
  tenantId: string;
  scopeLevel?: string;
  settingId?: string;
  propertyId?: string;
  unitId?: string;
  userId?: string;
  activeOnly?: boolean;
};

export type CreateSettingsValueInput = {
  tenantId: string;
  settingId: string;
  scopeLevel: string;
  value: unknown;
  propertyId?: string | null;
  unitId?: string | null;
  userId?: string | null;
  status?: string | null;
  notes?: string | null;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
};

export type UpdateSettingsValueInput = {
  valueId: string;
  tenantId: string;
  value?: unknown;
  status?: string | null;
  notes?: string | null;
  effectiveFrom?: Date | string | null;
  effectiveTo?: Date | string | null;
  lockedUntil?: Date | string | null;
  context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  updatedBy?: string | null;
};

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
    conditions.push(`status = 'ACTIVE'`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT * FROM settings_values ${where} ORDER BY created_at DESC`,
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
     RETURNING *`,
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
     RETURNING *`,
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
