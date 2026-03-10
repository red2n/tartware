import type { CommandMetadata } from "@tartware/command-consumer-utils";
import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { generateRecommendations } from "../../services/recommendation-engine.js";
import {
  APPLY_RECOMMENDATION_SQL,
  APPROVE_RECOMMENDATION_SQL,
  BULK_APPROVE_RECOMMENDATIONS_SQL,
  RECOMMENDATION_BY_ID_SQL,
  REJECT_RECOMMENDATION_SQL,
} from "../../sql/recommendation-queries.js";

const logger = appLogger.child({ module: "recommendation-handlers" });

// ── R2: Generate Recommendations ─────────────────────

export const handleRecommendationGenerate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ generated: number; autoApplied: number }> => {
  const result = await generateRecommendations({
    tenantId: metadata.tenantId,
    propertyId: payload.property_id as string,
    startDate: payload.start_date as string,
    endDate: payload.end_date as string,
    roomTypeIds: payload.room_type_ids as string[] | undefined,
    minConfidence: (payload.min_confidence as number) ?? 50,
    autoApply: (payload.auto_apply as boolean) ?? false,
    autoApplyThreshold: (payload.auto_apply_threshold as number) ?? 85,
    supersedeExisting: (payload.supersede_existing as boolean) ?? true,
    actorId: actorId ?? metadata.tenantId,
    metadata: payload.metadata as Record<string, unknown> | undefined,
  });

  return { generated: result.generated, autoApplied: result.autoApplied };
};

// ── R3: Approve Recommendation ───────────────────────

export const handleRecommendationApprove = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ recommendationId: string; approved: boolean }> => {
  const recommendationId = payload.recommendation_id as string;
  const reviewNotes = (payload.review_notes as string) ?? null;

  const { rows } = await query<{ recommendation_id: string }>(RECOMMENDATION_BY_ID_SQL, [
    recommendationId,
    metadata.tenantId,
  ]);

  if (rows.length === 0) {
    throw new Error(`Recommendation ${recommendationId} not found`);
  }

  const rec = rows[0];
  if (
    (rec as Record<string, unknown>).status !== "pending" &&
    (rec as Record<string, unknown>).status !== "reviewed"
  ) {
    throw new Error(`Recommendation ${recommendationId} is not in pending/reviewed status`);
  }

  await query(APPROVE_RECOMMENDATION_SQL, [
    recommendationId,
    metadata.tenantId,
    actorId ?? metadata.tenantId,
    reviewNotes,
  ]);

  logger.info({ recommendationId, tenantId: metadata.tenantId }, "recommendation approved");
  return { recommendationId, approved: true };
};

// ── R3: Reject Recommendation ────────────────────────

export const handleRecommendationReject = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ recommendationId: string; rejected: boolean }> => {
  const recommendationId = payload.recommendation_id as string;
  const rejectionReason = payload.rejection_reason as string;

  const { rows } = await query<{ recommendation_id: string }>(RECOMMENDATION_BY_ID_SQL, [
    recommendationId,
    metadata.tenantId,
  ]);

  if (rows.length === 0) {
    throw new Error(`Recommendation ${recommendationId} not found`);
  }

  const rec = rows[0];
  if (
    (rec as Record<string, unknown>).status !== "pending" &&
    (rec as Record<string, unknown>).status !== "reviewed"
  ) {
    throw new Error(`Recommendation ${recommendationId} is not in pending/reviewed status`);
  }

  await query(REJECT_RECOMMENDATION_SQL, [
    recommendationId,
    metadata.tenantId,
    actorId ?? metadata.tenantId,
    rejectionReason,
  ]);

  logger.info({ recommendationId, tenantId: metadata.tenantId }, "recommendation rejected");
  return { recommendationId, rejected: true };
};

// ── R3: Apply Recommendation ─────────────────────────

export const handleRecommendationApply = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ recommendationId: string; implementedRate: number }> => {
  const recommendationId = payload.recommendation_id as string;
  const implementationNotes = (payload.implementation_notes as string) ?? null;

  const { rows } = await query<{
    recommendation_id: string;
    status: string;
    recommended_rate: string;
  }>(RECOMMENDATION_BY_ID_SQL, [recommendationId, metadata.tenantId]);

  const rec = rows[0];
  if (!rec) {
    throw new Error(`Recommendation ${recommendationId} not found`);
  }

  if (rec.status !== "accepted") {
    throw new Error(
      `Recommendation ${recommendationId} must be accepted before applying (current: ${rec.status})`,
    );
  }

  const implementedRate = (payload.override_rate as number) ?? Number(rec.recommended_rate);

  await query(APPLY_RECOMMENDATION_SQL, [
    recommendationId,
    metadata.tenantId,
    actorId ?? metadata.tenantId,
    implementedRate,
    implementationNotes,
  ]);

  logger.info(
    { recommendationId, implementedRate, tenantId: metadata.tenantId },
    "recommendation applied",
  );
  return { recommendationId, implementedRate };
};

// ── R3: Bulk Approve Recommendations ─────────────────

export const handleRecommendationBulkApprove = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ approved: number }> => {
  const recommendationIds = payload.recommendation_ids as string[];
  const reviewNotes = (payload.review_notes as string) ?? null;

  const result = await query(BULK_APPROVE_RECOMMENDATIONS_SQL, [
    recommendationIds,
    metadata.tenantId,
    actorId ?? metadata.tenantId,
    reviewNotes,
  ]);

  const approved = result.rowCount ?? 0;
  logger.info(
    { requested: recommendationIds.length, approved, tenantId: metadata.tenantId },
    "recommendations bulk approved",
  );
  return { approved };
};
