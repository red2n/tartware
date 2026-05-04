import { auditAsync, auditWithClient } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingChargebackRecordCommandSchema,
  BillingChargebackUpdateStatusCommandSchema,
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
 * Record a processor-initiated chargeback against a completed payment.
 * Creates a refund row with chargeback fields and adjusts the folio balance.
 */
export const recordChargeback = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingChargebackRecordCommandSchema.parse(payload);
  const actor = resolveActorId(context.initiatedBy);

  // Find the original payment
  const { rows: paymentRows } = await query<{
    id: string;
    amount: string;
    reservation_id: string | null;
    guest_id: string | null;
    status: string;
  }>(
    `SELECT id, amount, reservation_id, guest_id, status
     FROM public.payments
     WHERE tenant_id = $1::uuid AND payment_reference = $2
     ORDER BY created_at DESC LIMIT 1`,
    [context.tenantId, command.payment_reference],
  );

  const payment = paymentRows[0];
  if (!payment) {
    throw new BillingCommandError(
      "PAYMENT_NOT_FOUND",
      `No payment found with reference ${command.payment_reference}`,
    );
  }

  if (payment.status !== "COMPLETED" && payment.status !== "PARTIALLY_REFUNDED") {
    throw new BillingCommandError(
      "INVALID_PAYMENT_STATUS",
      `Cannot record chargeback on payment with status ${payment.status}`,
    );
  }

  if (command.chargeback_amount > Number(payment.amount)) {
    throw new BillingCommandError(
      "CHARGEBACK_EXCEEDS_PAYMENT",
      `Chargeback amount ${command.chargeback_amount} exceeds payment amount ${payment.amount}`,
    );
  }

  if (!payment.guest_id) {
    throw new BillingCommandError(
      "MISSING_GUEST_ID",
      `Cannot record chargeback: payment ${command.payment_reference} has no associated guest.`,
    );
  }

  // Insert a refund row with chargeback fields set
  const { rows: refundRows } = await query<{ refund_id: string }>(
    `INSERT INTO public.refunds (
       tenant_id, property_id, original_payment_id, guest_id,
       refund_amount, currency_code, refund_type, refund_method,
       reason_category, reason_description, request_source, refund_status,
       is_chargeback, chargeback_date, chargeback_reason, chargeback_reference,
       approved_at, approved_by,
       completed_at, processed_by, requested_by, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $9::uuid,
       $4, 'USD', 'DISPUTE', 'ORIGINAL_PAYMENT_METHOD',
       'DISPUTE', $5::text, 'CHARGEBACK', 'COMPLETED',
       true, COALESCE($6::date, CURRENT_DATE), $5::varchar, $7::varchar,
       NOW(), $8::uuid,
       NOW(), $8::uuid, $8::uuid, $8::uuid, $8::uuid
     ) RETURNING refund_id`,
    [
      context.tenantId,
      command.property_id,
      payment.id,
      command.chargeback_amount,
      command.chargeback_reason,
      command.chargeback_date ?? null,
      command.chargeback_reference ?? null,
      actor,
      payment.guest_id,
    ],
  );

  const refundId = refundRows[0]?.refund_id;

  // Update the original payment status
  await query(
    `UPDATE public.payments
     SET status = (CASE
       WHEN $3 >= amount THEN 'REFUNDED'
       ELSE 'PARTIALLY_REFUNDED'
     END)::payment_status,
     refund_amount = COALESCE(refund_amount, 0) + $3,
     version = version + 1,
     updated_at = NOW(), updated_by = $4::uuid
     WHERE tenant_id = $1::uuid AND id = $2::uuid`,
    [context.tenantId, payment.id, command.chargeback_amount, actor],
  );

  // Adjust the folio balance if a reservation is linked
  if (payment.reservation_id) {
    await query(
      `WITH target_folio AS (
         SELECT folio_id
         FROM public.folios
         WHERE tenant_id = $1::uuid
           AND reservation_id = $2::uuid
           AND folio_status != 'CLOSED'
         ORDER BY created_at DESC
         LIMIT 1
       )
       UPDATE public.folios AS f
       SET balance = f.balance + $3,
           total_payments = f.total_payments - $3,
           updated_at = NOW()
       FROM target_folio tf
       WHERE f.folio_id = tf.folio_id`,
      [context.tenantId, payment.reservation_id, command.chargeback_amount],
    );
  }

  appLogger.info(
    {
      paymentId: payment.id,
      refundId,
      chargebackAmount: command.chargeback_amount,
      reason: command.chargeback_reason,
    },
    "Chargeback recorded",
  );
  auditAsync({
    tenantId: context.tenantId,
    userId: resolveActorId(context.initiatedBy),
    action: "CHARGEBACK_RECORD",
    entityType: "refund",
    entityId: refundId ?? payment.id,
    severity: "WARNING",
    isPciRelevant: true,
    description: `Chargeback recorded for payment ${payment.id} (amount=${command.chargeback_amount}, reason=${command.chargeback_reason})`,
    newValues: {
      payment_id: payment.id,
      refund_id: refundId,
      chargeback_amount: command.chargeback_amount,
      chargeback_reason: command.chargeback_reason,
    },
  });

  return refundId ?? payment.id;
};

// \u2500\u2500\u2500 Chargeback State Machine \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

/** Valid forward state transitions for a chargeback dispute (BA \u00a74.4). */
const CHARGEBACK_TRANSITIONS: Record<string, string[]> = {
  RECEIVED: ["EVIDENCE_SUBMITTED"],
  EVIDENCE_SUBMITTED: ["WON", "LOST"],
};

/**
 * Advance a chargeback dispute through its state machine:
 *   RECEIVED \u2192 EVIDENCE_SUBMITTED \u2192 WON | LOST
 *
 * On transition to LOST the associated folio is automatically reopened so the
 * property can post a correction charge without manual intervention (BA \u00a74.4).
 *
 * @returns refund_id of the updated chargeback record.
 */
export const updateChargebackStatus = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingChargebackUpdateStatusCommandSchema.parse(payload);
  const actor = asUuid(resolveActorId(context.initiatedBy));

  return withTransaction(async (client) => {
    const { rows } = await queryWithClient<{
      refund_id: string;
      chargeback_status: string | null;
      original_payment_id: string;
      reservation_id: string | null;
      is_chargeback: boolean;
    }>(
      client,
      `SELECT r.refund_id, r.chargeback_status, r.original_payment_id,
              p.reservation_id, r.is_chargeback
       FROM public.refunds r
       LEFT JOIN public.payments p ON p.id = r.original_payment_id
       WHERE r.tenant_id = $1::uuid AND r.refund_id = $2::uuid
       FOR UPDATE OF r`,
      [context.tenantId, command.refund_id],
    );

    const record = rows[0];
    if (!record) {
      throw new BillingCommandError("CHARGEBACK_NOT_FOUND", "Chargeback record not found.");
    }
    if (!record.is_chargeback) {
      throw new BillingCommandError(
        "NOT_A_CHARGEBACK",
        "The specified refund is not a chargeback record.",
      );
    }

    const currentStatus = record.chargeback_status ?? "RECEIVED";
    const allowedNext = CHARGEBACK_TRANSITIONS[currentStatus] ?? [];
    if (!allowedNext.includes(command.chargeback_status)) {
      throw new BillingCommandError(
        "INVALID_CHARGEBACK_TRANSITION",
        `Cannot transition from ${currentStatus} to ${command.chargeback_status}. Allowed: ${allowedNext.join(", ")}`,
      );
    }

    const evidenceJson = command.evidence ? JSON.stringify(command.evidence) : null;

    await queryWithClient(
      client,
      `UPDATE public.refunds
       SET chargeback_status = $3,
           notes = CASE
             WHEN $4::text IS NULL THEN notes
             WHEN notes IS NULL THEN $4::text
             ELSE CONCAT_WS(E'\\n', notes, $4::text)
           END,
           metadata = CASE
             WHEN $5::jsonb IS NULL THEN metadata
             ELSE COALESCE(metadata, '{}'::jsonb) || $5::jsonb
           END,
           updated_at = NOW(), updated_by = $6::uuid
       WHERE tenant_id = $1::uuid AND refund_id = $2::uuid`,
      [
        context.tenantId,
        command.refund_id,
        command.chargeback_status,
        command.notes ?? null,
        evidenceJson ? JSON.parse(evidenceJson) : null,
        actor,
      ],
    );

    // Auto-reopen the folio when the chargeback is LOST so the property can
    // post a correction without manual intervention. Inlined here to use the
    // existing transaction client and avoid a nested withTransaction deadlock.
    if (command.chargeback_status === "LOST" && record.reservation_id) {
      const folioId = await resolveFolioId(context.tenantId, record.reservation_id);
      if (folioId) {
        const { rows: folioRows } = await queryWithClient<{ folio_status: string }>(
          client,
          `SELECT folio_status FROM public.folios
           WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
           FOR UPDATE`,
          [context.tenantId, folioId],
        );
        const folioStatus = folioRows[0]?.folio_status;
        if (folioStatus && folioStatus !== "OPEN") {
          await queryWithClient(
            client,
            `UPDATE public.folios
             SET folio_status = 'OPEN',
                 closed_at = NULL, settled_at = NULL, settled_by = NULL,
                 notes = CONCAT_WS(E'\\n', notes, $3::text),
                 updated_at = NOW(), updated_by = $4::uuid
             WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
            [
              context.tenantId,
              folioId,
              `REOPENED: Auto-reopened: chargeback ${command.refund_id} resolved as LOST`,
              actor,
            ],
          );
        }
      }
    }

    appLogger.info(
      {
        refundId: command.refund_id,
        previousStatus: currentStatus,
        newStatus: command.chargeback_status,
      },
      "Chargeback status updated",
    );
    await auditWithClient(client, {
      tenantId: context.tenantId,
      userId: actor ?? SYSTEM_ACTOR_ID,
      action: "CHARGEBACK_STATUS_UPDATE",
      entityType: "refund",
      entityId: command.refund_id,
      severity: command.chargeback_status === "LOST" ? "WARNING" : "INFO",
      isPciRelevant: true,
      description: `Chargeback ${command.refund_id} \u2192 ${command.chargeback_status} (was ${currentStatus})`,
      oldValues: { chargeback_status: currentStatus },
      newValues: { chargeback_status: command.chargeback_status },
    });

    return command.refund_id;
  });
};
