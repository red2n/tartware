import type {
  CancellationPolicy,
  RatePlanResolution,
  ResolveRatePlanInput,
} from "@tartware/schemas";

import { findActiveRateByCode } from "../repositories/rate-repository.js";

const FALLBACK_RATE_CODES = ["BAR", "RACK"] as const;

export type { RatePlanResolution };

/**
 * Coerce the JSONB cancellation_policy column into the shared CancellationPolicy
 * shape. Returns null when the column is empty or malformed so downstream code
 * can detect "no policy snapshot" without throwing.
 */
const coerceCancellationPolicy = (value: unknown): CancellationPolicy | null => {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const type = typeof obj.type === "string" ? obj.type : null;
  const hours = typeof obj.hours === "number" ? obj.hours : null;
  const penalty = typeof obj.penalty === "number" ? obj.penalty : null;
  if (type === null || hours === null || penalty === null) return null;
  return { type, hours, penalty };
};

const normalizeRateCode = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed.toUpperCase();
};

const findRateOrNull = async (input: ResolveRatePlanInput, rateCode: string) => {
  return findActiveRateByCode({
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    roomTypeId: input.roomTypeId,
    rateCode,
    stayStart: input.stayStart,
    stayEnd: input.stayEnd,
  });
};

/**
 * Resolve the applicable rate plan for a stay window.
 */
export const resolveRatePlan = async (input: ResolveRatePlanInput): Promise<RatePlanResolution> => {
  const normalizedRequested = normalizeRateCode(input.requestedRateCode);
  const decidedAt = new Date();

  if (normalizedRequested) {
    const requestedRate = await findRateOrNull(input, normalizedRequested);
    if (requestedRate) {
      return {
        appliedRateCode: requestedRate.rate_code,
        rateId: requestedRate.id,
        requestedRateCode: normalizedRequested,
        fallbackApplied: false,
        decidedAt,
        cancellationPolicySnapshot: coerceCancellationPolicy(requestedRate.cancellation_policy),
      };
    }
  }

  const fallbackReason = normalizedRequested ? "RATE_UNAVAILABLE" : "MISSING_RATE_CODE";
  // When no rate code was requested, using BAR/RACK is the default — not a fallback
  const isTrueFallback = !!normalizedRequested;

  for (const fallbackCode of FALLBACK_RATE_CODES) {
    if (normalizedRequested && fallbackCode === normalizedRequested) {
      continue;
    }
    const fallbackRate = await findRateOrNull(input, fallbackCode);
    if (fallbackRate) {
      return {
        appliedRateCode: fallbackRate.rate_code,
        rateId: fallbackRate.id,
        requestedRateCode: normalizedRequested,
        fallbackApplied: isTrueFallback,
        reason: isTrueFallback ? fallbackReason : undefined,
        decidedAt,
        cancellationPolicySnapshot: coerceCancellationPolicy(fallbackRate.cancellation_policy),
      };
    }
  }

  if (normalizedRequested) {
    throw new Error(
      `Rate code ${normalizedRequested} unavailable and fallback BAR/RACK not configured`,
    );
  }
  throw new Error("Default fallback rate codes (BAR/RACK) are not configured for this stay window");
};
