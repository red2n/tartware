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

  if (config.compliance.encryption.billingDataKey === "local-dev-billing-key") {
    appLogger.warn({ key: "billing-data" }, PLACEHOLDER_WARNING);
  }
};

export const applyBillingRetentionPolicy = (payment: BillingPayment): BillingPayment =>
  _applyBillingRetentionPolicy(payment, config.compliance.retention.billingDataDays);
