import type {
  CancellationPolicy,
  ReservationCancellationInfo,
  ReservationStayRow,
  ReservationStaySnapshot,
} from "@tartware/schemas";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

export type { ReservationStaySnapshot, ReservationCancellationInfo, CancellationPolicy };

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
 * Fetch reservation data needed for cancellation fee calculation.
 *
 * Prefers the frozen `reservations.cancellation_policy_snapshot` captured at
 * booking time; falls back to the live `rates.cancellation_policy` only when
 * the snapshot is missing (e.g. legacy reservations created before the
 * snapshot column existed). This guarantees that subsequent rate-plan edits
 * never retroactively change the guest's cancellation terms.
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
    snapshot_source: "snapshot" | "live";
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
        COALESCE(r.cancellation_policy_snapshot, rt.cancellation_policy) AS cancellation_policy,
        CASE
          WHEN r.cancellation_policy_snapshot IS NOT NULL THEN 'snapshot'
          ELSE 'live'
        END AS snapshot_source
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
