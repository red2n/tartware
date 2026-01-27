import { config } from "../config.js";
import { createSeedValue, listSeedValues, updateSeedValue } from "../data/settings-values-store.js";
import { query } from "../lib/db.js";
import {
  SettingsValueApproveCommandSchema,
  SettingsValueBulkSetCommandSchema,
  SettingsValueRevertCommandSchema,
  type SettingsValueSetCommand,
  SettingsValueSetCommandSchema,
} from "../schemas/settings-commands.js";

type CommandContext = {
  tenantId: string;
  initiatedBy?: {
    userId?: string;
  } | null;
};

type SettingsValueScope = {
  setting_id: string;
  scope_level: string;
  property_id: string | null;
  unit_id: string | null;
  user_id: string | null;
};

type SettingsValueRow = SettingsValueScope & {
  id: string;
  status: string;
};

class SettingsCommandError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const APP_ACTOR = "COMMAND_CENTER";

const isDbEnabled = () => config.settings.dataSource === "db";

const mergeMetadata = (
  base?: Record<string, unknown> | null,
  extra?: Record<string, unknown> | null,
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...(base ?? {}) };
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) {
        merged[key] = value;
      }
    }
  }
  return merged;
};

const withIdempotencyKey = (
  base: Record<string, unknown> | undefined,
  idempotencyKey?: string,
): Record<string, unknown> | undefined => {
  if (!idempotencyKey) {
    return base ?? undefined;
  }
  return mergeMetadata(base, { idempotency_key: idempotencyKey });
};

const normalizeIdempotencyKey = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const findValueByIdempotencyKey = async (
  tenantId: string,
  idempotencyKey: string,
): Promise<SettingsValueRow | null> => {
  const { rows } = await query<SettingsValueRow>(
    `
      SELECT id, setting_id, scope_level, property_id, unit_id, user_id, status
      FROM settings_values
      WHERE tenant_id = $1::uuid
        AND metadata ->> 'idempotency_key' = $2
      LIMIT 1
    `,
    [tenantId, idempotencyKey],
  );
  return rows[0] ?? null;
};

const findPendingValue = async (
  tenantId: string,
  command: SettingsValueSetCommand,
): Promise<SettingsValueRow | null> => {
  const { rows } = await query<SettingsValueRow>(
    `
      SELECT id, setting_id, scope_level, property_id, unit_id, user_id, status
      FROM settings_values
      WHERE tenant_id = $1::uuid
        AND setting_id = $2::uuid
        AND scope_level = $3
        AND property_id IS NOT DISTINCT FROM $4::uuid
        AND unit_id IS NOT DISTINCT FROM $5::uuid
        AND user_id IS NOT DISTINCT FROM $6::uuid
        AND status = 'PENDING'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [
      tenantId,
      command.setting_id,
      command.scope_level,
      command.property_id ?? null,
      command.unit_id ?? null,
      command.user_id ?? null,
    ],
  );
  return rows[0] ?? null;
};

const applySettingsValueSet = async (
  command: SettingsValueSetCommand,
  context: CommandContext,
  actor: string,
): Promise<string> => {
  const idempotencyKey = normalizeIdempotencyKey(command.idempotency_key);

  if (idempotencyKey && isDbEnabled()) {
    const existing = await findValueByIdempotencyKey(context.tenantId, idempotencyKey);
    if (existing) {
      return existing.id;
    }
  }

  if (!isDbEnabled()) {
    const existing = listSeedValues({
      tenantId: context.tenantId,
      scopeLevel: command.scope_level,
      settingId: command.setting_id,
      propertyId: command.property_id ?? undefined,
      unitId: command.unit_id ?? undefined,
      userId: command.user_id ?? undefined,
    }).find((value) => value.status === "PENDING");

    if (existing) {
      const updated = updateSeedValue({
        valueId: existing.id,
        tenantId: context.tenantId,
        value: command.value ?? null,
        status: "PENDING",
        notes: command.notes ?? null,
        context: command.context ?? null,
        metadata: withIdempotencyKey(command.metadata, idempotencyKey),
        updatedBy: actor,
      });
      if (!updated) {
        throw new SettingsCommandError(
          "SETTINGS_VALUE_NOT_FOUND",
          "Unable to update pending setting value.",
        );
      }
      return updated.id;
    }

    const created = createSeedValue({
      tenantId: context.tenantId,
      settingId: command.setting_id,
      scopeLevel: command.scope_level,
      value: command.value ?? null,
      propertyId: command.property_id ?? null,
      unitId: command.unit_id ?? null,
      userId: command.user_id ?? null,
      status: "PENDING",
      notes: command.notes ?? null,
      context: command.context ?? null,
      metadata: withIdempotencyKey(command.metadata, idempotencyKey),
      createdBy: actor,
    });
    return created.id;
  }

  const pending = await findPendingValue(context.tenantId, command);
  const metadata = withIdempotencyKey(command.metadata, idempotencyKey);
  const contextPayload = command.context ? JSON.stringify(command.context) : null;

  if (pending) {
    const { rows } = await query<{ id: string }>(
      `
        UPDATE settings_values
        SET
          value = $1,
          notes = CASE
            WHEN $2 IS NULL THEN notes
            WHEN notes IS NULL THEN $2
            ELSE CONCAT_WS(E'\\n', notes, $2)
          END,
          context = CASE
            WHEN $3 IS NULL THEN context
            ELSE COALESCE(context, '{}'::jsonb) || $3::jsonb
          END,
          metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
          status = 'PENDING',
          updated_at = NOW(),
          updated_by = $5
        WHERE id = $6::uuid AND tenant_id = $7::uuid
        RETURNING id
      `,
      [
        command.value ?? null,
        command.notes ?? null,
        contextPayload,
        JSON.stringify(metadata ?? {}),
        actor,
        pending.id,
        context.tenantId,
      ],
    );
    const id = rows[0]?.id;
    if (!id) {
      throw new SettingsCommandError(
        "SETTINGS_VALUE_UPDATE_FAILED",
        "Failed to update pending setting value.",
      );
    }
    return id;
  }

  const { rows } = await query<{ id: string }>(
    `
      INSERT INTO settings_values (
        setting_id,
        scope_level,
        tenant_id,
        property_id,
        unit_id,
        user_id,
        value,
        status,
        notes,
        context,
        metadata,
        source,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2,
        $3::uuid,
        $4::uuid,
        $5::uuid,
        $6::uuid,
        $7,
        'PENDING',
        $8,
        COALESCE($9::jsonb, '{}'::jsonb),
        COALESCE($10::jsonb, '{}'::jsonb),
        'API',
        $11,
        $11
      )
      RETURNING id
    `,
    [
      command.setting_id,
      command.scope_level,
      context.tenantId,
      command.property_id ?? null,
      command.unit_id ?? null,
      command.user_id ?? null,
      command.value ?? null,
      command.notes ?? null,
      command.context ? JSON.stringify(command.context) : null,
      JSON.stringify(metadata ?? {}),
      actor,
    ],
  );

  const id = rows[0]?.id;
  if (!id) {
    throw new SettingsCommandError(
      "SETTINGS_VALUE_CREATE_FAILED",
      "Failed to create pending setting value.",
    );
  }
  return id;
};

export const setSettingsValue = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = SettingsValueSetCommandSchema.parse(payload);
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  return applySettingsValueSet(command, context, actor);
};

export const bulkSetSettingsValues = async (
  payload: unknown,
  context: CommandContext,
): Promise<string[]> => {
  const command = SettingsValueBulkSetCommandSchema.parse(payload);
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const bulkKey = normalizeIdempotencyKey(command.idempotency_key);
  const ids: string[] = [];

  for (const entry of command.entries) {
    const entryKey = bulkKey
      ? [
          bulkKey,
          entry.setting_id,
          entry.scope_level,
          entry.property_id ?? "",
          entry.unit_id ?? "",
          entry.user_id ?? "",
        ]
          .map((value) => String(value))
          .join(":")
      : undefined;
    const combinedNotes = entry.notes ?? command.notes ?? undefined;
    const combinedMetadata =
      command.metadata || entry.metadata
        ? mergeMetadata(command.metadata, entry.metadata)
        : undefined;
    const entryCommand: SettingsValueSetCommand = {
      ...entry,
      notes: combinedNotes,
      metadata: combinedMetadata,
      idempotency_key: entryKey,
    };
    ids.push(await applySettingsValueSet(entryCommand, context, actor));
  }

  return ids;
};

export const approveSettingsValue = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = SettingsValueApproveCommandSchema.parse(payload);
  const actor = command.approved_by ?? context.initiatedBy?.userId ?? APP_ACTOR;
  const idempotencyKey = normalizeIdempotencyKey(command.idempotency_key);

  if (idempotencyKey && isDbEnabled()) {
    const { rows } = await query<{ id: string }>(
      `
        SELECT id
        FROM settings_values
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
          AND status = 'ACTIVE'
          AND metadata ->> 'idempotency_key' = $3
        LIMIT 1
      `,
      [context.tenantId, command.setting_value_id, idempotencyKey],
    );
    const existing = rows[0]?.id;
    if (existing) {
      return existing;
    }
  }

  if (!isDbEnabled()) {
    const updated = updateSeedValue({
      valueId: command.setting_value_id,
      tenantId: context.tenantId,
      status: "ACTIVE",
      notes: command.notes ?? null,
      metadata: withIdempotencyKey(command.metadata, idempotencyKey),
      updatedBy: actor,
    });
    if (!updated) {
      throw new SettingsCommandError(
        "SETTINGS_VALUE_NOT_FOUND",
        "Unable to approve setting value.",
      );
    }
    const matching = listSeedValues({
      tenantId: context.tenantId,
      scopeLevel: updated.scope_level,
      settingId: updated.setting_id,
      propertyId: updated.property_id ?? undefined,
      unitId: updated.unit_id ?? undefined,
      userId: updated.user_id ?? undefined,
    }).filter((value) => value.id !== updated.id && value.status === "ACTIVE");
    for (const value of matching) {
      updateSeedValue({
        valueId: value.id,
        tenantId: context.tenantId,
        status: "EXPIRED",
        updatedBy: actor,
      });
    }
    return updated.id;
  }

  const metadata = withIdempotencyKey(command.metadata, idempotencyKey);
  const { rows } = await query<{ id: string }>(
    `
      WITH target AS (
        SELECT id, setting_id, scope_level, property_id, unit_id, user_id
        FROM settings_values
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
      ),
      expired AS (
        UPDATE settings_values
        SET
          status = 'EXPIRED',
          updated_at = NOW(),
          updated_by = $3
        WHERE tenant_id = $1::uuid
          AND status = 'ACTIVE'
          AND id <> $2::uuid
          AND setting_id = (SELECT setting_id FROM target)
          AND scope_level = (SELECT scope_level FROM target)
          AND property_id IS NOT DISTINCT FROM (SELECT property_id FROM target)
          AND unit_id IS NOT DISTINCT FROM (SELECT unit_id FROM target)
          AND user_id IS NOT DISTINCT FROM (SELECT user_id FROM target)
        RETURNING id
      )
      UPDATE settings_values
      SET
        status = 'ACTIVE',
        notes = CASE
          WHEN $4 IS NULL THEN notes
          WHEN notes IS NULL THEN $4
          ELSE CONCAT_WS(E'\\n', notes, $4)
        END,
        metadata = COALESCE(metadata, '{}'::jsonb) || $5::jsonb,
        updated_at = NOW(),
        updated_by = $3
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      RETURNING id
    `,
    [
      context.tenantId,
      command.setting_value_id,
      actor,
      command.notes ?? null,
      JSON.stringify(metadata ?? {}),
    ],
  );

  const id = rows[0]?.id;
  if (!id) {
    throw new SettingsCommandError(
      "SETTINGS_VALUE_APPROVE_FAILED",
      "Failed to approve setting value.",
    );
  }
  return id;
};

export const revertSettingsValue = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = SettingsValueRevertCommandSchema.parse(payload);
  const actor = context.initiatedBy?.userId ?? APP_ACTOR;
  const idempotencyKey = normalizeIdempotencyKey(command.idempotency_key);
  const metadata = withIdempotencyKey(command.metadata, idempotencyKey);
  const reason = command.reason ?? null;

  if (idempotencyKey && isDbEnabled()) {
    const { rows } = await query<{ id: string }>(
      `
        SELECT id
        FROM settings_values
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
          AND status = 'EXPIRED'
          AND metadata ->> 'idempotency_key' = $3
        LIMIT 1
      `,
      [context.tenantId, command.setting_value_id, idempotencyKey],
    );
    const existing = rows[0]?.id;
    if (existing) {
      return existing;
    }
  }

  if (!isDbEnabled()) {
    const updated = updateSeedValue({
      valueId: command.setting_value_id,
      tenantId: context.tenantId,
      status: "EXPIRED",
      notes: reason,
      metadata,
      updatedBy: actor,
    });
    if (!updated) {
      throw new SettingsCommandError("SETTINGS_VALUE_NOT_FOUND", "Unable to revert setting value.");
    }
    return updated.id;
  }

  const { rows } = await query<{ id: string }>(
    `
      UPDATE settings_values
      SET
        status = 'EXPIRED',
        notes = CASE
          WHEN $3 IS NULL THEN notes
          WHEN notes IS NULL THEN $3
          ELSE CONCAT_WS(E'\\n', notes, $3)
        END,
        metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb,
        updated_at = NOW(),
        updated_by = $5
      WHERE tenant_id = $1::uuid
        AND id = $2::uuid
      RETURNING id
    `,
    [context.tenantId, command.setting_value_id, reason, JSON.stringify(metadata ?? {}), actor],
  );

  const id = rows[0]?.id;
  if (!id) {
    throw new SettingsCommandError(
      "SETTINGS_VALUE_REVERT_FAILED",
      "Failed to revert setting value.",
    );
  }
  return id;
};
