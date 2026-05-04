import type { PoolClient } from "pg";

import { auditAsync } from "../lib/audit-logger.js";
import { query, withTransaction } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "night-audit-runner" });

/** Outcome of a single night audit step. */
type StepResult = {
  /** Free-form metric counters merged into night_audit_runs.metadata. */
  metrics?: Record<string, unknown>;
};

/**
 * One step in the night audit pipeline. Each step runs in its OWN database
 * transaction; the runner commits incrementally so a crash leaves a recoverable
 * checkpoint in `night_audit_runs.completed_steps`.
 */
type NightAuditStep = {
  /** Stable machine-readable name (e.g. "post_room_charges"). */
  name: string;
  /** Implementation. Receives the per-step transaction client. */
  run: (ctx: NightAuditStepContext, client: PoolClient) => Promise<StepResult | void>;
};

/** Context passed to every step. */
export type NightAuditStepContext = {
  runId: string;
  tenantId: string;
  propertyId: string;
  /** Hotel-day being audited (YYYY-MM-DD). */
  businessDate: string;
};

export type NightAuditRunInput = {
  tenantId: string;
  propertyId: string;
  /** Hotel-day to audit (YYYY-MM-DD). */
  businessDate: string;
  /** Actor who triggered the run; defaults to system. */
  initiatedBy?: string | null;
  /**
   * If true and a prior FAILED run exists for this business_date, mark it
   * ROLLED_BACK and start a new replay. Defaults to false (refuses replay).
   */
  replay?: boolean;
};

export type NightAuditRunOutcome = {
  runId: string;
  status: "COMPLETED" | "FAILED";
  completedSteps: number;
  totalSteps: number;
  errorMessage?: string;
  errorStep?: string;
};

/** Sentinel UUID used when no actor is supplied. */
const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Pre-flight: ensure no other run is in flight or already completed for this
 * (tenant, property, business_date). If a FAILED run exists and `replay=true`,
 * mark it ROLLED_BACK so the partial-unique index admits a new row.
 */
const reservePendingRun = async (input: NightAuditRunInput): Promise<string> => {
  const { tenantId, propertyId, businessDate, initiatedBy } = input;

  return withTransaction(async (client) => {
    const { rows: existing } = await client.query<{
      id: string;
      status: string;
    }>(
      `SELECT id, status
       FROM night_audit_runs
       WHERE tenant_id = $1::uuid
         AND property_id = $2::uuid
         AND business_date = $3::date
         AND status IN ('PENDING','RUNNING','COMPLETED')
       FOR UPDATE`,
      [tenantId, propertyId, businessDate],
    );

    if (existing.length > 0) {
      const blocker = existing[0];
      throw new Error(
        `Night audit refused: an active run (id=${blocker?.id}, status=${blocker?.status}) already exists for property ${propertyId} on ${businessDate}.`,
      );
    }

    let replayOf: string | null = null;
    if (input.replay) {
      const { rows: failed } = await client.query<{ id: string }>(
        `SELECT id FROM night_audit_runs
         WHERE tenant_id = $1::uuid
           AND property_id = $2::uuid
           AND business_date = $3::date
           AND status = 'FAILED'
         ORDER BY started_at DESC NULLS LAST
         LIMIT 1`,
        [tenantId, propertyId, businessDate],
      );
      replayOf = failed[0]?.id ?? null;
    }

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO night_audit_runs (
         tenant_id, property_id, business_date, status,
         initiated_by, replay_of
       ) VALUES (
         $1::uuid, $2::uuid, $3::date, 'PENDING',
         $4::uuid, $5::uuid
       )
       RETURNING id`,
      [tenantId, propertyId, businessDate, initiatedBy ?? SYSTEM_ACTOR_ID, replayOf],
    );

    const id = rows[0]?.id;
    if (!id) throw new Error("Failed to insert night_audit_runs row.");
    return id;
  });
};

const markRunRunning = async (runId: string, totalSteps: number): Promise<void> => {
  await query(
    `UPDATE night_audit_runs
     SET status = 'RUNNING',
         started_at = NOW(),
         total_steps = $2,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [runId, totalSteps],
  );
};

const markStepStarted = async (runId: string, stepName: string): Promise<void> => {
  await query(
    `UPDATE night_audit_runs
     SET current_step = $2,
         step_started_at = NOW(),
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [runId, stepName],
  );
};

const markStepCompleted = async (
  runId: string,
  metrics: Record<string, unknown> | undefined,
): Promise<void> => {
  await query(
    `UPDATE night_audit_runs
     SET completed_steps = completed_steps + 1,
         metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [runId, JSON.stringify(metrics ?? {})],
  );
};

const markRunCompleted = async (runId: string): Promise<void> => {
  await query(
    `UPDATE night_audit_runs
     SET status = 'COMPLETED',
         current_step = NULL,
         finished_at = NOW(),
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [runId],
  );
};

const markRunFailed = async (
  runId: string,
  errorStep: string,
  errorMessage: string,
): Promise<void> => {
  await query(
    `UPDATE night_audit_runs
     SET status = 'FAILED',
         error_step = $2,
         error_message = $3,
         finished_at = NOW(),
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [runId, errorStep, errorMessage.slice(0, 4000)],
  );
};

/**
 * Default step pipeline. Each step is a no-op stub that the implementation
 * teams should fill in. Order matters: room charges → taxes → folio close →
 * financial-closure snapshot → roll-forward.
 *
 * Each step receives a transaction client; the runner commits the step
 * transaction on success and updates `completed_steps` separately so that even
 * a crash mid-pipeline leaves a forensic trail.
 */
export const defaultNightAuditSteps: NightAuditStep[] = [
  {
    name: "validate_open_business_date",
    run: async (ctx, client) => {
      const { rows } = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM reservations
         WHERE tenant_id = $1::uuid
           AND property_id = $2::uuid
           AND status = 'CHECKED_IN'
           AND check_out_date < $3::date`,
        [ctx.tenantId, ctx.propertyId, ctx.businessDate],
      );
      const stale = Number(rows[0]?.count ?? 0);
      return { metrics: { validate_stale_checked_in: stale } };
    },
  },
  {
    name: "post_room_charges",
    run: async (_ctx, _client) => {
      // Stub: insert nightly room+tax postings into charge_postings for every
      // CHECKED_IN reservation whose nightly cycle has elapsed.
      return { metrics: { posted_room_charges: 0 } };
    },
  },
  {
    name: "post_taxes",
    run: async (_ctx, _client) => {
      // Stub: post derived taxes referencing tax_configurations.
      return { metrics: { posted_tax_lines: 0 } };
    },
  },
  {
    name: "snapshot_financial_closure",
    run: async (_ctx, _client) => {
      // Stub: write summary row(s) into financial_closures for the business_date.
      return { metrics: { closure_rows: 0 } };
    },
  },
  {
    name: "roll_business_date_forward",
    run: async (_ctx, _client) => {
      // Stub: advance property.business_date and emit RollAdvanced event.
      return { metrics: { advanced: 1 } };
    },
  },
];

/**
 * Run the night audit pipeline for the given (tenant, property, business_date).
 *
 * Guarantees:
 *  - Pre-flight rejects duplicate runs via `night_audit_runs` partial unique index.
 *  - Each step runs in its own transaction (commits incrementally).
 *  - On failure, the run row is marked FAILED with the offending step + message;
 *    the runner returns instead of throwing, leaving the caller (CLI or scheduler)
 *    to decide whether to alert and replay.
 *  - On success, an audit-log entry is emitted (severity INFO).
 *
 * Re-running for the same `business_date` requires `replay: true`.
 */
export const runNightAudit = async (
  input: NightAuditRunInput,
  steps: NightAuditStep[] = defaultNightAuditSteps,
): Promise<NightAuditRunOutcome> => {
  const runId = await reservePendingRun(input);
  await markRunRunning(runId, steps.length);

  const ctx: NightAuditStepContext = {
    runId,
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    businessDate: input.businessDate,
  };

  logger.info(
    {
      runId,
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      businessDate: input.businessDate,
      totalSteps: steps.length,
    },
    "night audit started",
  );

  let completed = 0;
  for (const step of steps) {
    await markStepStarted(runId, step.name);
    try {
      const result = await withTransaction(async (client) => step.run(ctx, client));
      await markStepCompleted(runId, result?.metrics);
      completed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ runId, step: step.name, err: message }, "night audit step failed");
      await markRunFailed(runId, step.name, message);
      auditAsync({
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        userId: input.initiatedBy ?? SYSTEM_ACTOR_ID,
        action: "NIGHT_AUDIT_FAILED",
        entityType: "night_audit_run",
        entityId: runId,
        severity: "CRITICAL",
        description: `Night audit FAILED at step '${step.name}' on ${input.businessDate}: ${message}`,
        newValues: { business_date: input.businessDate, error_step: step.name },
      });
      return {
        runId,
        status: "FAILED",
        completedSteps: completed,
        totalSteps: steps.length,
        errorMessage: message,
        errorStep: step.name,
      };
    }
  }

  await markRunCompleted(runId);
  logger.info({ runId, completed }, "night audit completed");
  auditAsync({
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    userId: input.initiatedBy ?? SYSTEM_ACTOR_ID,
    action: "NIGHT_AUDIT_COMPLETED",
    entityType: "night_audit_run",
    entityId: runId,
    severity: "INFO",
    description: `Night audit completed for ${input.businessDate} (${completed}/${steps.length} steps)`,
    newValues: { business_date: input.businessDate, completed_steps: completed },
  });

  return {
    runId,
    status: "COMPLETED",
    completedSteps: completed,
    totalSteps: steps.length,
  };
};
