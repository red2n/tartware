import { beforeEach, describe, expect, it, vi } from "vitest";

import { refundBillingPayment } from "../src/services/billing-command-service.js";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../src/lib/db.js", () => ({
  query: queryMock,
  queryWithClient: vi.fn(),
  withTransaction: vi.fn(),
}));

type PaymentRow = {
  id: string;
  amount: number;
  refund_amount: number | null;
  payment_method: string;
  currency: string | null;
  payment_reference: string;
};

const buildPaymentRow = (overrides: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "payment-1",
  amount: 100,
  refund_amount: 0,
  payment_method: "CARD",
  currency: "USD",
  payment_reference: "pay-001",
  ...overrides,
});

const buildRefundPayload = (amount: number) => ({
  payment_reference: "pay-001",
  property_id: "11111111-1111-1111-1111-111111111111",
  reservation_id: "22222222-2222-2222-2222-222222222222",
  guest_id: "33333333-3333-3333-3333-333333333333",
  amount,
  currency: "USD",
  reason: "Customer request",
});

describe("refundBillingPayment validation", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("allows refund equal to original payment", async () => {
    queryMock.mockImplementation(async (text: string) => {
      if (text.includes("FROM public.payments") && text.includes("LIMIT 1")) {
        return { rows: [buildPaymentRow()], rowCount: 1 };
      }
      if (text.includes("INSERT INTO public.payments")) {
        return { rows: [{ id: "refund-1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const refundId = await refundBillingPayment(buildRefundPayload(100), {
      tenantId: "44444444-4444-4444-4444-444444444444",
      initiatedBy: { userId: "user-1" },
    });

    expect(refundId).toBe("refund-1");
  });

  it("rejects refund exceeding original payment", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [buildPaymentRow({ amount: 100, refund_amount: 0 })],
      rowCount: 1,
    });

    await expect(
      refundBillingPayment(buildRefundPayload(150), {
        tenantId: "44444444-4444-4444-4444-444444444444",
        initiatedBy: { userId: "user-1" },
      }),
    ).rejects.toMatchObject({ code: "REFUND_EXCEEDS_PAYMENT" });
  });

  it("allows multiple partial refunds up to original amount", async () => {
    queryMock.mockImplementation(async (text: string) => {
      if (text.includes("FROM public.payments") && text.includes("LIMIT 1")) {
        return {
          rows: [buildPaymentRow({ amount: 100, refund_amount: 50 })],
          rowCount: 1,
        };
      }
      if (text.includes("INSERT INTO public.payments")) {
        return { rows: [{ id: "refund-2" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const refundId = await refundBillingPayment(buildRefundPayload(50), {
      tenantId: "44444444-4444-4444-4444-444444444444",
      initiatedBy: { userId: "user-1" },
    });

    expect(refundId).toBe("refund-2");
  });

  it("rejects partial refunds that exceed original amount cumulatively", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [buildPaymentRow({ amount: 100, refund_amount: 80 })],
      rowCount: 1,
    });

    await expect(
      refundBillingPayment(buildRefundPayload(30), {
        tenantId: "44444444-4444-4444-4444-444444444444",
        initiatedBy: { userId: "user-1" },
      }),
    ).rejects.toMatchObject({ code: "REFUND_EXCEEDS_PAYMENT" });
  });
});
