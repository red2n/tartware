import { describe, expect, it, beforeEach } from "vitest";

import { config } from "../src/config.js";
import {
  applyBillingRetentionPolicy,
  applyGuestRetentionPolicy,
} from "../src/lib/compliance-policies.js";
import type { GuestWithStats } from "@tartware/schemas";
import type { BillingPayment } from "../src/services/billing-service.js";

const ORIGINAL_GUEST_RETENTION = config.compliance.retention.guestDataDays;
const ORIGINAL_BILLING_RETENTION = config.compliance.retention.billingDataDays;

describe("Compliance retention policies", () => {
  beforeEach(() => {
    config.compliance.retention.guestDataDays = 30;
    config.compliance.retention.billingDataDays = 30;
  });

  afterEach(() => {
    config.compliance.retention.guestDataDays = ORIGINAL_GUEST_RETENTION;
    config.compliance.retention.billingDataDays = ORIGINAL_BILLING_RETENTION;
  });

  it("redacts guest PII when record exceeds retention window", () => {
    const guest = {
      id: "11111111-1111-1111-1111-111111111111",
      tenant_id: "22222222-2222-2222-2222-222222222222",
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone: "+1-555-0000",
      secondary_phone: "+1-555-1111",
      address: { street: "123 Main" },
      loyalty_tier: "gold",
      loyalty_points: 100,
      vip_status: true,
      preferences: { language: "en" },
      marketing_consent: true,
      communication_preferences: { email: true, sms: true, phone: true, post: true },
      total_bookings: 5,
      total_nights: 10,
      total_revenue: 1234,
      is_blacklisted: false,
      metadata: {},
      created_at: new Date("2020-01-01"),
      updated_at: new Date("2020-01-10"),
      version: BigInt(1),
    } as unknown as GuestWithStats;

    const redacted = applyGuestRetentionPolicy(guest);
    expect(redacted.email).toBe("[REDACTED]");
    expect(redacted.phone).toBeUndefined();
    expect(redacted.communication_preferences.email).toBe(false);
  });

  it("masks billing payment references beyond retention window", () => {
    const payment: BillingPayment = {
      id: "33333333-3333-3333-3333-333333333333",
      tenant_id: "44444444-4444-4444-4444-444444444444",
      property_id: "55555555-5555-5555-5555-555555555555",
      payment_reference: "PR-123",
      transaction_type: "sale",
      transaction_type_display: "Sale",
      payment_method: "card",
      payment_method_display: "Card",
      status: "completed",
      status_display: "Completed",
      amount: 10,
      currency: "USD",
      created_at: "2020-01-01T00:00:00.000Z",
      version: "1",
      guest_name: "John Smith",
    };

    const sanitized = applyBillingRetentionPolicy(payment);
    expect(sanitized.payment_reference).toBe("[REDACTED]");
    expect(sanitized.guest_name).toBe("REDACTED");
  });
});
