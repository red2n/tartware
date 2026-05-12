import {
  type CreateSettingsValueInput,
  SettingsValuesSchema,
  type UpdateSettingsValueInput,
  type SettingsValueFilters as ValueFilters,
} from "@tartware/schemas";
import type { PoolClient } from "pg";
import { z } from "zod";

import { query, queryWithClient, withTransaction } from "../lib/db.js";

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
  const conditions: string[] = ["sv.tenant_id = $1"];
  const params: unknown[] = [filters.tenantId];
  let joinDefinitions = false;

  if (filters.scopeLevel) {
    params.push(filters.scopeLevel);
    conditions.push(`sv.scope_level = $${params.length}`);
  }
  if (filters.settingId) {
    params.push(filters.settingId);
    conditions.push(`sv.setting_id = $${params.length}`);
  }
  if (filters.settingCode) {
    joinDefinitions = true;
    params.push(filters.settingCode);
    conditions.push(`sd.code = $${params.length}`);
  }
  if (filters.settingCodes && filters.settingCodes.length > 0) {
    joinDefinitions = true;
    params.push(filters.settingCodes);
    conditions.push(`sd.code = ANY($${params.length})`);
  }
  if (filters.propertyId) {
    params.push(filters.propertyId);
    conditions.push(`sv.property_id = $${params.length}`);
  }
  if (filters.unitId) {
    params.push(filters.unitId);
    conditions.push(`sv.unit_id = $${params.length}`);
  }
  if (filters.userId) {
    params.push(filters.userId);
    conditions.push(`sv.user_id = $${params.length}`);
  }
  if (filters.activeOnly) {
    params.push("ACTIVE");
    conditions.push(`sv.status = $${params.length}`);
  }

  const codeColumn = joinDefinitions ? ", sd.code AS setting_code" : "";
  const joinClause = joinDefinitions ? "JOIN settings_definitions sd ON sd.id = sv.setting_id" : "";
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT sv.id, sv.setting_id, sv.scope_level, sv.tenant_id, sv.property_id, sv.unit_id, sv.user_id,
            sv.value, sv.is_overridden, sv.is_inherited, sv.inheritance_path, sv.inherited_from_value_id,
            sv.locked_until, sv.effective_from, sv.effective_to, sv.source, sv.status, sv.notes,
            sv.context, sv.metadata,
            sv.created_at, sv.updated_at, sv.created_by, sv.updated_by
            ${codeColumn}
     FROM settings_values sv
     ${joinClause}
     ${where}
     ORDER BY sv.created_at DESC`,
    params,
  );
  return SettingsValueArraySchema.parse(rows);
};

export const createValue = async (input: CreateSettingsValueInput) => {
  return await withTransaction(async (client) => {
    const { rows } = await queryWithClient(
      client,
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
    const created = SettingsValueSchema.parse(rows[0]);

    // Emit hot-reload event (INSIDE transaction)
    await enqueueSettingsEvent(created, client);

    return created;
  });
};

export const updateValue = async (input: UpdateSettingsValueInput) => {
  return await withTransaction(async (client) => {
    const { rows } = await queryWithClient(
      client,
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
    const updated = SettingsValueSchema.parse(rows[0]);

    // Emit hot-reload event (INSIDE transaction)
    await enqueueSettingsEvent(updated, client);

    return updated;
  });
};

/**
 * Enqueue a settings.value.set event in the transactional outbox.
 */
async function enqueueSettingsEvent(
  value: z.infer<typeof SettingsValueSchema>,
  client: PoolClient,
) {
  // Fetch setting code to include in event for easier consumption
  const { rows } = await queryWithClient(
    client,
    "SELECT code FROM settings_definitions WHERE id = $1",
    [value.setting_id],
  );
  const code = rows[0]?.code;

  await queryWithClient(
    client,
    `INSERT INTO transactional_outbox (
      tenant_id, aggregate_id, aggregate_type, event_type, payload, partition_key
    ) VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      value.tenant_id,
      value.setting_id,
      "setting",
      "settings.value.set",
      JSON.stringify({
        type: "settings.value.set",
        payload: {
          tenant_id: value.tenant_id,
          property_id: value.property_id ?? null,
          code,
          value: value.value,
        },
      }),
      value.tenant_id, // Partition by tenant for consistency
    ],
  );
}
