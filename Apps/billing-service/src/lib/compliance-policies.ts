import { config } from "../config.js";
import type { BillingPayment } from "../services/billing-service.js";

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

export const applyBillingRetentionPolicy = (payment: BillingPayment): BillingPayment => {
  const retentionDays = config.compliance.retention.billingDataDays;
  const referenceDate = payment.processed_at ?? payment.created_at;
  if (!isOlderThanRetention(referenceDate ? new Date(referenceDate) : undefined, retentionDays)) {
    return payment;
  }

  return {
    ...payment,
    payment_reference: REDACTED_VALUE,
    external_transaction_id: undefined,
    gateway_name: undefined,
    gateway_reference: undefined,
    guest_name: "REDACTED",
  };
};
