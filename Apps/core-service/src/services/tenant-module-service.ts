import { query } from "../lib/db.js";
import {
  DEFAULT_ENABLED_MODULES,
  MODULE_DEFINITIONS,
  type ModuleId,
  normalizeModuleList,
} from "../modules/module-registry.js";
import { TENANT_MODULES_SQL } from "../sql/tenant-module-queries.js";

export interface TenantModulesResponse {
  tenantId: string;
  modules: ModuleId[];
}

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

export const getModuleCatalog = () => Object.values(MODULE_DEFINITIONS);
