import { enterTenantScope } from "@tartware/config/db";

import { pool } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";
import { expireReservation } from "../services/reservation-commands/quote-management.js";

const logger = reservationsLogger.child({ module: "quote-expiry-sweep-job" });

let timer: NodeJS.Timeout | null = null;
let running = false;
let inFlight = false;

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_INTERVAL_MS = 10_000; // 10 seconds floor
const parsed = Number(process.env.QUOTE_EXPIRY_SWEEP_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
const SWEEP_INTERVAL_MS =
  Number.isFinite(parsed) && parsed >= MIN_INTERVAL_MS ? parsed : DEFAULT_INTERVAL_MS;

/** Bound the work per cycle so one tenant's backlog cannot starve the others. */
const BATCH_SIZE = 200;

/**
 * Expire quotes whose validity has lapsed.
 *
 * `reservations.quote_expires_at` is documented in
 * `scripts/tables/03-bookings/10_reservations.sql` as the "auto-expire target",
 * and `reservation.expire` has always implemented the transition — but nothing
 * ever called it. A lapsed quote therefore sat at INQUIRY/QUOTED/PENDING
 * forever, and, worse, **kept its availability-guard lock**: `expireReservation`
 * is what releases that lock, so every stale quote held inventory out of sale
 * indefinitely. See ui-gaps/17-command-reachability.md.
 *
 * `expireReservation` acts on one reservation, so the sweep is the missing half:
 * it finds the lapsed rows and drives the existing command function per row.
 */
const runSweep = async (): Promise<void> => {
  // Cross-tenant scan: acquire a dedicated client and run the query directly
  // without setting or resetting the tenant GUC. RESET poisons the pool
  // connection by leaving app.current_tenant_id = '' which causes the RLS
  // ::uuid cast to fail for all subsequent queries on that connection.
  const client = await pool.connect();
  let rows: Array<{ id: string; tenant_id: string }>;
  try {
    const result = await client.query<{ id: string; tenant_id: string }>(
      `SELECT id, tenant_id
       FROM reservations
       WHERE status IN ('INQUIRY', 'QUOTED', 'PENDING')
         AND quote_expires_at IS NOT NULL
         AND quote_expires_at < NOW()
         AND COALESCE(is_deleted, false) = false
         AND deleted_at IS NULL
       ORDER BY quote_expires_at ASC
       LIMIT $1`,
      [BATCH_SIZE],
    );
    rows = result.rows;
  } finally {
    client.release();
  }

  if (rows.length === 0) {
    return;
  }

  let expired = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      enterTenantScope(row.tenant_id);
      await expireReservation(row.tenant_id, {
        reservation_id: row.id,
        reason: "Quote validity lapsed",
      });
      expired += 1;
    } catch (err) {
      // One bad row must not stop the cycle. A reservation that changed status
      // between the scan and the call throws INVALID_STATUS_FOR_EXPIRE, which is
      // a benign race — the next cycle will not select it again.
      failed += 1;
      logger.error(
        { err, tenantId: row.tenant_id, reservationId: row.id },
        "Quote expiry failed for reservation",
      );
    }
  }

  logger.info({ scanned: rows.length, expired, failed }, "Quote expiry sweep cycle completed");
};

const tick = async (): Promise<void> => {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    await runSweep();
  } catch (err) {
    logger.error(err, "Quote expiry sweep cycle failed");
  } finally {
    inFlight = false;
  }
};

export const startQuoteExpirySweep = (): void => {
  if (running) {
    return;
  }
  running = true;
  timer = setInterval(() => {
    void tick();
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "Quote expiry sweep job scheduled");
};

export const shutdownQuoteExpirySweep = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
};
