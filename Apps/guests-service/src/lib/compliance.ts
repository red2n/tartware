import type { GuestWithStats } from "@tartware/schemas";
import { applyGuestRetentionPolicy as _applyGuestRetentionPolicy } from "@tartware/schemas";

import { config } from "../config.js";

import { appLogger } from "./logger.js";

export const ensureGuestEncryptionRequirementsMet = (): void => {
  if (!config.compliance.encryption.requireGuestEncryption) {
    return;
  }

  if (
    !config.compliance.encryption.guestDataKey ||
    config.compliance.encryption.guestDataKey.length < 16
  ) {
    appLogger.error("guest data encryption key must be provided and at least 16 characters long");
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
    appLogger.warn("guest data encryption key is using a development placeholder");
  }
};

export const applyGuestRetentionPolicy = (guest: GuestWithStats): GuestWithStats =>
  _applyGuestRetentionPolicy(guest, config.compliance.retention.guestDataDays);
