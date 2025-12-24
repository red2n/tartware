import type { PoolClient, QueryResult, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

type ReservationStayRow = {
  id: string;
  tenant_id: string;
  room_type_id: string;
  check_in_date: Date;
  check_out_date: Date;
};

export type ReservationStaySnapshot = {
  reservationId: string;
  tenantId: string;
  roomTypeId: string;
  checkInDate: Date;
  checkOutDate: Date;
};

type QueryRunner = <TRow extends QueryResultRow>(
  sql: string,
  params: unknown[],
) => Promise<QueryResult<TRow>>;

const getRunner = (client?: PoolClient): QueryRunner => {
  if (client) {
    return <TRow extends QueryResultRow>(sql: string, params: unknown[]) =>
      client.query<TRow>(sql, params);
  }
  return <TRow extends QueryResultRow>(sql: string, params: unknown[]) =>
    query<TRow>(sql, params);
};

export const fetchReservationStaySnapshot = async (
  tenantId: string,
  reservationId: string,
  client?: PoolClient,
): Promise<ReservationStaySnapshot | null> => {
  const runner = getRunner(client);
  const result = await runner<ReservationStayRow>(
    `
      SELECT
        id,
        tenant_id,
        room_type_id,
        check_in_date,
        check_out_date
      FROM reservations
      WHERE tenant_id = $1
        AND id = $2
        AND is_deleted = FALSE
      LIMIT 1;
    `,
    [tenantId, reservationId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    reservationId: row.id,
    tenantId: row.tenant_id,
    roomTypeId: row.room_type_id,
    checkInDate: new Date(row.check_in_date),
    checkOutDate: new Date(row.check_out_date),
  };
};
