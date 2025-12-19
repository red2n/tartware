import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { config } from "../src/config.js";
import { applyGuestRetentionPolicy } from "../src/lib/compliance-policies.js";
import type { GuestWithStats } from "@tartware/schemas";

const ORIGINAL_GUEST_RETENTION = config.compliance.retention.guestDataDays;

describe("Compliance retention policies", () => {
  beforeEach(() => {
    config.compliance.retention.guestDataDays = 30;
  });

  afterEach(() => {
    config.compliance.retention.guestDataDays = ORIGINAL_GUEST_RETENTION;
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
});
