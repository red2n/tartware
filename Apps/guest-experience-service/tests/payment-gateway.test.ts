import { describe, expect, it } from "vitest";

import { StubPaymentGateway, type PaymentGateway } from "../src/services/booking-service.js";

describe("StubPaymentGateway", () => {
  const gateway: PaymentGateway = new StubPaymentGateway();

  it("authorizes a payment successfully", async () => {
    const result = await gateway.authorize(100.5, "USD", "tok_test_123");
    expect(result.status).toBe("authorized");
    expect(result.amount).toBe(100.5);
    expect(result.currency).toBe("USD");
    expect(result.authorizationId).toMatch(/^auth_/);
  });

  it("captures a payment successfully", async () => {
    const result = await gateway.capture("auth_123");
    expect(result.status).toBe("captured");
    expect(result.paymentId).toMatch(/^pay_/);
  });

  it("refunds a payment successfully", async () => {
    const result = await gateway.refund("pay_123", 50.25);
    expect(result.status).toBe("refunded");
    expect(result.amount).toBe(50.25);
    expect(result.refundId).toMatch(/^ref_/);
  });
});
