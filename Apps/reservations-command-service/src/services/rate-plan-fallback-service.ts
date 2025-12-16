import { ratePlanFallbackConfig } from "../config.js";
import { query } from "../lib/db.js";
import { recordRatePlanFallback } from "../lib/metrics.js";

type EnsureRatePlanInput = {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  requestedRateCode?: string;
  reservationId?: string;
  correlationId: string;
  checkInDate: Date;
  checkOutDate: Date;
};

type RatePlanAssignment = {
  rateId: string;
  rateCode: string;
  fallbackApplied: boolean;
  fallbackReason?: string;
  requestedRateCode?: string;
};

/**
 * Validates the requested rate plan and deterministically falls back to BAR/RACK
 * when the inbound code is missing, inactive, or outside the stay window.
 */
export const ensureRatePlanAssignment = async (
  input: EnsureRatePlanInput,
): Promise<RatePlanAssignment> => {
  if (input.requestedRateCode) {
    const requested = await findRatePlan(
      input,
      input.requestedRateCode.toUpperCase(),
    );
    if (requested) {
      return {
        rateId: requested.id,
        rateCode: requested.rate_code,
        fallbackApplied: false,
        requestedRateCode: input.requestedRateCode.toUpperCase(),
      };
    }
  }

  for (const candidate of ratePlanFallbackConfig.codes) {
    const fallback = await findRatePlan(input, candidate);
    if (fallback) {
      const reason = buildFallbackReason(input.requestedRateCode, candidate);
      await insertFallbackAudit({
        tenantId: input.tenantId,
        propertyId: input.propertyId,
        roomTypeId: input.roomTypeId,
        reservationId: input.reservationId,
        correlationId: input.correlationId,
        requestedRateCode: input.requestedRateCode,
        appliedRateCode: candidate,
        reason,
        stay: {
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
        },
      });
      recordRatePlanFallback(candidate);
      return {
        rateId: fallback.id,
        rateCode: fallback.rate_code,
        fallbackApplied: true,
        fallbackReason: reason,
        requestedRateCode: input.requestedRateCode?.toUpperCase(),
      };
    }
  }

  throw new Error(
    `No fallback rate plans (BAR/RACK) provisioned for property ${input.propertyId}`,
  );
};

type RatePlanRow = {
  id: string;
  rate_code: string;
};

const findRatePlan = async (
  input: EnsureRatePlanInput,
  rateCode: string,
): Promise<RatePlanRow | null> => {
  const result = await query<RatePlanRow>(
    `
      SELECT id::text, rate_code
      FROM rates
      WHERE tenant_id = $1
        AND property_id = $2
        AND room_type_id = $3
        AND rate_code = $4
        AND status = 'ACTIVE'
        AND valid_from <= $5
        AND (valid_until IS NULL OR valid_until >= $6)
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
    `,
    [
      input.tenantId,
      input.propertyId,
      input.roomTypeId,
      rateCode,
      input.checkInDate,
      input.checkOutDate,
    ],
  );
  return result.rows[0] ?? null;
};

type FallbackAuditInput = {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  reservationId?: string;
  correlationId: string;
  requestedRateCode?: string;
  appliedRateCode: string;
  reason?: string;
  stay: {
    checkInDate: Date;
    checkOutDate: Date;
  };
};

const insertFallbackAudit = async (
  input: FallbackAuditInput,
): Promise<void> => {
  await query(
    `
      INSERT INTO rate_plan_fallback_audit (
        tenant_id,
        property_id,
        room_type_id,
        reservation_id,
        correlation_id,
        requested_rate_code,
        applied_rate_code,
        fallback_reason,
        actor,
        metadata,
        created_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10::jsonb, NOW()
      )
    `,
    [
      input.tenantId,
      input.propertyId,
      input.roomTypeId,
      input.reservationId ?? null,
      input.correlationId,
      input.requestedRateCode?.toUpperCase() ?? null,
      input.appliedRateCode,
      input.reason ?? null,
      ratePlanFallbackConfig.auditActor,
      JSON.stringify({
        stay: {
          checkInDate: input.stay.checkInDate.toISOString(),
          checkOutDate: input.stay.checkOutDate.toISOString(),
        },
      }),
    ],
  );
};

const buildFallbackReason = (
  requested: string | undefined,
  applied: string,
): string => {
  if (!requested) {
    return `Missing inbound rate plan; applied ${applied}`;
  }
  return `Requested rate plan ${requested.toUpperCase()} unavailable; applied ${applied}`;
};

/**
 * Binds the actual reservation identifier to any previously inserted fallback audit rows.
 */
export const attachReservationToFallbackAudit = async (
  correlationId: string,
  reservationId: string,
): Promise<void> => {
  await query(
    `
      UPDATE rate_plan_fallback_audit
      SET reservation_id = $2
      WHERE correlation_id = $1
        AND reservation_id IS NULL
    `,
    [correlationId, reservationId],
  );
};
