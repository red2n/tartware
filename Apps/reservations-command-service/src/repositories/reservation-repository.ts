import type { PoolClient, QueryResult, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

type ReservationStayRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  room_type_id: string;
  check_in_date: Date;
  check_out_date: Date;
};

export type ReservationStaySnapshot = {
  reservationId: string;
  tenantId: string;
  propertyId: string;
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
  return <TRow extends QueryResultRow>(sql: string, params: unknown[]) => query<TRow>(sql, params);
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
        property_id,
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
    propertyId: row.property_id,
    roomTypeId: row.room_type_id,
    checkInDate: new Date(row.check_in_date),
    checkOutDate: new Date(row.check_out_date),
  };
};

/**
 * Cancellation-relevant reservation + rate data.
 */
export type ReservationCancellationInfo = {
  reservationId: string;
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  rateId: string | null;
  roomRate: number;
  totalAmount: number;
  checkInDate: Date;
  checkOutDate: Date;
  status: string;
  cancellationPolicy: CancellationPolicy | null;
};

/** JSONB shape stored on the rates table. */
export type CancellationPolicy = {
  type: string; // "flexible", "moderate", "strict", "non_refundable"
  hours: number; // hours before check-in deadline
  penalty: number; // fee amount (currency-relative)
};

/**
 * Fetch reservation data needed for cancellation fee calculation,
 * including the associated rate's cancellation_policy.
 */
export const fetchReservationCancellationInfo = async (
  tenantId: string,
  reservationId: string,
  client?: PoolClient,
): Promise<ReservationCancellationInfo | null> => {
  const runner = getRunner(client);
  const result = await runner<{
    id: string;
    tenant_id: string;
    property_id: string;
    room_type_id: string;
    rate_id: string | null;
    room_rate: string;
    total_amount: string;
    check_in_date: Date;
    check_out_date: Date;
    status: string;
    cancellation_policy: CancellationPolicy | null;
  }>(
    `
      SELECT
        r.id,
        r.tenant_id,
        r.property_id,
        r.room_type_id,
        r.rate_id,
        r.room_rate,
        r.total_amount,
        r.check_in_date,
        r.check_out_date,
        r.status,
        rt.cancellation_policy
      FROM reservations r
      LEFT JOIN rates rt ON rt.id = r.rate_id AND rt.tenant_id = r.tenant_id
      WHERE r.tenant_id = $1
        AND r.id = $2
        AND r.is_deleted = FALSE
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
    propertyId: row.property_id,
    roomTypeId: row.room_type_id,
    rateId: row.rate_id,
    roomRate: Number(row.room_rate),
    totalAmount: Number(row.total_amount),
    checkInDate: new Date(row.check_in_date),
    checkOutDate: new Date(row.check_out_date),
    status: row.status,
    cancellationPolicy: row.cancellation_policy ?? null,
  };
};
