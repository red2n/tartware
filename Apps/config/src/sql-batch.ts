/**
 * DEV DOC
 * Module: sql-batch.ts
 * Purpose: Build multi-row VALUES clauses for batched writes.
 * Ownership: @tartware/config (shared infrastructure)
 *
 * Writing one statement per item in a loop is the N+1 pattern AGENTS.md
 * forbids, and it shows up on write paths: a 30-night stay, a 40-property comp
 * set, a tenant seeded with every reference row. Collapsing those into one
 * statement means the placeholder numbering has to be computed, and an
 * off-by-one there binds every row after the first to the wrong column — a
 * failure no type checker can see and a one-row smoke test cannot reach.
 *
 * That bug has already happened once here, so the arithmetic lives in one
 * tested place rather than being re-derived at each call site.
 */

/**
 * Render the VALUES rows for a batched INSERT.
 *
 * Parameters are laid out as `scalarCount` leading values shared by every row
 * (tenant id, actor id, anything constant for the batch), followed by
 * `columnsPerRow` values for each row in turn. `render` receives a `p` helper
 * that resolves the row's own values by 1-based position, so a call site never
 * writes a `$n` itself.
 *
 * @example
 * ```ts
 * const sql = `INSERT INTO t (tenant_id, code, label) VALUES ${buildValuesRows({
 *   rowCount: items.length,
 *   columnsPerRow: 2,
 *   scalarCount: 1,
 *   render: (p) => `($1::uuid, ${p(1)}, ${p(2)})`,
 * })} ON CONFLICT DO NOTHING`;
 *
 * const params = [tenantId, ...items.flatMap((i) => [i.code, i.label])];
 * ```
 *
 * The caller builds the parameter array in the same order: scalars first, then
 * each row's values flattened in `p(1)…p(n)` order.
 */
export const buildValuesRows = (input: {
  rowCount: number;
  columnsPerRow: number;
  /** Values shared by every row, occupying `$1…$scalarCount`. */
  scalarCount: number;
  render: (p: (position: number) => string, rowIndex: number) => string;
  /** Joiner between rows; the default suits a statement spanning lines. */
  separator?: string;
}): string => {
  const { rowCount, columnsPerRow, scalarCount, render } = input;

  if (rowCount < 0 || columnsPerRow < 0 || scalarCount < 0) {
    throw new Error("buildValuesRows: counts must not be negative");
  }

  const rows: string[] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const base = scalarCount + rowIndex * columnsPerRow;
    const p = (position: number): string => {
      if (position < 1 || position > columnsPerRow) {
        throw new Error(
          `buildValuesRows: column ${position} is outside the ${columnsPerRow} declared for each row`,
        );
      }
      return `$${base + position}`;
    };
    rows.push(render(p, rowIndex));
  }

  return rows.join(input.separator ?? ",\n    ");
};

/**
 * Postgres binds at most 65535 parameters per statement, so a batch has a
 * ceiling. Split the rows before building the statement when a caller cannot
 * bound the input itself.
 */
export const maxRowsPerBatch = (columnsPerRow: number, scalarCount = 0): number => {
  if (columnsPerRow <= 0) {
    throw new Error("maxRowsPerBatch: columnsPerRow must be positive");
  }
  return Math.floor((65535 - scalarCount) / columnsPerRow);
};

/** Split `items` into batches that stay within the parameter limit. */
export const chunkForBatch = <T>(
  items: readonly T[],
  columnsPerRow: number,
  scalarCount = 0,
): T[][] => {
  const size = maxRowsPerBatch(columnsPerRow, scalarCount);
  if (items.length <= size) {
    return items.length === 0 ? [] : [[...items]];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};
