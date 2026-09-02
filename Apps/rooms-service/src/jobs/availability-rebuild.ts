import { pool } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "availability-rebuild-job" });

let timer: NodeJS.Timeout | null = null;
let running = false;
let inFlight = false;

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const MIN_INTERVAL_MS = 30_000;
const parsedInterval = Number(process.env.AVAILABILITY_REBUILD_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
const REBUILD_INTERVAL_MS =
  Number.isFinite(parsedInterval) && parsedInterval >= MIN_INTERVAL_MS
    ? parsedInterval
    : DEFAULT_INTERVAL_MS;

/** How far ahead to rebuild. Past nights cannot be sold, so they are skipped. */
const DEFAULT_HORIZON_DAYS = 400;
const parsedHorizon = Number(process.env.AVAILABILITY_REBUILD_HORIZON_DAYS ?? DEFAULT_HORIZON_DAYS);
const HORIZON_DAYS =
  Number.isFinite(parsedHorizon) && parsedHorizon > 0 ? parsedHorizon : DEFAULT_HORIZON_DAYS;

/**
 * Recompute `rate_calendar.rooms_sold` from `reservation_nights`.
 *
 * `rooms_sold` is half of the sellable ceiling — `rooms_to_sell − rooms_sold`
 * is what the restriction evaluator checks a booking against — and nothing has
 * ever written it, so it sat at its default of 0 and the ceiling never bound.
 *
 * It is derived state, and derived state drifts: a cancelled booking, a
 * shortened stay, a room moved between types, or a night audit that ran while a
 * consumer was behind all leave it wrong. Rather than trying to keep a counter
 * exact through every one of those paths, this recomputes it from the rows that
 * *are* the truth. That is also the repair path — the moment availability can
 * drift you need a way to put it right, and this is it.
 *
 * One statement per cycle, correlated on (property, room type, date), so a
 * property with a year of calendar costs one index scan over the nights table
 * rather than a round trip per date.
 */
const REBUILD_SQL = `
  UPDATE public.rate_calendar rc
  SET rooms_sold = COALESCE(sold.rooms, 0),
      updated_at = NOW()
  FROM (
    SELECT rc2.id AS calendar_id,
           (
             SELECT COUNT(*)
             FROM public.reservation_nights n
             JOIN public.reservation_rooms rr
               ON rr.reservation_room_id = n.reservation_room_id
             JOIN public.reservations r
               ON r.id = n.reservation_id AND r.tenant_id = n.tenant_id
             WHERE n.tenant_id = rc2.tenant_id
               AND n.property_id = rc2.property_id
               AND n.stay_date = rc2.stay_date
               AND rr.room_type_id = rc2.room_type_id
               AND COALESCE(n.is_deleted, FALSE) = FALSE
               AND COALESCE(rr.is_deleted, FALSE) = FALSE
               AND rr.status NOT IN ('CANCELLED', 'NO_SHOW')
               AND r.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
               AND COALESCE(r.is_deleted, FALSE) = FALSE
           ) AS rooms
    FROM public.rate_calendar rc2
    WHERE rc2.stay_date >= CURRENT_DATE
      AND rc2.stay_date < CURRENT_DATE + ($1::int * INTERVAL '1 day')
      AND COALESCE(rc2.is_deleted, FALSE) = FALSE
  ) AS sold
  WHERE rc.id = sold.calendar_id
    AND rc.rooms_sold IS DISTINCT FROM COALESCE(sold.rooms, 0)
`;

/**
 * Run one rebuild pass.
 *
 * Exported so an operator can trigger a repair without waiting for the timer,
 * and so a test can drive it directly.
 *
 * @returns how many calendar rows were actually corrected
 */
export const rebuildAvailability = async (): Promise<number> => {
  // Cross-tenant maintenance: take a dedicated client and never touch the
  // tenant GUC. RESET poisons the pooled connection by leaving
  // app.current_tenant_id = '', which breaks the RLS ::uuid cast for every
  // later query on it.
  const client = await pool.connect();
  try {
    const result = await client.query(REBUILD_SQL, [HORIZON_DAYS]);
    return result.rowCount ?? 0;
  } finally {
    client.release();
  }
};

const tick = async (): Promise<void> => {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    const corrected = await rebuildAvailability();
    if (corrected > 0) {
      // Only worth a line when something was actually wrong: a healthy system
      // corrects nothing, and a steady trickle here is the signal that some
      // write path is not keeping the calendar in step.
      logger.info({ corrected, horizonDays: HORIZON_DAYS }, "Availability rebuild corrected rows");
    }
  } catch (err) {
    logger.error(err, "Availability rebuild cycle failed");
  } finally {
    inFlight = false;
  }
};

/** Delay before the startup pass, to let the pool and migrations settle. */
const STARTUP_DELAY_MS = 15_000;

export const startAvailabilityRebuild = (): void => {
  if (running) {
    return;
  }
  running = true;

  // Run once shortly after start as well as on the interval. This is the
  // repair path, and the drift most worth repairing is whatever accumulated
  // while the service was down — waiting a full interval to notice it makes a
  // restart useless as a remedy.
  const startupPass = setTimeout(() => {
    void tick();
  }, STARTUP_DELAY_MS);
  startupPass.unref?.();

  timer = setInterval(() => {
    void tick();
  }, REBUILD_INTERVAL_MS);
  timer.unref?.();
  logger.info(
    { intervalMs: REBUILD_INTERVAL_MS, horizonDays: HORIZON_DAYS },
    "Availability rebuild job scheduled",
  );
};

export const shutdownAvailabilityRebuild = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
};
