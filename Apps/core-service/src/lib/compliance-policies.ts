import type { GuestWithStats } from "@tartware/schemas";

import { config } from "../config.js";
import { appLogger } from "./logger.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REDACTED_VALUE = "[REDACTED]" as const;
const PLACEHOLDER_WARNING =
  "compliance encryption key is using a local placeholder. Override with a secure value in production.";

const isOlderThanRetention = (input: Date | string | undefined, retentionDays: number): boolean => {
  if (!input || retentionDays <= 0) {
    return false;
  }
  const timestamp =
    typeof input === "string" ? Date.parse(input) : input instanceof Date ? input.getTime() : NaN;
  if (Number.isNaN(timestamp)) {
    return false;
  }
  const ageMs = Date.now() - timestamp;
  return ageMs > retentionDays * MS_PER_DAY;
};

const sanitizeAddress = (address: GuestWithStats["address"]): GuestWithStats["address"] => {
  if (!address) {
    return address;
  }
  const sanitized: Record<string, string> = {};
  for (const key of Object.keys(address)) {
    sanitized[key] = REDACTED_VALUE;
  }
  return sanitized;
};

export const ensureEncryptionRequirementsMet = (): void => {
  const issues: string[] = [];
  if (
    config.compliance.encryption.requireGuestEncryption &&
    (!config.compliance.encryption.guestDataKey ||
      config.compliance.encryption.guestDataKey.length < 16)
  ) {
    issues.push("Guest data encryption key must be provided and at least 16 characters long");
  }
  if (
    config.compliance.encryption.requireBillingEncryption &&
    (!config.compliance.encryption.billingDataKey ||
      config.compliance.encryption.billingDataKey.length < 16)
  ) {
    issues.push("Billing data encryption key must be provided and at least 16 characters long");
  }

  if (issues.length > 0) {
    for (const message of issues) {
      appLogger.error({ message }, "compliance encryption validation");
    }
    throw new Error("Compliance encryption requirements not satisfied");
  }

  if (config.compliance.encryption.guestDataKey === "local-dev-guest-key") {
    appLogger.warn({ key: "guest-data" }, PLACEHOLDER_WARNING);
  }
  if (config.compliance.encryption.billingDataKey === "local-dev-billing-key") {
    appLogger.warn({ key: "billing-data" }, PLACEHOLDER_WARNING);
  }
};

export const applyGuestRetentionPolicy = (guest: GuestWithStats): GuestWithStats => {
  const retentionDays = config.compliance.retention.guestDataDays;
  const referenceDate = guest.last_stay_date ?? guest.updated_at ?? guest.created_at;
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

export const isOutsideComplianceHours = (
  date: Date,
  startHour: number,
  endHour: number,
): boolean => {
  const hour = date.getUTCHours();
  if (startHour === endHour) {
    return false;
  }
  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }
  return hour >= startHour || hour < endHour;
};
