import { applyBillingRetentionPolicy as _applyBillingRetentionPolicy } from "@tartware/schemas";

import { config } from "../config.js";
import type { BillingPayment } from "../services/billing-service.js";

import { appLogger } from "./logger.js";

const PLACEHOLDER_WARNING =
  "compliance encryption key is using a local placeholder. Override with a secure value in production.";

export const ensureBillingEncryptionRequirementsMet = (): void => {
  if (
    config.compliance.encryption.requireBillingEncryption &&
    (!config.compliance.encryption.billingDataKey ||
      config.compliance.encryption.billingDataKey.length < 16)
  ) {
    appLogger.error(
      {
        keyConfigured: Boolean(config.compliance.encryption.billingDataKey),
      },
      "billing data encryption key must be provided and at least 16 characters long",
    );
    throw new Error("Billing encryption requirements not satisfied");
  }

  const isDev = (process.env.NODE_ENV ?? "development") !== "production";

  if (config.compliance.encryption.billingDataKey === "local-dev-billing-key") {
    if (isDev) {
      appLogger.warn({ key: "billing-data" }, PLACEHOLDER_WARNING);
    } else {
      appLogger.error(
        { key: "billing-data", nodeEnv: process.env.NODE_ENV },
        `SECURITY: ${PLACEHOLDER_WARNING} Refusing to start in production with a placeholder key.`,
      );
      throw new Error("Placeholder billing encryption key must not be used outside development");
    }
  }

  // Shadow mode disables authoritative billing writes — must not run in production.
  if (config.roll.shadowMode && !isDev) {
    appLogger.error(
      { shadowMode: true, nodeEnv: process.env.NODE_ENV },
      "SHADOW_MODE=true is not allowed outside NODE_ENV=development. " +
        "Billing writes will be non-authoritative. Set SHADOW_MODE=false before deploying.",
    );
    throw new Error("Shadow mode must not be enabled in production");
  }

  if (config.roll.shadowMode && isDev) {
    appLogger.warn(
      { shadowMode: true },
      "⚠️  SHADOW_MODE=true — billing shadow ledger writes are non-authoritative (dev only)",
    );
  }
};

export const applyBillingRetentionPolicy = (payment: BillingPayment): BillingPayment =>
  _applyBillingRetentionPolicy(payment, config.compliance.retention.billingDataDays);
