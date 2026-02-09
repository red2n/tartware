/**
 * DEV DOC
 * Module: sql/dynamic-update-builder.ts
 * Purpose: Build dynamic UPDATE queries that distinguish undefined (skip) from null (clear).
 * Ownership: rooms-service
 *
 * The COALESCE($n, alias.column) pattern prevents setting nullable columns to NULL
 * because both undefined-input and explicit-null map to SQL NULL, which COALESCE
 * resolves back to the existing value.  This builder only includes SET clauses for
 * fields that are explicitly provided (not undefined), allowing null to pass through
 * and clear the column value.
 */

/** A single column to set in the UPDATE statement. */
export interface UpdateField {
  /** Column name in the database table. */
  column: string;
  /** Value to set. `null` will clear the column; any other value sets it. */
  value: unknown;
}

/** Options for building a dynamic UPDATE query. */
export interface DynamicUpdateOptions {
  /** Fully qualified table name, e.g. `public.room_types`. */
  table: string;
  /** Table alias used in the query, e.g. `rt`. */
  alias: string;
  /** Primary key value (always bound to $1). */
  id: string;
  /** Tenant id value (always bound to $2). */
  tenantId: string;
  /** Only fields whose input value was explicitly provided (not undefined). */
  fields: UpdateField[];
  /** Columns to SELECT in the final read-back CTE. */
  selectColumns: readonly string[];
}

/** Generated SQL text and bound parameter values. */
export interface DynamicUpdateResult {
  sql: string;
  params: unknown[];
}

/**
 * Build a dynamic `UPDATE ... RETURNING *` CTE query.
 *
 * Only the provided {@link DynamicUpdateOptions.fields} are included in SET clauses:
 * - `undefined` in the caller's input → field omitted from the mapping → column untouched
 * - `null` in the caller's input → field included with `null` → column SET to NULL
 *
 * Always appends `updated_at = CURRENT_TIMESTAMP` and `version = alias.version + 1`.
 *
 * @returns The parameterised SQL string and the ordered parameter array.
 */
export function buildDynamicUpdate(options: DynamicUpdateOptions): DynamicUpdateResult {
  const { table, alias, id, tenantId, fields, selectColumns } = options;

  const params: unknown[] = [id, tenantId];
  let paramIndex = 3;

  const setClauses: string[] = [];

  for (const field of fields) {
    setClauses.push(`${field.column} = $${paramIndex}`);
    params.push(field.value);
    paramIndex++;
  }

  // Always bump audit / optimistic-lock fields
  setClauses.push("updated_at = CURRENT_TIMESTAMP");
  setClauses.push(`version = ${alias}.version + 1`);

  const selectClause = selectColumns.map((col) => `u.${col}`).join(",\n    ");

  const sql = `
  WITH updated AS (
    UPDATE ${table} ${alias}
    SET
      ${setClauses.join(",\n      ")}
    WHERE ${alias}.id = $1::uuid
      AND ${alias}.tenant_id = $2::uuid
      AND COALESCE(${alias}.is_deleted, false) = false
      AND ${alias}.deleted_at IS NULL
    RETURNING *
  )
  SELECT
    ${selectClause}
  FROM updated u`;

  return { sql, params };
}
