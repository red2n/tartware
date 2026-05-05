import type { PaymentRow } from "@tartware/schemas";

import { auditWithClient } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { acquireFolioLock } from "../../lib/folio-lock.js";
import {
  type BillingPaymentRefundCommand,
  BillingPaymentRefundCommandSchema,
} from "../../schemas/billing-commands.js";
import {
  addMoney,
  moneyGt,
  moneyGte,
  parseDbMoney,
  parseDbMoneyOrZero,
  subtractMoney,
} from "../../utils/money.js";
import {
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
} from "./common.js";

/**
 * Refund a captured payment and record the refund.
 */
export const refundBillingPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentRefundCommandSchema.parse(payload);
  return refundPayment(command, context);
};

const refundPayment = async (
  command: BillingPaymentRefundCommand,
  context: CommandContext,
): Promise<string> => {
  const original = await loadPayment(command, context.tenantId);
  if (!original) {
    throw new BillingCommandError(
      "PAYMENT_NOT_FOUND",
      "Original payment could not be located for refund.",
    );
  }

  const actor = resolveActorId(context.initiatedBy);
  const originalAmount = parseDbMoney(original.amount);
  if (originalAmount === null) {
    throw new BillingCommandError(
      "PAYMENT_AMOUNT_MISSING",
      "Original payment amount is missing; refund cannot be processed.",
    );
  }
  const previousRefunds = parseDbMoneyOrZero(original.refund_amount);
  const refundTotal = addMoney(previousRefunds, command.amount);

  // Prevent refunds exceeding original payment (using safe money comparison)
  if (moneyGt(refundTotal, originalAmount)) {
    const availableRefund = subtractMoney(originalAmount, previousRefunds);
    throw new BillingCommandError(
      "REFUND_EXCEEDS_PAYMENT",
      `Refund amount ${command.amount} would exceed original payment. Available for refund: ${availableRefund}`,
    );
  }

  const refundStatus = moneyGte(refundTotal, originalAmount) ? "REFUNDED" : "PARTIALLY_REFUNDED";
  const refundTransactionType = moneyGte(command.amount, originalAmount)
    ? "REFUND"
    : "PARTIAL_REFUND";

  const refundReference =
    command.refund_reference ?? `${original.payment_reference}-RF-${Date.now().toString(36)}`;

  // Resolve folio so we can lock it before writing — prevents a concurrent
  // checkout from closing the folio while the refund is in flight
  const refundFolioId = await resolveFolioId(context.tenantId, command.reservation_id);

  return withTransaction(async (client) => {
    // Acquire advisory lock on the folio to prevent concurrent checkout race
    if (refundFolioId) {
      await acquireFolioLock(client, refundFolioId);
    }

    const refundResult = await queryWithClient<{ id: string }>(
      client,
      `
        INSERT INTO public.payments (
          tenant_id,
          property_id,
          reservation_id,
          guest_id,
          payment_reference,
          transaction_type,
          payment_method,
          amount,
          currency,
          status,
          processed_at,
          processed_by,
          metadata,
          notes,
          created_by,
          updated_by
        ) VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5,
          $6::transaction_type,
          UPPER($7)::payment_method,
          $8,
          UPPER($9),
          'COMPLETED',
          NOW(),
          $10,
          $11::jsonb,
          $12,
          $10,
          $10
        )
        RETURNING id
      `,
      [
        context.tenantId,
        command.property_id,
        command.reservation_id,
        command.guest_id,
        refundReference,
        refundTransactionType,
        command.payment_method ?? original.payment_method,
        command.amount,
        command.currency ?? original.currency ?? "USD",
        actor,
        JSON.stringify({ reason: command.reason ?? undefined }),
        command.reason ?? null,
      ],
    );

    const refundId = refundResult.rows[0]?.id;
    if (!refundId) {
      throw new BillingCommandError(
        "REFUND_RECORD_FAILED",
        "Failed to record refund payment entry.",
      );
    }

    await queryWithClient(
      client,
      `
        UPDATE public.payments
        SET
          refund_amount = COALESCE(refund_amount, 0) + $3,
          status = $4::payment_status,
          refund_reason = COALESCE($5, refund_reason),
          refund_date = NOW(),
          refunded_by = $6,
          version = COALESCE(version, 0) + 1,
          updated_at = NOW(),
          updated_by = $6
        WHERE tenant_id = $1::uuid
          AND id = $2::uuid
      `,
      [context.tenantId, original.id, command.amount, refundStatus, command.reason ?? null, actor],
    );

    // PCI-DSS Req 10: audit all payment refunds synchronously within the transaction.
    await auditWithClient(client, {
      tenantId: context.tenantId,
      propertyId: command.property_id,
      userId: actor,
      action: "PAYMENT_REFUND",
      entityType: "payment",
      entityId: refundId,
      severity: "WARNING",
      isPciRelevant: true,
      isGdprRelevant: true,
      description: `Payment refund: ${command.amount} ${command.currency ?? "USD"} reason=${command.reason ?? "not provided"}`,
      oldValues: {
        original_payment_id: original.id,
        original_amount: originalAmount,
      },
      newValues: {
        refund_id: refundId,
        refund_amount: command.amount,
        refund_reference: refundReference,
        new_payment_status: refundStatus,
        reservation_id: command.reservation_id,
      },
    });

    return refundId;
  });
};

const loadPayment = async (
  command: BillingPaymentRefundCommand,
  tenantId: string,
): Promise<PaymentRow | undefined> => {
  const { rows } = await query<PaymentRow>(
    `
      SELECT
        id,
        amount,
        refund_amount,
        payment_method,
        currency,
        payment_reference
      FROM public.payments
      WHERE tenant_id = $1::uuid
        AND (
          ($2::uuid IS NOT NULL AND id = $2::uuid)
          OR ($3::text IS NOT NULL AND payment_reference = $3::text)
        )
      LIMIT 1
    `,
    [tenantId, command.payment_id ?? null, command.payment_reference ?? null],
  );

  return rows[0];
};
