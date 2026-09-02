/**
 * DEV DOC
 * Module: settings-utils.ts
 * Purpose: Let a domain service read a tenant's configured policy, so an
 *          override can be authorized by amount and not only by command.
 * Ownership: @tartware/command-consumer-utils
 *
 * The settings catalogue has carried approval thresholds since it was written
 * — 10% off needs a revenue manager, 20% needs a general manager — and nothing
 * read them. The reason was structural rather than an oversight:
 * `resolveSettings` lived inside core-service, so the two services that
 * actually apply an override, billing and reservations, had no way to ask what
 * a tenant's threshold was.
 *
 * This is the shared half. It follows `resolveReasonCode` in `command-utils`
 * exactly — an injected `queryFn` rather than a pool of its own, so it belongs
 * to no service — and core-service's own resolver now delegates to it, keeping
 * its cache and its callers.
 *
 * **What it does not do.** It does not decide anything. The policy shapes and
 * the "which role does this number demand" logic are pure and live in
 * `schema/src/api/override-thresholds.ts`, which means they are testable
 * without a database and cannot disagree between the screen and the handler.
 */

import { CommandError } from "./command-utils.js";

/** One row of the resolver's answer: a settings code and its effective value. */
export type SettingValueRow = { code: string; value: unknown };

/**
 * Resolves one row per requested code: the active tenant-scoped value if one
 * exists and is inside its effective window, otherwise the definition default.
 *
 * Kept identical to the statement core-service has always used. Duplicating the
 * SQL here and leaving a second copy there is exactly the drift this move
 * exists to remove, so core-service imports this constant.
 */
export const RESOLVE_SETTINGS_SQL = `
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

/**
 * Read effective setting values for a tenant.
 *
 * Codes with neither a value nor a definition are simply absent from the map.
 * Callers supply their own fallback, so a missing or half-installed catalogue
 * can never loosen a policy — see {@link resolvePolicy}, where that fallback is
 * the product's shipped default rather than "no rule".
 */
export const resolveSettingValues = async (
  queryFn: (sql: string, params: unknown[]) => Promise<{ rows: SettingValueRow[] }>,
  input: { tenantId: string; codes: readonly string[] },
): Promise<Map<string, unknown>> => {
  const values = new Map<string, unknown>();
  if (!input.tenantId || input.codes.length === 0) return values;

  const result = await queryFn(RESOLVE_SETTINGS_SQL, [input.tenantId, [...input.codes]]);
  for (const row of result.rows) {
    values.set(row.code, row.value);
  }
  return values;
};

/**
 * Read one policy blob and parse it, or fall back to the product's default.
 *
 * **Three outcomes, and the middle one is the point.**
 *
 * - The tenant has a value and it parses → that policy applies.
 * - The tenant has no value → `fallback` applies. This is the ordinary case,
 *   not the exceptional one: the catalogue installer writes its
 *   `settings_definitions` rows under the demo tenant, so a real property has
 *   no row to find. Treating that as "no threshold" would leave the control on
 *   in the sample data and off everywhere that moves money.
 * - The tenant has a value and it does **not** parse → refuse. A policy nobody
 *   can read is not permission; silently substituting the default there would
 *   let a malformed edit quietly relax a threshold a property had deliberately
 *   tightened.
 *
 * Not retryable. A settings row will not become well-formed on the retry
 * ladder, and burning 1s/5s/30s on it is the finding that ladder already had.
 */
export const resolvePolicy = async <TPolicy>(
  queryFn: (sql: string, params: unknown[]) => Promise<{ rows: SettingValueRow[] }>,
  input: {
    tenantId: string;
    code: string;
    /** Parses the stored blob; throws or returns undefined when it cannot. */
    parse: (raw: unknown) => TPolicy;
    /** What applies when the tenant has stated nothing. */
    fallback: TPolicy;
  },
): Promise<TPolicy> => {
  const values = await resolveSettingValues(queryFn, {
    tenantId: input.tenantId,
    codes: [input.code],
  });

  const raw = values.get(input.code);
  if (raw === undefined || raw === null || raw === "") return input.fallback;

  // The column is JSONB and `pg` hands back a parsed object, but a value that
  // was written as a JSON *string* comes back as a string. Both are worth
  // accepting: the alternative is refusing an override because someone quoted
  // their settings blob.
  const candidate = typeof raw === "string" ? safeJsonParse(raw) : raw;
  if (candidate === undefined) {
    throw new CommandError(
      "OVERRIDE_POLICY_UNREADABLE",
      `Setting "${input.code}" is not valid JSON. Refusing the override rather than ` +
        `falling back to the default, which would let a malformed edit relax a threshold.`,
    );
  }

  try {
    return input.parse(candidate);
  } catch (error) {
    throw new CommandError(
      "OVERRIDE_POLICY_UNREADABLE",
      `Setting "${input.code}" does not match the shape this control expects ` +
        `(${error instanceof Error ? error.message : String(error)}). Refusing the override.`,
    );
  }
};

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};
