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
    const isDev = (process.env.NODE_ENV ?? "development") === "development";
    if (!isDev) {
      appLogger.error(
        { nodeEnv: process.env.NODE_ENV },
        "guest data encryption key cannot use development placeholder outside NODE_ENV=development",
      );
      throw new Error("Compliance encryption requirements not satisfied");
    }
    appLogger.warn("guest data encryption key is using a development placeholder");
  }
};

export const applyGuestRetentionPolicy = (guest: GuestWithStats): GuestWithStats =>
  _applyGuestRetentionPolicy(guest, config.compliance.retention.guestDataDays);
