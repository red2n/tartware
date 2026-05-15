import { auditAsync, auditWithClient } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { acquireFolioLock } from "../../lib/folio-lock.js";
import { getPropertyBaseCurrency, lockFxRate } from "../../lib/fx-rate-lookup.js";
import { debitAccountForPaymentMethod, postGlPair } from "../../lib/gl-posting.js";
import { appLogger } from "../../lib/logger.js";
import {
  type BillingPaymentCaptureCommand,
  BillingPaymentCaptureCommandSchema,
} from "../../schemas/billing-commands.js";

import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  resolveFolioId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Enforce credit limit for a guest/account before allowing a charge.
 * Checks `credit_limits` for active limits and compares current_balance + chargeAmount
 * against the effective limit (including any temporary increase).
 * Returns a warning string if warning threshold is reached, or throws if blocked.
 */
export async function enforceCreditLimit(
  tenantId: string,
  guestId: string | undefined | null,
  chargeAmount: number,
): Promise<string | null> {
  if (!guestId) return null;

  const { rows } = await query<{
    credit_limit_id: string;
    credit_limit_amount: string;
    current_balance: string;
    warning_threshold_percent: string;
    block_threshold_percent: string;
    temporary_increase_active: boolean;
    temporary_increase_amount: string | null;
    version: number;
  }>(
    `SELECT credit_limit_id, credit_limit_amount, current_balance,
            warning_threshold_percent, block_threshold_percent,
            temporary_increase_active, temporary_increase_amount, version
     FROM credit_limits
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
       AND is_active = true AND credit_status = 'active'
       AND effective_from <= CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY credit_limit_amount DESC LIMIT 1`,
    [tenantId, guestId],
  );

  const limit = rows[0];
  if (!limit) return null; // No credit limit configured — allow

  const effectiveLimit =
    Number(limit.credit_limit_amount) +
    (limit.temporary_increase_active ? Number(limit.temporary_increase_amount ?? 0) : 0);
  const currentBalance = Number(limit.current_balance);
  const projectedBalance = currentBalance + chargeAmount;
  const utilizationPct = (projectedBalance / effectiveLimit) * 100;

  const blockPct = Number(limit.block_threshold_percent);
  if (utilizationPct >= blockPct) {
    throw new BillingCommandError(
      "CREDIT_LIMIT_EXCEEDED",
      `Payment of ${chargeAmount} would push utilization to ${utilizationPct.toFixed(1)}% (block threshold: ${blockPct}%). Available credit: ${(effectiveLimit - currentBalance).toFixed(2)}`,
    );
  }

  const warningPct = Number(limit.warning_threshold_percent);
  if (utilizationPct >= warningPct) {
    return `Credit utilization at ${utilizationPct.toFixed(1)}% (warning threshold: ${warningPct}%)`;
  }

  return null;
}

/**
 * Capture a payment and record it in billing.
 */
export const captureBillingPayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPaymentCaptureCommandSchema.parse(payload);
  return capturePayment(command, context);
};

const capturePayment = async (
  command: BillingPaymentCaptureCommand,
  context: CommandContext,
): Promise<string> => {
  const actor = resolveActorId(context.initiatedBy);
  const currency = command.currency ?? "USD";
  const gatewayResponse = command.gateway?.response ?? {};

  // Enforce credit limit before capturing
  const creditWarning = await enforceCreditLimit(
    context.tenantId,
    command.guest_id,
    command.amount,
  );
  if (creditWarning) {
    appLogger.warn({ guestId: command.guest_id, creditWarning }, "Credit limit warning on capture");
  }

  // Resolve folio before the transaction so we know whether to update it
  const folioIdForUpdate = command.folio_id ?? null;
  const reservationIdForFolio = command.reservation_id ?? null;
  const resolvedFolioId =
    folioIdForUpdate ??
    (reservationIdForFolio ? await resolveFolioId(context.tenantId, reservationIdForFolio) : null);

  const paymentId = await withTransaction(async (client) => {
    // Acquire advisory lock on the folio before any balance mutation to prevent
    // concurrent payment + checkout race conditions
    if (resolvedFolioId) {
      await acquireFolioLock(client, resolvedFolioId);
    }

    // ACCT-13: Lock FX rate at payment capture time.
    const paymentCurrency = currency.toUpperCase();
    const baseCurrency = await getPropertyBaseCurrency(
      client,
      context.tenantId,
      command.property_id,
    );
    const fxLock = await lockFxRate(
      client,
      context.tenantId,
      paymentCurrency,
      baseCurrency,
      command.amount,
    );

    const result = await queryWithClient<{ id: string }>(
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
        exchange_rate,
        base_amount,
        base_currency,
        status,
        gateway_name,
        gateway_reference,
        gateway_response,
        processed_at,
        processed_by,
        metadata,
        created_by,
        updated_by
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4::uuid,
        $5,
        'CAPTURE',
        UPPER($6)::payment_method,
        $7,
        UPPER($8),
        $14,
        $15,
        UPPER($16),
        'COMPLETED',
        $9,
        $10,
        $11::jsonb,
        NOW(),
        $12,
        $13::jsonb,
        $12,
        $12
      )
      ON CONFLICT (tenant_id, payment_reference) DO UPDATE
      SET
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        exchange_rate = EXCLUDED.exchange_rate,
        base_amount = EXCLUDED.base_amount,
        base_currency = EXCLUDED.base_currency,
        payment_method = EXCLUDED.payment_method,
        status = 'COMPLETED',
        gateway_name = COALESCE(EXCLUDED.gateway_name, payments.gateway_name),
        gateway_reference = COALESCE(EXCLUDED.gateway_reference, payments.gateway_reference),
        gateway_response = payments.gateway_response || EXCLUDED.gateway_response,
        processed_at = NOW(),
        processed_by = EXCLUDED.processed_by,
        metadata = payments.metadata || EXCLUDED.metadata,
        version = payments.version + 1,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING id
    `,
      [
        context.tenantId,
        command.property_id,
        command.reservation_id ?? null,
        command.guest_id ?? null,
        command.payment_reference,
        command.payment_method,
        command.amount,
        paymentCurrency,
        command.gateway?.name ?? null,
        command.gateway?.reference ?? null,
        JSON.stringify(gatewayResponse),
        actor,
        JSON.stringify(command.metadata ?? {}),
        fxLock.rate, // $14
        fxLock.baseAmount, // $15
        baseCurrency, // $16
      ],
    );

    const id = result.rows[0]?.id;
    if (!id) {
      throw new BillingCommandError("PAYMENT_CAPTURE_FAILED", "Failed to record captured payment.");
    }

    // Update folio balance atomically. Overpayment detection in one round-trip:
    //   balance     → GREATEST(0, balance - amount)          never go negative
    //   credit_balance → existing + GREATEST(0, amount - balance)  capture excess
    // RETURNING both values so we can detect and audit overpayments without a 2nd query.
    let creditBalance = 0;
    if (resolvedFolioId) {
      // Fetch current version for OCC
      const { rows: currentFolio } = await queryWithClient<{ version: number }>(
        client,
        `SELECT version FROM public.folios WHERE tenant_id = $1::uuid AND folio_id = $2::uuid FOR UPDATE`,
        [context.tenantId, resolvedFolioId],
      );
      const folio = currentFolio[0];
      if (!folio) {
        throw new BillingCommandError("FOLIO_NOT_FOUND", "Folio record missing during update.");
      }
      const expectedVersion = folio.version;

      const { rows: folioRows, rowCount } = await queryWithClient<{
        balance: string;
        credit_balance: string;
      }>(
        client,
        `
        UPDATE public.folios
        SET
          total_payments  = total_payments + $2,
          balance         = GREATEST(0, balance - $2),
          credit_balance  = credit_balance + GREATEST(0, $2 - balance),
          version         = version + 1,
          updated_at      = NOW(),
          updated_by      = $3::uuid
        WHERE tenant_id = $1::uuid
          AND folio_id  = $4::uuid
          AND version   = $5
        RETURNING balance, credit_balance
        `,
        [context.tenantId, command.amount, actor, resolvedFolioId, expectedVersion],
      );

      if (rowCount === 0) {
        throw new BillingCommandError(
          "CONCURRENT_MODIFICATION",
          "Folio was modified by another process. Please retry.",
          true,
        );
      }
      creditBalance = Number(folioRows[0]?.credit_balance ?? 0);
    }

    // GL posting (USALI double-entry): DR cash account / CR Guest Ledger (1100).
    // Inside the same transaction as the payments INSERT and folios UPDATE so a
    // failed GL pair rolls back the entire payment — books stay balanced.
    const businessDate = new Date().toISOString().slice(0, 10);
    await postGlPair(client, {
      tenant_id: context.tenantId,
      property_id: command.property_id,
      folio_id: resolvedFolioId ?? undefined,
      reservation_id: command.reservation_id ?? undefined,
      debit_account: debitAccountForPaymentMethod(command.payment_method),
      credit_account: "1100", // Guest Ledger — payment reduces guest receivable
      amount: command.amount,
      currency,
      posting_date: businessDate,
      usali_category: "Cash & Equivalents",
      description: `Payment captured via ${command.payment_method}: ${command.payment_reference}`,
      source_table: "payments",
      source_id: id,
      reference_number: command.payment_reference,
      created_by: asUuid(actor) ?? SYSTEM_ACTOR_ID,
    });

    // PCI-DSS Req 10: audit all payment captures synchronously within the transaction.
    await auditWithClient(
      client,
      {
        tenantId: context.tenantId,
        propertyId: command.property_id,
        userId: actor,
        action: "PAYMENT_CAPTURE",
        entityType: "payment",
        entityId: id,
        severity: "INFO",
        isPciRelevant: true,
        isGdprRelevant: true,
        description: `Payment captured: ${command.amount} ${command.currency ?? "USD"} via ${command.payment_method}`,
        newValues: {
          payment_id: id,
          amount: command.amount,
          currency: command.currency ?? "USD",
          payment_method: command.payment_method,
          transaction_type: command.transaction_type,
          folio_id: resolvedFolioId,
          reservation_id: command.reservation_id,
          payment_reference: command.payment_reference,
          credit_balance: creditBalance > 0 ? creditBalance : undefined,
        },
      },
      context,
    );

    return { paymentId: id, creditBalance };
  });

  // Fire async overpayment audit outside the transaction (zero hot-path latency).
  // The credit_balance column is already persisted above; this is informational only.
  if (paymentId.creditBalance > 0 && resolvedFolioId) {
    auditAsync(
      {
        tenantId: context.tenantId,
        propertyId: command.property_id,
        userId: actor,
        action: "OVERPAYMENT_DETECTED",
        entityType: "folio",
        entityId: resolvedFolioId,
        category: "FINANCIAL",
        severity: "WARNING",
        isPciRelevant: true,
        description: `Overpayment of ${paymentId.creditBalance} credited to folio ${resolvedFolioId}`,
        newValues: {
          folio_id: resolvedFolioId,
          credit_balance: paymentId.creditBalance,
          payment_reference: command.payment_reference,
          payment_amount: command.amount,
        },
      },
      context,
    );
    appLogger.warn(
      {
        folioId: resolvedFolioId,
        creditBalance: paymentId.creditBalance,
        tenantId: context.tenantId,
      },
      "Overpayment detected — credit_balance updated on folio",
    );
  }

  // ─── Post-capture: Auto-apply to AR if reservation has city ledger entries ──
  // Fire-and-forget: if this reservation has open AR city ledger entries,
  // dispatch ar.payment.apply so the outstanding balance is reduced automatically.
  try {
    const { dispatchArPaymentApply } = await import("./ara-payment-hook.js");
    await dispatchArPaymentApply(
      context.tenantId,
      command.property_id,
      paymentId.paymentId,
      command.amount,
      command.reservation_id ?? null,
    );
  } catch {
    // Non-fatal — AR cash application can be done manually.
  }

  return paymentId.paymentId;
};
