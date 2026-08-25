import { buildValuesRows } from "@tartware/config/sql-batch";
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

  // Postgres rejects an ON CONFLICT DO UPDATE that would touch the same row
  // twice in one statement, so collapse repeated screen keys first — last wins.
  const byScreenKey = new Map<string, ScreenPermissionEntry>();
  for (const screen of screens) {
    byScreenKey.set(screen.screen_key, screen);
  }
  const entries = [...byScreenKey.values()];

  // tenant, role and actor are the same for every row, so they stay scalar and
  // only the per-screen values repeat.
  await query(
    `INSERT INTO role_screen_permissions (tenant_id, role, screen_key, is_visible, updated_by)
     VALUES ${buildValuesRows({
       rowCount: entries.length,
       columnsPerRow: 2,
       scalarCount: 3,
       render: (p) => `($1, $2, ${p(1)}, ${p(2)}, $3)`,
     })}
     ON CONFLICT (tenant_id, role, screen_key)
     DO UPDATE SET
       is_visible = EXCLUDED.is_visible,
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [
      tenantId,
      role,
      updatedBy ?? null,
      ...entries.flatMap((screen) => [screen.screen_key, screen.is_visible]),
    ],
  );
};
