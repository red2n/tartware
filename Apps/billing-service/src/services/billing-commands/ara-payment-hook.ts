/**
 * Payment → AR Cash Application Hook
 *
 * After a payment is captured, check if the reservation has open AR city
 * ledger entries. If so, dispatch `ar.payment.apply` to automatically
 * reduce the outstanding AR balance (FIFO allocation by oldest invoice).
 *
 * This fires only when:
 *   1. The payment is linked to a reservation
 *   2. That reservation has at least one open city ledger entry
 *
 * Non-blocking: dispatches to Kafka and returns immediately.
 */
import { randomUUID } from "node:crypto";

import { config } from "../../config.js";
import { publishEvent } from "../../kafka/producer.js";
import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";

const logger = appLogger.child({ module: "ara-payment-hook" });

/**
 * Check if a reservation has open AR city ledger entries, and if so,
 * dispatch ar.payment.apply to the command pipeline.
 */
export const dispatchArPaymentApply = async (
  tenantId: string,
  propertyId: string,
  paymentId: string,
  amount: number,
  reservationId: string | null,
): Promise<void> => {
  if (!reservationId) return;

  // Find any open city ledger entries linked to this reservation's folio
  const result = await query<{ ar_account_id: string; entry_id: string }>(
    `SELECT cl.ar_account_id, cl.id AS entry_id
     FROM public.ar_city_ledger cl
     JOIN public.folios f ON f.folio_id = cl.folio_id AND f.tenant_id = cl.tenant_id
     WHERE cl.tenant_id = $1::uuid
       AND f.reservation_id = $2::uuid
       AND cl.status IN ('OPEN', 'PARTIAL')
     ORDER BY cl.due_date ASC
     LIMIT 1`,
    [tenantId, reservationId],
  );

  if (result.rows.length === 0) return;

  const row = result.rows[0];
  if (!row) return;
  const { ar_account_id: arAccountId } = row;
  const commandId = randomUUID();
  const idempotencyKey = `ar-payment-apply:${paymentId}`;

  const envelope = {
    id: commandId,
    command_name: "ar.payment.apply",
    payload: {
      ar_account_id: arAccountId,
      payment_id: paymentId,
      property_id: propertyId,
      amount,
      allocation_strategy: "FIFO",
      idempotency_key: idempotencyKey,
    },
    metadata: {
      commandName: "ar.payment.apply",
      tenantId,
      initiatedBy: "system:payment-capture-hook",
      correlationId: randomUUID(),
      timestamp: new Date().toISOString(),
      targetService: "accounts-service",
      idempotencyKey,
    },
  };

  await publishEvent({
    key: tenantId,
    value: JSON.stringify(envelope),
    topic: config.arEvents.commandTopic,
    headers: {
      "x-command-name": "ar.payment.apply",
      "x-tenant-id": tenantId,
      "x-target-service": "accounts-service",
    },
  });

  logger.info(
    { commandId, tenantId, paymentId, arAccountId, amount },
    "Dispatched ar.payment.apply after payment capture",
  );
};
