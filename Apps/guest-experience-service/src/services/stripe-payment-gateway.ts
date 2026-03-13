import { randomUUID } from "node:crypto";
import type { PinoLogger } from "@tartware/telemetry";
import Stripe from "stripe";

import type {
  AuthorizationResult,
  CaptureResult,
  PaymentGateway,
  RefundResult,
} from "./booking-service.js";

/**
 * Stripe payment gateway adapter.
 *
 * Uses Stripe PaymentIntents with manual capture for the AUTHORIZE → CAPTURE flow
 * required by hotel deposit/payment processing.
 */
export class StripePaymentGateway implements PaymentGateway {
  private readonly stripe: Stripe;
  private readonly logger: PinoLogger;

  constructor(secretKey: string, logger: PinoLogger) {
    this.stripe = new Stripe(secretKey);
    this.logger = logger.child({ provider: "stripe" });
  }

  async authorize(amount: number, currency: string, token: string): Promise<AuthorizationResult> {
    const idempotencyKey = `auth_${randomUUID()}`;

    try {
      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: Math.round(amount * 100),
          currency: currency.toLowerCase(),
          payment_method: token,
          capture_method: "manual",
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: "never" },
        },
        { idempotencyKey },
      );

      const status = paymentIntent.status === "requires_capture" ? "authorized" : "declined";

      this.logger.info(
        { paymentIntentId: paymentIntent.id, status, amount, currency },
        "Stripe payment authorized",
      );

      return {
        authorizationId: paymentIntent.id,
        status,
        amount,
        currency,
      };
    } catch (error) {
      this.logger.error({ err: error, amount, currency }, "Stripe authorize failed");
      return {
        authorizationId: "",
        status: "declined",
        amount,
        currency,
      };
    }
  }

  async capture(authorizationId: string): Promise<CaptureResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.capture(authorizationId);

      const status = paymentIntent.status === "succeeded" ? "captured" : "failed";

      this.logger.info(
        { paymentIntentId: paymentIntent.id, status, amount: paymentIntent.amount_received / 100 },
        "Stripe payment captured",
      );

      return {
        paymentId: paymentIntent.id,
        status,
        amount: paymentIntent.amount_received / 100,
      };
    } catch (error) {
      this.logger.error({ err: error, authorizationId }, "Stripe capture failed");
      return {
        paymentId: authorizationId,
        status: "failed",
        amount: 0,
      };
    }
  }

  async refund(paymentId: string, amount: number): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentId,
        amount: Math.round(amount * 100),
      });

      const status = refund.status === "succeeded" ? "refunded" : "failed";

      this.logger.info({ refundId: refund.id, status, amount }, "Stripe refund processed");

      return {
        refundId: refund.id,
        status,
        amount: (refund.amount ?? 0) / 100,
      };
    } catch (error) {
      this.logger.error({ err: error, paymentId, amount }, "Stripe refund failed");
      return {
        refundId: "",
        status: "failed",
        amount,
      };
    }
  }
}
