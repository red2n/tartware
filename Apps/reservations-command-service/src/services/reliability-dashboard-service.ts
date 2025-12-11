import { query } from "../lib/db.js";

import { getReliabilityHttpCounters } from "./reliability-metrics.js";

type SnapshotRow = {
  incoming: string;
  outgoing: string;
  acknowledged: string;
  failed: string;
  retried: string;
};

export interface ReliabilitySnapshot {
  timestamp: string;
  incoming: number;
  outgoing: number;
  acknowledged: number;
  failed: number;
  retried: number;
  unauthorized: number;
  unknown: number;
}

export const getReliabilitySnapshot = async (): Promise<ReliabilitySnapshot> => {
  const { rows } = await query<SnapshotRow>(
    `
      SELECT
        COUNT(*)::bigint AS incoming,
        COUNT(*) FILTER (WHERE status = 'PENDING')::bigint AS outgoing,
        COUNT(*) FILTER (WHERE status = 'ACKED')::bigint AS acknowledged,
        COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed,
        COALESCE(SUM(GREATEST(attempt_count - 1, 0)), 0)::bigint AS retried
      FROM reservation_command_idempotency
    `,
  );

  const row = rows[0] ?? {
    incoming: "0",
    outgoing: "0",
    acknowledged: "0",
    failed: "0",
    retried: "0",
  };
  const httpCounters = getReliabilityHttpCounters();
  const authorizedIncoming = Number(row.incoming);
  const unauthorized = httpCounters.unauthorized;
  const unknown = httpCounters.unknown;
  const observedIncoming = Math.max(
    httpCounters.incoming,
    authorizedIncoming + unauthorized + unknown,
  );

  return {
    timestamp: new Date().toISOString(),
    incoming: observedIncoming,
    outgoing: Number(row.outgoing),
    acknowledged: Number(row.acknowledged),
    failed: Number(row.failed),
    retried: Number(row.retried),
    unauthorized,
    unknown,
  };
};
