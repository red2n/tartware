import type { TenantModulesResponse } from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  DEFAULT_ENABLED_MODULES,
  MODULE_DEFINITIONS,
  normalizeModuleList,
} from "../modules/module-registry.js";
import { TENANT_MODULES_SQL } from "../sql/tenant-module-queries.js";

import { emitMembershipCacheInvalidation } from "./membership-cache-hooks.js";

export type { TenantModulesResponse };

/**
 * Fetch enabled modules for a tenant.
 */
export const getTenantModules = async (tenantId: string): Promise<TenantModulesResponse> => {
  const { rows } = await query<{ modules: unknown }>(TENANT_MODULES_SQL, [tenantId]);

  if (rows.length === 0) {
    return {
      tenantId,
      modules: DEFAULT_ENABLED_MODULES,
    };
  }

  return {
    tenantId,
    modules: normalizeModuleList(rows[0]?.modules),
  };
};

/**
 * Enable a set of modules for a tenant by updating all user_tenant_associations.
 */
export const updateTenantModules = async (
  tenantId: string,
  modules: string[],
): Promise<TenantModulesResponse> => {
  const normalized = normalizeModuleList(modules);
  // Always include "core"
  if (!normalized.includes("core")) normalized.unshift("core");

  // Update tenant-level config (source of truth for GET /modules)
  await query(
    `UPDATE public.tenants
        SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('modules', $2::jsonb),
            updated_at = NOW(),
            version = version + 1
      WHERE id = $1::uuid`,
    [tenantId, JSON.stringify(normalized)],
  );

  // Also update all user_tenant_associations so the auth context picks up the modules
  const { rows: affected } = await query<{ user_id: string }>(
    `UPDATE public.user_tenant_associations
        SET modules = $2::jsonb,
            updated_at = NOW(),
            version = version + 1
      WHERE tenant_id = $1::uuid
        AND COALESCE(is_deleted, false) = false
      RETURNING user_id`,
    [tenantId, JSON.stringify(normalized)],
  );

  // The auth context reads modules from the cached membership list, not from the
  // row we just wrote. Without this the tenant keeps its old entitlements until
  // the cache TTL lapses, so enabling a module returns 200 while every gated
  // route still answers TENANT_MODULE_NOT_ENABLED.
  await Promise.all(
    affected.map((row) =>
      emitMembershipCacheInvalidation({
        userId: row.user_id,
        reason: "TENANT_MEMBERSHIP_MUTATED",
        metadata: { tenantId, modules: normalized },
      }),
    ),
  );

  return { tenantId, modules: normalized };
};

/**
 * Get the module catalog definition list.
 */
export const getModuleCatalog = () => Object.values(MODULE_DEFINITIONS);
