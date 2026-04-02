import {
  type ScreenPermissionEntry,
  ScreenPermissionEntrySchema,
  type TenantRole,
} from "@tartware/schemas";
import { z } from "zod";

import { query } from "../lib/db.js";

const ScreenPermissionArraySchema = z.array(ScreenPermissionEntrySchema);

/**
 * Fetch all screen permissions for a given tenant + role.
 */
export const getScreenPermissions = async (
  tenantId: string,
  role: TenantRole,
): Promise<ScreenPermissionEntry[]> => {
  const { rows } = await query(
    `SELECT screen_key, is_visible
     FROM role_screen_permissions
     WHERE tenant_id = $1 AND role = $2
     ORDER BY screen_key`,
    [tenantId, role],
  );
  return ScreenPermissionArraySchema.parse(rows);
};

/**
 * Fetch screen permissions for ALL roles in a tenant.
 * Returns a map of role → screen entries.
 */
export const getAllScreenPermissions = async (
  tenantId: string,
): Promise<Record<string, ScreenPermissionEntry[]>> => {
  const { rows } = await query(
    `SELECT role, screen_key, is_visible
     FROM role_screen_permissions
     WHERE tenant_id = $1
     ORDER BY role, screen_key`,
    [tenantId],
  );

  const result: Record<string, ScreenPermissionEntry[]> = {};
  for (const row of rows as Array<{ role: string; screen_key: string; is_visible: boolean }>) {
    const entries = result[row.role] ?? [];
    entries.push({ screen_key: row.screen_key, is_visible: row.is_visible });
    result[row.role] = entries;
  }
  return result;
};

/**
 * Upsert screen permissions for a specific role in a tenant.
 * Uses ON CONFLICT to update existing entries.
 */
export const upsertScreenPermissions = async (
  tenantId: string,
  role: TenantRole,
  screens: ScreenPermissionEntry[],
  updatedBy?: string,
): Promise<void> => {
  if (screens.length === 0) return;

  const values: unknown[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const screen of screens) {
    placeholders.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
    values.push(tenantId, role, screen.screen_key, screen.is_visible, updatedBy ?? null);
    idx += 5;
  }

  await query(
    `INSERT INTO role_screen_permissions (tenant_id, role, screen_key, is_visible, updated_by)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (tenant_id, role, screen_key)
     DO UPDATE SET
       is_visible = EXCLUDED.is_visible,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    values,
  );
};
