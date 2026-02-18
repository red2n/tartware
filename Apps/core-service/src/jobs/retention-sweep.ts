/**
 * Data Retention Sweep Job
 *
 * Periodically checks active data_retention_policies and purges/anonymizes
 * records that exceed the configured retention period.
 *
 * Pattern: setInterval with overlap guard (same as waitlist-sweep).
 *
 * Supported entity types:
 *   - audit_logs: DELETEs rows older than retention_days
 *   - gdpr_consent_logs: DELETEs rows older than retention_days
 *
 * Other entity types are logged as warnings (manual action or future extension).
 */

import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "retention-sweep" });

let timer: NodeJS.Timeout | null = null;
let running = false;
let inFlight = false;

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MIN_INTERVAL_MS = 60_000; // 1 minute floor

const getIntervalMs = (): number => {
  const envVal = Number(process.env.RETENTION_SWEEP_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  return Math.max(Number.isFinite(envVal) ? envVal : DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS);
};

type RetentionPolicy = {
  policy_id: string;
  tenant_id: string;
  entity_type: string;
  retention_days: number;
  action: string;
  exempt_statuses: string[] | null;
};

const SUPPORTED_ENTITY_TYPES = new Map<string, (policy: RetentionPolicy) => Promise<number>>([
  ["audit_logs", purgeAuditLogs],
  ["gdpr_consent_logs", purgeGdprConsentLogs],
]);

async function purgeAuditLogs(policy: RetentionPolicy): Promise<number> {
  const { rowCount } = await query(
    `
      DELETE FROM public.audit_logs
      WHERE tenant_id = $1::uuid
        AND created_at < NOW() - ($2 || ' days')::interval
    `,
    [policy.tenant_id, policy.retention_days.toString()],
  );
  return rowCount ?? 0;
}

async function purgeGdprConsentLogs(policy: RetentionPolicy): Promise<number> {
  const { rowCount } = await query(
    `
      DELETE FROM public.gdpr_consent_logs
      WHERE tenant_id = $1::uuid
        AND created_at < NOW() - ($2 || ' days')::interval
    `,
    [policy.tenant_id, policy.retention_days.toString()],
  );
  return rowCount ?? 0;
}

const runSweep = async (): Promise<void> => {
  const { rows: policies } = await query<RetentionPolicy>(
    `
      SELECT policy_id, tenant_id, entity_type, retention_days, action, exempt_statuses
      FROM public.data_retention_policies
      WHERE is_active = TRUE
      ORDER BY tenant_id, entity_type
    `,
    [],
  );

  if (policies.length === 0) return;

  let totalProcessed = 0;

  for (const policy of policies) {
    try {
      const handler = SUPPORTED_ENTITY_TYPES.get(policy.entity_type);
      if (!handler) {
        logger.debug(
          { entityType: policy.entity_type, tenantId: policy.tenant_id },
          "unsupported entity type for automatic retention sweep",
        );
        continue;
      }

      const count = await handler(policy);

      if (count > 0) {
        await query(
          `
            UPDATE public.data_retention_policies
            SET last_sweep_at = NOW(),
                last_sweep_count = $2,
                updated_at = NOW()
            WHERE policy_id = $1::uuid
          `,
          [policy.policy_id, count],
        );
        totalProcessed += count;
        logger.info(
          {
            entityType: policy.entity_type,
            tenantId: policy.tenant_id,
            purgedCount: count,
            retentionDays: policy.retention_days,
          },
          "retention sweep purged records",
        );
      }
    } catch (err) {
      logger.error(
        {
          err,
          entityType: policy.entity_type,
          tenantId: policy.tenant_id,
          policyId: policy.policy_id,
        },
        "retention sweep failed for policy",
      );
    }
  }

  if (totalProcessed > 0) {
    logger.info({ totalProcessed }, "retention sweep cycle complete");
  }
};

const tick = async (): Promise<void> => {
  if (inFlight) return;
  inFlight = true;
  try {
    await runSweep();
  } catch (err) {
    logger.error(err, "retention sweep tick error");
  } finally {
    inFlight = false;
  }
};

export const startRetentionSweep = (): void => {
  if (running) return;
  running = true;
  const intervalMs = getIntervalMs();
  timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();
  logger.info({ intervalMs }, "retention sweep started");
};

export const shutdownRetentionSweep = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
};
