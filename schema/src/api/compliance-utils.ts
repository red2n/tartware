import type { GuestWithStats } from "../schemas/01-core/guests.js";

import type { BillingPaymentListItem } from "./billing.js";

const MS_PER_DAY = 86_400_000;

/** Sentinel value written over PII / PCI fields that have passed the retention window. */
export const COMPLIANCE_REDACTED_VALUE = "[REDACTED]";

/**
 * Return `true` when `input` is older than `retentionDays` days.
 * Safe to call with `undefined` (returns `false`).
 */
export const isOlderThanRetention = (
  input: Date | string | undefined,
  retentionDays: number,
): boolean => {
  if (!input || retentionDays <= 0) {
    return false;
  }
  const timestamp =
    typeof input === "string" ? Date.parse(input) : input instanceof Date ? input.getTime() : NaN;
  if (Number.isNaN(timestamp)) {
    return false;
  }
  return Date.now() - timestamp > retentionDays * MS_PER_DAY;
};

/**
 * Redact PCI-sensitive fields from a billing payment record once it exceeds
 * the configured retention window.
 */
export const applyBillingRetentionPolicy = (
  payment: BillingPaymentListItem,
  retentionDays: number,
): BillingPaymentListItem => {
  const referenceDate = payment.processed_at ?? payment.created_at;
  if (!isOlderThanRetention(referenceDate ? new Date(referenceDate) : undefined, retentionDays)) {
    return payment;
  }
  return {
    ...payment,
    payment_reference: COMPLIANCE_REDACTED_VALUE,
    external_transaction_id: undefined,
    gateway_name: undefined,
    gateway_reference: undefined,
    guest_name: "REDACTED",
  };
};

const sanitizeAddress = <T extends GuestWithStats["address"]>(address: T): T => {
  if (!address) {
    return address;
  }
  const sanitized: T = { ...address };
  for (const key in sanitized) {
    if (Object.hasOwn(sanitized, key)) {
      (sanitized as Record<string, unknown>)[key] = COMPLIANCE_REDACTED_VALUE;
    }
  }
  return sanitized;
};

/**
 * Redact PII fields from a guest record once it exceeds the configured
 * retention window.
 */
export const applyGuestRetentionPolicy = (
  guest: GuestWithStats,
  retentionDays: number,
): GuestWithStats => {
  const referenceDate = guest.last_stay_date ?? guest.updated_at ?? guest.created_at;
  if (!isOlderThanRetention(referenceDate, retentionDays)) {
    return guest;
  }
  return {
    ...guest,
    email: COMPLIANCE_REDACTED_VALUE,
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
    vip_status: "NONE",
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
