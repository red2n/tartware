/**
 * Server-side settings resolution.
 *
 * The settings catalog is edited through `/v1/settings/values`, but until now
 * nothing on the server read it back — every policy in the catalog was enforced
 * only by the Angular client, which OWASP treats as no enforcement at all
 * (a client-side check is a usability feature; the server is the control).
 *
 * This resolver is the missing half. It reads effective values for a tenant,
 * falling back to each definition's `default_value` when no value row exists,
 * so callers always get an answer without special-casing "unset".
 *
 * Scope: TENANT only. Every setting enforced today declares
 * `allowed_scopes = ARRAY['TENANT']`; property/unit/user precedence can be
 * layered in here when a setting needs it, without touching callers.
 *
 * @module settings-resolver-service
 */
import { query } from "../lib/db.js";

/**
 * Resolves one row per requested code: the active tenant-scoped value if one
 * exists and is in its effective window, otherwise the definition default.
 */
const RESOLVE_SETTINGS_SQL = `
  SELECT sd.code,
         COALESCE(
           (
             SELECT sv.value
             FROM settings_values sv
             WHERE sv.setting_id = sd.id
               AND sv.tenant_id = sd.tenant_id
               AND sv.scope_level = 'TENANT'
               AND sv.status = 'ACTIVE'
               AND (sv.effective_from IS NULL OR sv.effective_from <= CURRENT_DATE)
               AND (sv.effective_to IS NULL OR sv.effective_to >= CURRENT_DATE)
             ORDER BY sv.updated_at DESC NULLS LAST
             LIMIT 1
           ),
           sd.default_value
         ) AS value
  FROM settings_definitions sd
  WHERE sd.tenant_id = $1::uuid
    AND sd.code = ANY($2::text[])
    AND COALESCE(sd.is_deleted, false) = false
`;

/** Values are read on hot paths (login, user create), so cache them briefly. */
const CACHE_TTL_MS = 30_000;

type CacheEntry = { readonly expiresAt: number; readonly values: Map<string, unknown> };

const cache = new Map<string, CacheEntry>();

const cacheKey = (tenantId: string, codes: readonly string[]): string =>
  `${tenantId}:${[...codes].sort().join(",")}`;

/**
 * Reads effective setting values for a tenant.
 *
 * Returns a map of code → parsed JSON value. Codes with neither a value nor a
 * definition are absent from the map; callers supply their own fallback, so a
 * missing or misconfigured catalog can never loosen a policy.
 */
export const resolveSettings = async (
  tenantId: string,
  codes: readonly string[],
): Promise<Map<string, unknown>> => {
  if (!tenantId || codes.length === 0) {
    return new Map();
  }

  const key = cacheKey(tenantId, codes);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.values;
  }

  const { rows } = await query<{ code: string; value: unknown }>(RESOLVE_SETTINGS_SQL, [
    tenantId,
    [...codes],
  ]);

  const values = new Map<string, unknown>();
  for (const row of rows) {
    values.set(row.code, row.value);
  }

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, values });
  return values;
};

/** Reads a setting as a number, falling back when unset or non-numeric. */
export const getNumberSetting = (
  values: Map<string, unknown>,
  code: string,
  fallback: number,
): number => {
  const raw = values.get(code);
  const parsed = typeof raw === "string" ? Number(raw) : raw;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : fallback;
};

/** Reads a setting as a boolean, falling back when unset or non-boolean. */
export const getBooleanSetting = (
  values: Map<string, unknown>,
  code: string,
  fallback: boolean,
): boolean => {
  const raw = values.get(code);
  if (typeof raw === "boolean") {
    return raw;
  }
  if (raw === "true" || raw === "false") {
    return raw === "true";
  }
  return fallback;
};

/** Clears the cache so a settings write takes effect immediately. */
export const invalidateSettingsCache = (tenantId?: string): void => {
  if (!tenantId) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${tenantId}:`)) {
      cache.delete(key);
    }
  }
};
