import type { PoolClient } from "pg";

import { BillingCommandError } from "../services/billing-commands/common.js";

/**
 * Acquires a PostgreSQL advisory transaction-level lock on the given folio.
 *
 * The lock is automatically released when the enclosing transaction commits or
 * rolls back — no explicit release is needed.
 *
 * A 5-second `lock_timeout` is set for the current transaction. If the lock
 * cannot be acquired within that window (because a concurrent payment, charge,
 * or checkout already holds it), PostgreSQL raises error code `55P03`
 * (lock_not_available) which is caught and rethrown as a retryable
 * `FOLIO_LOCKED` BillingCommandError so the Kafka consumer can back off and
 * retry instead of routing straight to the DLQ.
 *
 * The advisory lock key is derived from the folio UUID by taking the first 16
 * hex characters of its MD5 hash and casting to a 64-bit integer — this gives
 * a stable, collision-resistant key within the PostgreSQL `bigint` domain.
 *
 * Must be called inside an active transaction (i.e. inside a `withTransaction`
 * callback) before any folio balance mutation.
 *
 * @param client - Active pg PoolClient with an open transaction
 * @param folioId - UUID of the folio to lock
 */
export async function acquireFolioLock(client: PoolClient, folioId: string): Promise<void> {
  // 5-second cap on waiting for the advisory lock
  await client.query("SET LOCAL lock_timeout = '5s'");

  try {
    // Derive a stable int64 from the folio UUID via MD5 (first 16 hex chars = 64 bits)
    await client.query(
      `SELECT pg_advisory_xact_lock(('x' || substr(md5($1), 1, 16))::bit(64)::bigint)`,
      [folioId],
    );
  } catch (err: unknown) {
    // 55P03 = lock_not_available: lock_timeout was exceeded
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "55P03"
    ) {
      throw new BillingCommandError(
        "FOLIO_LOCKED",
        `Folio ${folioId} is locked by a concurrent operation. Please retry in a moment.`,
        true, // retryable — the Kafka consumer should back off and retry
      );
    }
    throw err;
  }
}
