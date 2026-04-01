import type { CommandMetadata } from "@tartware/command-consumer-utils";
import type {
  RevenueGoalCreateCommand,
  RevenueGoalDeleteCommand,
  RevenueGoalTrackActualCommand,
  RevenueGoalUpdateCommand,
} from "@tartware/schemas";
import { query } from "../../lib/db.js";
import {
  REVENUE_GOAL_INSERT_SQL,
  REVENUE_GOAL_SOFT_DELETE_SQL,
  REVENUE_GOAL_TRACK_ACTUAL_SQL,
  REVENUE_GOAL_UPDATE_SQL,
} from "../../sql/goal-queries.js";

export const createRevenueGoal = async (
  payload: RevenueGoalCreateCommand,
  tenantId: string,
  actorId: string,
): Promise<{ goalId: string }> => {
  const { rows } = await query<{ goal_id: string }>(REVENUE_GOAL_INSERT_SQL, [
    tenantId,
    payload.property_id,
    payload.goal_name,
    payload.goal_type,
    payload.goal_period,
    payload.goal_category ?? "budget",
    payload.period_start_date,
    payload.period_end_date,
    payload.fiscal_year ?? null,
    payload.fiscal_quarter ?? null,
    payload.goal_amount ?? null,
    payload.goal_percent ?? null,
    payload.goal_count ?? null,
    payload.currency ?? "USD",
    payload.baseline_amount ?? null,
    payload.baseline_source ?? null,
    payload.segment_goals ? JSON.stringify(payload.segment_goals) : null,
    payload.channel_goals ? JSON.stringify(payload.channel_goals) : null,
    payload.room_type_goals ? JSON.stringify(payload.room_type_goals) : null,
    payload.department ?? null,
    payload.responsible_user_id ?? null,
    payload.notes ?? null,
    payload.metadata ? JSON.stringify(payload.metadata) : null,
    actorId,
  ]);
  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create revenue goal");
  }
  return { goalId: created.goal_id };
};

export const updateRevenueGoal = async (
  payload: RevenueGoalUpdateCommand,
  tenantId: string,
  actorId: string,
): Promise<{ goalId: string }> => {
  const { rows } = await query<{ goal_id: string }>(REVENUE_GOAL_UPDATE_SQL, [
    payload.goal_id,
    tenantId,
    payload.goal_name ?? null,
    payload.goal_amount ?? null,
    payload.goal_percent ?? null,
    payload.goal_count ?? null,
    payload.period_start_date ?? null,
    payload.period_end_date ?? null,
    payload.status ?? null,
    payload.baseline_amount ?? null,
    payload.segment_goals ? JSON.stringify(payload.segment_goals) : null,
    payload.channel_goals ? JSON.stringify(payload.channel_goals) : null,
    payload.room_type_goals ? JSON.stringify(payload.room_type_goals) : null,
    payload.department ?? null,
    payload.notes ?? null,
    payload.metadata ? JSON.stringify(payload.metadata) : null,
    actorId,
  ]);
  if (rows.length === 0) {
    throw new Error(`Goal ${payload.goal_id} not found or already deleted`);
  }
  const updated = rows[0];
  if (!updated) {
    throw new Error(`Goal ${payload.goal_id} not found or already deleted`);
  }
  return { goalId: updated.goal_id };
};

export const deleteRevenueGoal = async (
  payload: RevenueGoalDeleteCommand,
  tenantId: string,
  actorId: string,
): Promise<{ goalId: string }> => {
  const { rows } = await query<{ goal_id: string }>(REVENUE_GOAL_SOFT_DELETE_SQL, [
    payload.goal_id,
    tenantId,
    actorId,
  ]);
  if (rows.length === 0) {
    throw new Error(`Goal ${payload.goal_id} not found or already deleted`);
  }
  const deleted = rows[0];
  if (!deleted) {
    throw new Error(`Goal ${payload.goal_id} not found or already deleted`);
  }
  return { goalId: deleted.goal_id };
};

export const trackRevenueGoalActuals = async (
  payload: RevenueGoalTrackActualCommand,
  tenantId: string,
  actorId: string,
): Promise<{ updated: number }> => {
  const { rows } = await query<{
    goal_id: string;
    actual_amount: string | number | null;
    variance_amount: string | number | null;
    variance_percent: string | number | null;
    variance_status: string | null;
  }>(REVENUE_GOAL_TRACK_ACTUAL_SQL, [
    payload.property_id,
    tenantId,
    payload.business_date,
    actorId,
  ]);

  return { updated: rows.length };
};

// ── Command Handlers ────────────────────────────────

export const handleGoalCreate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string,
): Promise<{ goalId: string }> => {
  return createRevenueGoal(
    payload as unknown as RevenueGoalCreateCommand,
    metadata.tenantId,
    actorId,
  );
};

export const handleGoalUpdate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string,
): Promise<{ goalId: string }> => {
  return updateRevenueGoal(
    payload as unknown as RevenueGoalUpdateCommand,
    metadata.tenantId,
    actorId,
  );
};

export const handleGoalDelete = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string,
): Promise<{ goalId: string }> => {
  return deleteRevenueGoal(
    payload as unknown as RevenueGoalDeleteCommand,
    metadata.tenantId,
    actorId,
  );
};

export const handleGoalTrackActual = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string,
): Promise<{ updated: number }> => {
  return trackRevenueGoalActuals(
    payload as unknown as RevenueGoalTrackActualCommand,
    metadata.tenantId,
    actorId,
  );
};
