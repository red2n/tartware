import type { TenantModulesResponse } from "@tartware/schemas";

import { query } from "../lib/db.js";
import {
  DEFAULT_ENABLED_MODULES,
  MODULE_DEFINITIONS,
  normalizeModuleList,
} from "../modules/module-registry.js";
import { TENANT_MODULES_SQL } from "../sql/tenant-module-queries.js";

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
 * Enable a set of modules for a tenant by merging into the existing config JSONB.
 */
export const updateTenantModules = async (
  tenantId: string,
  modules: string[],
): Promise<TenantModulesResponse> => {
  const normalized = normalizeModuleList(modules);
  // Always include "core"
  if (!normalized.includes("core")) normalized.unshift("core");

  await query(
    `UPDATE public.tenants
        SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('modules', $2::jsonb),
            updated_at = NOW()
      WHERE id = $1::uuid`,
    [tenantId, JSON.stringify(normalized)],
  );

  return { tenantId, modules: normalized };
};

/**
 * Get the module catalog definition list.
 */
export const getModuleCatalog = () => Object.values(MODULE_DEFINITIONS);
