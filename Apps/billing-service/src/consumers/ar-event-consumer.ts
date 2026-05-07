/**
 * AR Events Consumer — listens to reservation events and triggers AR commands.
 *
 * Integration points (from ara_implementation_plan.md):
 *   - reservation.checked_out → ar.city_ledger.transfer (if direct-bill routing exists)
 *   - billing.payment.captured → ar.payment.apply (if payment linked to AR account)
 *
 * Uses a SEPARATE consumer group from the roll-lifecycle-consumer so both
 * receive all events independently (fan-out pattern).
 *
 * @module consumers/ar-event-consumer
 */
import { randomUUID } from "node:crypto";

import { enterTenantScope } from "@tartware/config/db";
import { ReservationEventSchema } from "@tartware/schemas";
import type { Consumer, EachMessagePayload } from "kafkajs";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishEvent } from "../kafka/producer.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "ar-event-consumer" });

let consumer: Consumer | null = null;

/**
 * Detect if a checkout event has a direct-bill folio routing rule linked to an AR account.
 * Returns the AR account ID and folio ID if a city ledger transfer should be triggered.
 */
const findDirectBillRouting = async (
  tenantId: string,
  reservationId: string,
): Promise<{
  arAccountId: string;
  folioId: string;
  propertyId: string;
  outstandingBalance: number;
} | null> => {
  const result = await query<{
    ar_account_id: string;
    folio_id: string;
    property_id: string;
    balance: string;
  }>(
    `SELECT
       frr.target_account_id AS ar_account_id,
       f.folio_id,
       f.property_id,
       COALESCE(f.balance, 0) AS balance
     FROM public.folio_routing_rules frr
     JOIN public.folios f ON f.folio_id = frr.source_folio_id AND f.tenant_id = $1::uuid
     WHERE frr.tenant_id = $1::uuid
       AND frr.routing_type = 'DIRECT_BILL'
       AND frr.target_account_id IS NOT NULL
       AND f.reservation_id = $2::uuid
       AND COALESCE(f.is_deleted, false) = false
       AND COALESCE(f.balance, 0) > 0
     LIMIT 1`,
    [tenantId, reservationId],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  if (!row) return null;
  return {
    arAccountId: row.ar_account_id,
    folioId: row.folio_id,
    propertyId: row.property_id,
    outstandingBalance: Number.parseFloat(row.balance),
  };
};

/**
 * Dispatch a command to the commands.primary topic for async processing.
 */
const dispatchCommand = async (
  commandName: string,
  tenantId: string,
  payload: Record<string, unknown>,
): Promise<void> => {
  const commandId = randomUUID();
  const envelope = {
    id: commandId,
    command_name: commandName,
    payload,
    metadata: {
      commandName,
      tenantId,
      initiatedBy: "system:ar-event-consumer",
      correlationId: randomUUID(),
      timestamp: new Date().toISOString(),
      targetService: "accounts-service",
      idempotencyKey: `${commandName}:${payload.idempotency_key ?? commandId}`,
    },
  };

  await publishEvent({
    key: tenantId,
    value: JSON.stringify(envelope),
    topic: config.arEvents.commandTopic,
    headers: {
      "x-command-name": commandName,
      "x-tenant-id": tenantId,
      "x-target-service": "accounts-service",
    },
  });

  logger.info({ commandName, commandId, tenantId }, "Dispatched AR command from event consumer");
};

/**
 * Classify a reservation.updated event. Returns the sub-type or null if not relevant.
 */
const classifyEvent = (payload: Record<string, unknown>): string | null => {
  if (payload.status === "CHECKED_OUT" && payload.actual_check_out) {
    return "reservation.checked_out";
  }
  return null;
};

/**
 * Process a single reservation event for AR integration.
 */
const processEvent = async (rawValue: string): Promise<void> => {
  let event: ReturnType<typeof ReservationEventSchema.parse>;
  try {
    event = ReservationEventSchema.parse(JSON.parse(rawValue));
  } catch {
    logger.debug("Skipping unparseable event");
    return;
  }

  const tenantId = event.metadata.tenantId;
  if (!tenantId) return;

  enterTenantScope(tenantId);

  // Handle reservation.updated events
  if (event.metadata.type === "reservation.updated") {
    const classified = classifyEvent(event.payload as Record<string, unknown>);

    if (classified === "reservation.checked_out") {
      const reservationId = (event.payload as Record<string, unknown>).reservation_id as string;
      if (!reservationId) return;

      // Check if this reservation has a direct-bill folio routing to an AR account
      const routing = await findDirectBillRouting(tenantId, reservationId);
      if (!routing) return;

      logger.info(
        {
          reservationId,
          arAccountId: routing.arAccountId,
          folioId: routing.folioId,
          balance: routing.outstandingBalance,
        },
        "Checkout detected with direct-bill routing — dispatching city ledger transfer",
      );

      await dispatchCommand("ar.city_ledger.transfer", tenantId, {
        ar_account_id: routing.arAccountId,
        folio_id: routing.folioId,
        property_id: routing.propertyId,
        amount: routing.outstandingBalance,
        transfer_reason: "AUTO_CHECKOUT_DIRECT_BILL",
        idempotency_key: `checkout-transfer:${routing.folioId}:${reservationId}`,
      });
    }
  }
};

export const startArEventConsumer = async (): Promise<void> => {
  if (!config.arEvents.consumerEnabled) {
    logger.info("AR event consumer disabled by config");
    return;
  }
  if (consumer) return;

  consumer = kafka.consumer({
    groupId: config.arEvents.consumerGroupId,
    allowAutoTopicCreation: false,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: config.arEvents.topic, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) return;

      try {
        await processEvent(message.value.toString());
      } catch (err) {
        logger.error({ err, offset: message.offset }, "AR event consumer: failed to process event");
        // Non-fatal — commit offset and continue. Failed transfers can be retried manually.
      }
    },
  });

  logger.info(
    { topic: config.arEvents.topic, groupId: config.arEvents.consumerGroupId },
    "AR event consumer started",
  );
};

export const shutdownArEventConsumer = async (): Promise<void> => {
  if (!consumer) return;
  await consumer.disconnect();
  consumer = null;
  logger.info("AR event consumer stopped");
};
