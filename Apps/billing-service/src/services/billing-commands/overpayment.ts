import { auditAsync, auditWithClient } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { acquireFolioLock } from "../../lib/folio-lock.js";
import {
  type BillingOverpaymentHandleCommand,
  BillingOverpaymentHandleCommandSchema,
} from "../../schemas/billing-commands.js";
import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/**
 * Handle a detected overpayment on a folio.
 * REFUND: clears credit_balance and creates a refund transaction.
 * CREDIT: marks credit_balance as intentional (no-op on the amount — already stored).
 * HOLD:   logs for front-desk review; no financial mutation.
 *
 * Standard: USALI 12th Ed §7.3 (Guest Credit Balance), GAAP credit liability.
 */
export const handleOverpayment = async (
  payload: unknown,
  context: CommandContext,
): Promise<{ action: string; creditBalance: number }> => {
  const command = BillingOverpaymentHandleCommandSchema.parse(
    payload,
  ) as BillingOverpaymentHandleCommand;
  const actor = resolveActorId(context.initiatedBy);

  // Read current credit_balance
  const { rows: folioRows } = await query<{ credit_balance: string; folio_id: string }>(
    `SELECT folio_id, credit_balance
     FROM public.folios
     WHERE tenant_id = $1::uuid AND folio_id = $2::uuid
       AND COALESCE(is_deleted, false) = false`,
    [context.tenantId, command.folio_id],
  );

  const folio = folioRows[0];
  if (!folio) {
    throw new BillingCommandError("FOLIO_NOT_FOUND", `Folio ${command.folio_id} not found`);
  }

  const currentCredit = Number(folio.credit_balance);
  const actAmount = command.amount ?? currentCredit;

  if (actAmount <= 0 || actAmount > currentCredit) {
    throw new BillingCommandError(
      "INVALID_CREDIT_AMOUNT",
      `Action amount ${actAmount} is invalid. Current credit balance is ${currentCredit}`,
    );
  }

  if (command.action === "HOLD") {
    auditAsync({
      tenantId: context.tenantId,
      propertyId: command.property_id,
      userId: actor,
      action: "OVERPAYMENT_HOLD",
      entityType: "folio",
      entityId: command.folio_id,
      category: "FINANCIAL",
      severity: "WARNING",
      description: `Overpayment of ${actAmount} flagged for front-desk review on folio ${command.folio_id}`,
      metadata: { notes: command.notes },
    });
    return { action: "HOLD", creditBalance: currentCredit };
  }

  // REFUND or CREDIT — both require a transaction
  const newCredit = await withTransaction(async (client) => {
    await acquireFolioLock(client, command.folio_id);

    if (command.action === "REFUND") {
      // Reduce credit_balance and record a REFUND payment row
      await queryWithClient(
        client,
        `UPDATE public.folios
         SET credit_balance = credit_balance - $2,
             updated_at = NOW(), updated_by = $3
         WHERE tenant_id = $1::uuid AND folio_id = $4::uuid`,
        [context.tenantId, actAmount, actor, command.folio_id],
      );

      await queryWithClient(
        client,
        `INSERT INTO public.payments (
           tenant_id, property_id,
           payment_reference, transaction_type, payment_method,
           amount, currency, status, processed_at, processed_by,
           notes, created_by, updated_by
         ) VALUES (
           $1::uuid, $2::uuid,
           $3, 'REFUND', 'CREDIT_CARD',
           $4, 'USD', 'COMPLETED', NOW(), $5::uuid,
           $6, $5::uuid, $5::uuid
         )`,
        [
          context.tenantId,
          command.property_id,
          `OVERPAY-REFUND-${command.folio_id.slice(0, 8)}-${Date.now().toString(36)}`,
          actAmount,
          asUuid(actor) ?? SYSTEM_ACTOR_ID,
          command.notes ?? "Overpayment refund",
        ],
      );

      await auditWithClient(client, {
        tenantId: context.tenantId,
        propertyId: command.property_id,
        userId: actor,
        action: "OVERPAYMENT_REFUNDED",
        entityType: "folio",
        entityId: command.folio_id,
        category: "FINANCIAL",
        severity: "INFO",
        isPciRelevant: true,
        description: `Overpayment of ${actAmount} refunded from folio ${command.folio_id}`,
        oldValues: { credit_balance: currentCredit },
        newValues: { credit_balance: currentCredit - actAmount },
      });
    } else {
      // CREDIT — intentional credit, just log; credit_balance stays as-is
      await auditWithClient(client, {
        tenantId: context.tenantId,
        propertyId: command.property_id,
        userId: actor,
        action: "OVERPAYMENT_CREDITED",
        entityType: "folio",
        entityId: command.folio_id,
        category: "FINANCIAL",
        severity: "INFO",
        description: `Overpayment of ${actAmount} retained as credit on folio ${command.folio_id}`,
        newValues: { credit_balance: currentCredit, notes: command.notes },
      });
    }

    const { rows: updated } = await queryWithClient<{ credit_balance: string }>(
      client,
      `SELECT credit_balance FROM public.folios
       WHERE tenant_id = $1::uuid AND folio_id = $2::uuid`,
      [context.tenantId, command.folio_id],
    );
    return Number(updated[0]?.credit_balance ?? 0);
  });

  return { action: command.action, creditBalance: newCredit };
};
