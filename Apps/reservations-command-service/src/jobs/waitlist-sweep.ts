import { query } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";
import { waitlistExpireSweep } from "../services/reservation-commands/waitlist.js";

const logger = reservationsLogger.child({ module: "waitlist-sweep-job" });

let timer: NodeJS.Timeout | null = null;
let running = false;
let inFlight = false;

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_INTERVAL_MS = 10_000; // 10 seconds floor
const parsed = Number(process.env.WAITLIST_SWEEP_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
const SWEEP_INTERVAL_MS =
  Number.isFinite(parsed) && parsed >= MIN_INTERVAL_MS ? parsed : DEFAULT_INTERVAL_MS;

/**
 * Find all properties with expired waitlist offers and run the sweep
 * for each. Auto-reoffers to the next ACTIVE entry by default.
 */
const runSweep = async (): Promise<void> => {
  const { rows } = await query<{ tenant_id: string; property_id: string }>(
    `SELECT DISTINCT tenant_id, property_id
     FROM waitlist_entries
     WHERE waitlist_status = 'OFFERED'
       AND offer_expiration_at < NOW()
       AND is_deleted = false`,
  );

  if (rows.length === 0) {
    return;
  }

  let totalExpired = 0;
  let totalReoffered = 0;

  for (const row of rows) {
    try {
      const result = await waitlistExpireSweep(row.tenant_id, {
        property_id: row.property_id,
        auto_reoffer: true,
      });
      totalExpired += result.expired;
      totalReoffered += result.reoffered;
    } catch (err) {
      logger.error(
        { err, tenantId: row.tenant_id, propertyId: row.property_id },
        "Waitlist sweep failed for property",
      );
    }
  }

  if (totalExpired > 0 || totalReoffered > 0) {
    logger.info(
      { properties: rows.length, expired: totalExpired, reoffered: totalReoffered },
      "Waitlist sweep cycle completed",
    );
  }
};

const tick = async (): Promise<void> => {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    await runSweep();
  } catch (err) {
    logger.error(err, "Waitlist sweep cycle failed");
  } finally {
    inFlight = false;
  }
};

export const startWaitlistSweep = (): void => {
  if (running) {
    return;
  }
  running = true;
  timer = setInterval(() => {
    void tick();
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "Waitlist sweep job scheduled");
};

export const shutdownWaitlistSweep = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
};
