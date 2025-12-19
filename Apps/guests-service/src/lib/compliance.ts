import type { GuestWithStats } from "@tartware/schemas";

import { config } from "../config.js";

import { appLogger } from "./logger.js";

const MS_PER_DAY = 86_400_000;
const REDACTED_VALUE = "[REDACTED]" as const;

const isOlderThanRetention = (
  input: Date | string | undefined,
  retentionDays: number,
): boolean => {
  if (!input || retentionDays <= 0) {
    return false;
  }

  const timestamp =
    typeof input === "string"
      ? Date.parse(input)
      : input instanceof Date
        ? input.getTime()
        : NaN;

  if (Number.isNaN(timestamp)) {
    return false;
  }

  return Date.now() - timestamp > retentionDays * MS_PER_DAY;
};

const sanitizeAddress = <T extends GuestWithStats["address"]>(
  address: T,
): T => {
  if (!address) {
    return address;
  }
  const sanitized: T = { ...address };
  for (const key in sanitized) {
    if (Object.hasOwn(sanitized, key)) {
      (sanitized as Record<string, unknown>)[key] = REDACTED_VALUE;
    }
  }
  return sanitized;
};

export const ensureGuestEncryptionRequirementsMet = (): void => {
  if (!config.compliance.encryption.requireGuestEncryption) {
    return;
  }

  if (
    !config.compliance.encryption.guestDataKey ||
    config.compliance.encryption.guestDataKey.length < 16
  ) {
    appLogger.error(
      "guest data encryption key must be provided and at least 16 characters long",
    );
    throw new Error("Compliance encryption requirements not satisfied");
  }

  if (config.compliance.encryption.guestDataKey === "local-dev-guest-key") {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    if (nodeEnv === "production" || nodeEnv === "staging") {
      appLogger.error(
        "guest data encryption key cannot use development placeholder in production/staging",
      );
      throw new Error("Compliance encryption requirements not satisfied");
    }
    appLogger.warn(
      "guest data encryption key is using a development placeholder",
    );
  }
};

export const applyGuestRetentionPolicy = (
  guest: GuestWithStats,
): GuestWithStats => {
  const retentionDays = config.compliance.retention.guestDataDays;
  const referenceDate =
    guest.last_stay_date ?? guest.updated_at ?? guest.created_at;

  if (!isOlderThanRetention(referenceDate, retentionDays)) {
    return guest;
  }

  return {
    ...guest,
    email: REDACTED_VALUE,
    phone: undefined,
    secondary_phone: undefined,
    address: sanitizeAddress(guest.address),
    id_type: undefined,
    id_number: undefined,
    passport_number: undefined,
    passport_expiry: undefined,
    company_name: undefined,
    company_tax_id: undefined,
    loyalty_tier: undefined,
    loyalty_points: 0,
    vip_status: false,
    communication_preferences: {
      ...guest.communication_preferences,
      email: false,
      sms: false,
      phone: false,
      post: false,
    },
    notes: undefined,
    metadata: {},
  };
};
