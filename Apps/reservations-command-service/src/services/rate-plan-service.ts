import { findActiveRateByCode } from "../repositories/rate-repository.js";

const FALLBACK_RATE_CODES = ["BAR", "RACK"] as const;

export type RatePlanResolution = {
  appliedRateCode: string;
  rateId?: string;
  requestedRateCode?: string;
  fallbackApplied: boolean;
  reason?: string;
  decidedAt: Date;
};

type ResolveRatePlanInput = {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  stayStart: Date;
  stayEnd: Date;
  requestedRateCode?: string;
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

const findRateOrNull = async (
  input: ResolveRatePlanInput,
  rateCode: string,
) => {
  return findActiveRateByCode({
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    roomTypeId: input.roomTypeId,
    rateCode,
    stayStart: input.stayStart,
    stayEnd: input.stayEnd,
  });
};

export const resolveRatePlan = async (
  input: ResolveRatePlanInput,
): Promise<RatePlanResolution> => {
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
      };
    }
  }

  const fallbackReason = normalizedRequested
    ? "RATE_UNAVAILABLE"
    : "MISSING_RATE_CODE";

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
        fallbackApplied: true,
        reason: fallbackReason,
        decidedAt,
      };
    }
  }

  if (normalizedRequested) {
    throw new Error(
      `Rate code ${normalizedRequested} unavailable and fallback BAR/RACK not configured`,
    );
  }
  throw new Error(
    "Default fallback rate codes (BAR/RACK) are not configured for this stay window",
  );
};
