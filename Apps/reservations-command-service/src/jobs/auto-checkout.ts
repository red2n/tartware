import { query } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";
import { checkOutReservation } from "../services/reservation-commands/checkin-checkout.js";

const logger = reservationsLogger.child({ module: "auto-checkout-job" });

let timer: NodeJS.Timeout | null = null;
let running = false;
let inFlight = false;

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MIN_INTERVAL_MS = 60_000; // 1 minute floor
const parsed = Number(process.env.AUTO_CHECKOUT_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
const SWEEP_INTERVAL_MS =
  Number.isFinite(parsed) && parsed >= MIN_INTERVAL_MS ? parsed : DEFAULT_INTERVAL_MS;

/**
 * Find CHECKED_IN reservations past their check-out date and auto-checkout them.
 * Uses express checkout mode so unsettled folios get post-departure billing.
 */
const runAutoCheckout = async (): Promise<void> => {
  const { rows } = await query<{
    id: string;
    tenant_id: string;
    property_id: string;
    check_out_date: string;
  }>(
    `SELECT id, tenant_id, property_id, check_out_date::text
     FROM reservations
     WHERE status = 'CHECKED_IN'
       AND check_out_date <= CURRENT_DATE
       AND is_deleted = false
     ORDER BY check_out_date ASC
     LIMIT 100`,
  );

  if (rows.length === 0) {
    return;
  }

  let successes = 0;
  let failures = 0;

  for (const row of rows) {
    try {
      await checkOutReservation(row.tenant_id, {
        reservation_id: row.id,
        express: true,
        notes: "Auto-checkout: departure date reached",
        metadata: { auto_checkout: true },
      });
      successes++;
    } catch (err) {
      failures++;
      logger.error(
        { err, reservationId: row.id, tenantId: row.tenant_id },
        "Auto-checkout failed for reservation",
      );
    }
  }

  logger.info({ total: rows.length, successes, failures }, "Auto-checkout sweep cycle completed");
};

const tick = async (): Promise<void> => {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    await runAutoCheckout();
  } catch (err) {
    logger.error(err, "Auto-checkout sweep cycle failed");
  } finally {
    inFlight = false;
  }
};

export const startAutoCheckoutSweep = (): void => {
  if (running) {
    return;
  }
  running = true;
  timer = setInterval(() => {
    void tick();
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "Auto-checkout sweep job scheduled");
};

export const shutdownAutoCheckoutSweep = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
};
