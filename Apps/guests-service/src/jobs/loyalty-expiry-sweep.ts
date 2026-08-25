import { enterTenantScope } from "@tartware/config/db";

import { pool } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { listTenantsWithExpiringPoints } from "../repositories/loyalty-sweep-repository.js";
import { expireLoyaltyPoints } from "../services/loyalty-command-service.js";

const logger = appLogger.child({ module: "loyalty-expiry-sweep-job" });

let timer: NodeJS.Timeout | null = null;
let running = false;
let inFlight = false;

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // hourly — points expire on a date, not a clock
const MIN_INTERVAL_MS = 60_000; // 1 minute floor
const parsed = Number(process.env.LOYALTY_EXPIRY_SWEEP_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
const SWEEP_INTERVAL_MS =
  Number.isFinite(parsed) && parsed >= MIN_INTERVAL_MS ? parsed : DEFAULT_INTERVAL_MS;

/** Matches the command's own default; the sweep is re-entrant so a backlog drains over cycles. */
const BATCH_SIZE = 500;

/**
 * Expire loyalty points whose `expires_at` has passed.
 *
 * `expireLoyaltyPoints` was fully implemented — batched, `FOR UPDATE SKIP
 * LOCKED`, writing an `expire` ledger row and decrementing the balance in one
 * statement — and `loyalty_point_transactions` even carries a partial index
 * (`WHERE expired = FALSE AND expires_at IS NOT NULL`) built for exactly this
 * query. Nothing ever dispatched `loyalty.points.expire_sweep`, so points with a
 * lapsed `expires_at` stayed live for ever and every balance was overstated.
 * See ui-gaps/17-command-reachability.md.
 *
 * The command is tenant-scoped, so the sweep finds the tenants with expirable
 * points and drives the existing function per tenant.
 */
const runSweep = async (): Promise<void> => {
  // Cross-tenant scan: dedicated client, no tenant GUC set or reset. RESET
  // poisons the pooled connection by leaving app.current_tenant_id = '', which
  // breaks the RLS ::uuid cast for every later query on it.
  const client = await pool.connect();
  let tenantIds: string[];
  try {
    const result = await listTenantsWithExpiringPoints(client);
    tenantIds = result.rows.map((row) => row.tenant_id);
  } finally {
    client.release();
  }

  if (tenantIds.length === 0) {
    return;
  }

  let swept = 0;
  let failed = 0;

  for (const tenantId of tenantIds) {
    try {
      enterTenantScope(tenantId);
      await expireLoyaltyPoints({
        tenantId,
        payload: { batch_size: BATCH_SIZE },
        correlationId: undefined,
        initiatedBy: null,
      });
      swept += 1;
    } catch (err) {
      failed += 1;
      logger.error({ err, tenantId }, "Loyalty points expiry failed for tenant");
    }
  }

  logger.info({ tenants: tenantIds.length, swept, failed }, "Loyalty expiry sweep cycle completed");
};

const tick = async (): Promise<void> => {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    await runSweep();
  } catch (err) {
    logger.error(err, "Loyalty expiry sweep cycle failed");
  } finally {
    inFlight = false;
  }
};

export const startLoyaltyExpirySweep = (): void => {
  if (running) {
    return;
  }
  running = true;
  timer = setInterval(() => {
    void tick();
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  logger.info({ intervalMs: SWEEP_INTERVAL_MS }, "Loyalty expiry sweep job scheduled");
};

export const shutdownLoyaltyExpirySweep = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
};
