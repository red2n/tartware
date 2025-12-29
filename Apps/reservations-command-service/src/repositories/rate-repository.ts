import type { PoolClient, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

type RateRow = {
  id: string;
  rate_code: string;
};

type RateQueryInput = {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  rateCode: string;
  stayStart: Date;
  stayEnd: Date;
};

const runQuery = async <TRow extends QueryResultRow>(
  sql: string,
  params: unknown[],
  client?: PoolClient,
) => {
  if (client) {
    return client.query<TRow>(sql, params);
  }
  return query<TRow>(sql, params);
};

export const findActiveRateByCode = async (
  input: RateQueryInput,
  client?: PoolClient,
): Promise<RateRow | null> => {
  const result = await runQuery<RateRow>(
    `
      SELECT id, rate_code
      FROM rates
      WHERE tenant_id = $1
        AND property_id = $2
        AND room_type_id = $3
        AND rate_code = $4
        AND status = 'ACTIVE'
        AND is_deleted = FALSE
        AND valid_from <= $5
        AND (valid_until IS NULL OR valid_until >= $6)
      LIMIT 1
    `,
    [
      input.tenantId,
      input.propertyId,
      input.roomTypeId,
      input.rateCode,
      input.stayStart,
      input.stayEnd,
    ],
    client,
  );

  const row = result.rows[0];
  return row ?? null;
};
