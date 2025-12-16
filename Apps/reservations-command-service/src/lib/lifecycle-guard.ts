import type { ReservationLifecycleState } from "@tartware/schemas";
import type { PoolClient, QueryResultRow } from "pg";

import { lifecycleGuardConfig } from "../config.js";

import { query, withTransaction } from "./db.js";
import {
  recordLifecycleCheckpointMetric,
  setLifecycleStalledCount,
} from "./metrics.js";

const allowedInitialStates: ReservationLifecycleState[] = [
  "RECEIVED",
  "PERSISTED",
];

const allowedTransitions: Record<
  ReservationLifecycleState,
  ReservationLifecycleState[]
> = {
  RECEIVED: ["RECEIVED", "PERSISTED", "DLQ"],
  PERSISTED: ["PERSISTED", "PUBLISHED", "DLQ"],
  PUBLISHED: ["PUBLISHED", "CONSUMED", "DLQ"],
  CONSUMED: ["CONSUMED", "APPLIED", "DLQ"],
  APPLIED: ["APPLIED"],
  DLQ: ["DLQ"],
};

type LifecycleCheckpointInput = {
  correlationId: string;
  tenantId: string;
  state: ReservationLifecycleState;
  source: string;
  reservationId?: string;
  actor?: string;
  reason?: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  expiresAt?: Date | string | null;
};

export type LifecycleEventRecord = {
  id: string;
  correlationId: string;
  reservationId?: string | null;
  tenantId: string;
  state: ReservationLifecycleState;
  checkpointSource: string;
  checkpointActor?: string | null;
  checkpointPayload: Record<string, unknown>;
  reason?: string | null;
  metadata: Record<string, unknown>;
  checkpointedAt: Date;
  expiresAt?: Date | null;
  createdAt: Date;
};

type StampOptions = {
  client?: PoolClient;
};

type LifecycleEventRow = QueryResultRow & {
  id: string;
  correlation_id: string;
  reservation_id?: string | null;
  tenant_id: string;
  state: ReservationLifecycleState;
  checkpoint_source: string;
  checkpoint_actor?: string | null;
  checkpoint_payload?: Record<string, unknown>;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  checkpointed_at: Date;
  expires_at?: Date | null;
  created_at: Date;
};

export type LifecycleHealthSummary = {
  thresholdMs: number;
  states: ReservationLifecycleState[];
  stalled: Array<{ state: ReservationLifecycleState; count: number }>;
};

/**
 * Persists a lifecycle checkpoint, enforcing allowed transitions
 * and emitting Prometheus metrics for observability.
 */
export const stampLifecycleCheckpoint = async (
  input: LifecycleCheckpointInput,
  options: StampOptions = {},
): Promise<LifecycleEventRecord> => {
  if (options.client) {
    return stampWithClient(options.client, input);
  }
  return withTransaction((client) => stampWithClient(client, input));
};

/**
 * Returns the most recent lifecycle event for the provided correlation id.
 */
export const getLatestLifecycleEvent = async (
  correlationId: string,
): Promise<LifecycleEventRecord | null> => {
  const result = await query<LifecycleEventRow>(
    `
      SELECT
        id::text,
        correlation_id::text,
        reservation_id::text,
        tenant_id::text,
        state::text AS state,
        checkpoint_source,
        checkpoint_actor,
        checkpoint_payload,
        reason,
        metadata,
        checkpointed_at,
        expires_at,
        created_at
      FROM reservation_lifecycle_events
      WHERE correlation_id = $1
      ORDER BY checkpointed_at DESC
      LIMIT 1
    `,
    [correlationId],
  );
  const row = result.rows[0];
  return row ? mapLifecycleRow(row) : null;
};

/**
 * Aggregates lifecycle health by counting states that have stalled
 * beyond the configured threshold. Also refreshes Prometheus gauges.
 */
export const getLifecycleHealthSummary = async (
  thresholdMs = lifecycleGuardConfig.staleThresholdMs,
  statesInput = lifecycleGuardConfig.stalledStates,
): Promise<LifecycleHealthSummary> => {
  const normalizedStates = normalizeStates(statesInput);
  if (normalizedStates.length === 0) {
    return { thresholdMs, states: [], stalled: [] };
  }

  const result = await query<{ state: string; count: string }>(
    `
      SELECT state::text AS state, COUNT(*)::text AS count
      FROM reservation_lifecycle_events
      WHERE state::text = ANY($1::text[])
        AND checkpointed_at <= NOW() - ($2::int * interval '1 millisecond')
      GROUP BY state
    `,
    [normalizedStates, thresholdMs],
  );

  const counts = new Map<ReservationLifecycleState, number>();
  for (const state of normalizedStates) {
    counts.set(state, 0);
  }

  for (const row of result.rows) {
    const state = row.state as ReservationLifecycleState;
    const current = counts.get(state) ?? 0;
    counts.set(state, current + Number(row.count ?? "0"));
  }

  const stalled = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .map(([state, count]) => ({ state, count }));

  for (const [state, count] of counts.entries()) {
    setLifecycleStalledCount(state, count);
  }

  return {
    thresholdMs,
    states: normalizedStates,
    stalled,
  };
};

const stampWithClient = async (
  client: PoolClient,
  input: LifecycleCheckpointInput,
): Promise<LifecycleEventRecord> => {
  const latestState = await fetchLatestLifecycleState(
    client,
    input.correlationId,
  );
  validateTransition(latestState, input.state);

  const result = await client.query<LifecycleEventRow>(
    `
      INSERT INTO reservation_lifecycle_events (
        correlation_id,
        reservation_id,
        tenant_id,
        state,
        checkpoint_source,
        checkpoint_actor,
        checkpoint_payload,
        reason,
        metadata,
        checkpointed_at,
        expires_at,
        created_at
      ) VALUES (
        $1,
        $2,
        $3,
        $4::reservation_lifecycle_state,
        $5,
        $6,
        $7::jsonb,
        $8,
        $9::jsonb,
        NOW(),
        $10,
        NOW()
      )
      RETURNING
        id::text,
        correlation_id::text,
        reservation_id::text,
        tenant_id::text,
        state::text AS state,
        checkpoint_source,
        checkpoint_actor,
        checkpoint_payload,
        reason,
        metadata,
        checkpointed_at,
        expires_at,
        created_at
    `,
    [
      input.correlationId,
      input.reservationId ?? null,
      input.tenantId,
      input.state,
      input.source,
      input.actor ?? null,
      JSON.stringify(input.payload ?? {}),
      input.reason ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.expiresAt ?? null,
    ],
  );

  const record = mapLifecycleRow(result.rows[0]);
  recordLifecycleCheckpointMetric(record.state, input.source);
  return record;
};

const fetchLatestLifecycleState = async (
  client: PoolClient,
  correlationId: string,
): Promise<ReservationLifecycleState | undefined> => {
  const result = await client.query<{ state: string }>(
    `
      SELECT
        state::text AS state
      FROM reservation_lifecycle_events
      WHERE correlation_id = $1
      ORDER BY checkpointed_at DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `,
    [correlationId],
  );
  const row = result.rows[0];
  return row ? (row.state as ReservationLifecycleState) : undefined;
};

const validateTransition = (
  currentState: ReservationLifecycleState | undefined,
  nextState: ReservationLifecycleState,
) => {
  if (!currentState) {
    if (!allowedInitialStates.includes(nextState)) {
      throw new Error(
        `Invalid initial lifecycle state "${nextState}" for guard ledger`,
      );
    }
    return;
  }

  const allowed = allowedTransitions[currentState] ?? [];
  if (!allowed.includes(nextState)) {
    throw new Error(
      `Illegal lifecycle transition from "${currentState}" to "${nextState}"`,
    );
  }
};

const mapLifecycleRow = (row: LifecycleEventRow): LifecycleEventRecord => ({
  id: row.id?.toString(),
  correlationId: row.correlation_id,
  reservationId: row.reservation_id ?? null,
  tenantId: row.tenant_id,
  state: row.state,
  checkpointSource: row.checkpoint_source,
  checkpointActor: row.checkpoint_actor ?? null,
  checkpointPayload: coerceObject(row.checkpoint_payload),
  reason: row.reason ?? null,
  metadata: coerceObject(row.metadata),
  checkpointedAt: row.checkpointed_at,
  expiresAt: row.expires_at ?? null,
  createdAt: row.created_at,
});

const coerceObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
};

const normalizeStates = (
  states: readonly string[],
): ReservationLifecycleState[] => {
  const seen = new Set<ReservationLifecycleState>();
  for (const state of states) {
    const normalized = state.toUpperCase() as ReservationLifecycleState;
    if (allowedTransitions[normalized]) {
      seen.add(normalized);
    }
  }
  return Array.from(seen);
};
