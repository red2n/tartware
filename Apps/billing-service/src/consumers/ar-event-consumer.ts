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
import { buildDlqPayload } from "@tartware/command-consumer-utils/dlq";
import { createKafkaProducer } from "@tartware/command-consumer-utils/producer";
import { enterTenantScope } from "@tartware/config/db";
import { processWithRetry } from "@tartware/config/retry";
import { ReservationEventSchema } from "@tartware/schemas";
import type { Consumer } from "kafkajs";
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { z } from "zod";

import { config } from "../config.js";
import { kafka } from "../kafka/client.js";
import { publishEvent } from "../kafka/producer.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { observeCommandDuration, recordCommandOutcome, recordDlqEvent } from "../lib/metrics.js";
import { hashIdentifier, recordAuditLog } from "../utils/audit.js";

const logger = appLogger.child({ module: "ar-event-consumer" });

let consumer: Consumer | null = null;
let dlqProducer: ReturnType<typeof createKafkaProducer> | null = null;

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
const processEvent = async (event: z.infer<typeof ReservationEventSchema>): Promise<void> => {
  const tenantId = event.metadata.tenantId;
  if (!tenantId) return;

  enterTenantScope(tenantId);

  // Handle reservation.updated events
  if (event.metadata.type === "reservation.updated") {
    const payload = event.payload as any;
    const classified = classifyEvent(payload);

    if (classified === "reservation.checked_out") {
      const reservationId = payload.id as string;
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

      await recordAuditLog({
        tenantId,
        propertyId: routing.propertyId,
        actorId: null,
        action: "ar.city_ledger.transfer_on_checkout",
        eventType: "UPDATE",
        entityType: "ar_account",
        entityId: hashIdentifier(routing.arAccountId),
        metadata: {
          reservation_id: reservationId,
          folio_id: routing.folioId,
          amount: routing.outstandingBalance,
          triggered_by: "reservation.checked_out",
        },
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

  // Initialize DLQ producer
  dlqProducer = createKafkaProducer(kafka, {
    commandTopic: config.commandCenter.topic,
    dlqTopic: config.arEvents.dlqTopic,
  });

  consumer = kafka.consumer({
    groupId: config.arEvents.consumerGroupId,
    allowAutoTopicCreation: false,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: config.arEvents.topic, fromBeginning: false });

  await consumer.run({
    eachBatchAutoResolve: false,
    eachBatch: async ({
      batch,
      resolveOffset,
      heartbeat,
      commitOffsetsIfNecessary,
      isRunning,
      isStale,
    }) => {
      for (const message of batch.messages) {
        if (!isRunning() || isStale()) break;

        if (!message.value) {
          resolveOffset(message.offset);
          continue;
        }

        const startTime = Date.now();
        const rawValue = message.value.toString();
        let event: z.infer<typeof ReservationEventSchema> | null = null;

        try {
          event = ReservationEventSchema.parse(JSON.parse(rawValue));
        } catch (err) {
          logger.warn({ err, offset: message.offset }, "Skipping malformed reservation event");
          resolveOffset(message.offset);
          continue;
        }

        const eventType = event.metadata.type;

        try {
          await processWithRetry(async () => processEvent(event!), {
            maxRetries: 5,
            baseDelayMs: 1000,
            delayScheduleMs: [1000, 2000, 5000, 10000, 20000],
            onRetry: (ctx) => {
              logger.warn(
                {
                  attempt: ctx.attempt,
                  delayMs: ctx.delayMs,
                  err: ctx.error,
                  reservationId: (event?.payload as any)?.reservation_id,
                },
                "AR event consumer retry triggered",
              );
            },
            isRetryable: (err: any) => {
              const code = String(err.code || "");
              return (
                code.startsWith("08") ||
                code === "40001" ||
                code === "57P01" ||
                err.message?.includes("deadlock") ||
                err.message?.includes("ECONNREFUSED")
              );
            },
          });

          const durationSeconds = (Date.now() - startTime) / 1000;
          observeCommandDuration(eventType, durationSeconds);
          recordCommandOutcome(eventType, "success");
        } catch (err: any) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          observeCommandDuration(eventType, durationSeconds);
          recordCommandOutcome(eventType, "handler_error");
          recordDlqEvent(err instanceof Error ? err.message : String(err));

          logger.error(
            { err, offset: message.offset, reservationId: (event?.payload as any)?.reservation_id },
            "AR event consumer: failed to process event after retries. Routing to DLQ.",
          );

          try {
            const dlqPayload = buildDlqPayload({
              rawValue,
              topic: batch.topic,
              partition: batch.partition,
              offset: message.offset,
              attempts: 6,
              failureReason: "HANDLER_FAILURE",
              error: err,
              envelope: event as any,
            });

            await dlqProducer?.publishDlqEvent({
              key: event?.metadata.tenantId || "unknown",
              value: JSON.stringify(dlqPayload),
            });
            recordDlqEvent(err instanceof Error ? err.message : String(err));
          } catch (dlqErr) {
            logger.error({ err: dlqErr }, "Failed to publish to AR DLQ");
          }
        } finally {
          resolveOffset(message.offset);
          await heartbeat();
        }
      }

      await commitOffsetsIfNecessary();
    },
  });

  // Track consumer lag
  consumer.on(consumer.events.GROUP_JOIN, () => {
    logger.info("AR consumer joined group");
  });

  // Periodically report lag (best effort)
  setInterval(async () => {
    if (consumer) {
      try {
        const description = await consumer.describeGroup();
        for (const member of description.members) {
          logger.trace({ memberId: member.memberId }, "Reporting lag for consumer member");
        }
      } catch (_err) {
        // Ignore lag reporting errors
      }
    }
  }, 30_000);

  logger.info(
    {
      topic: config.arEvents.topic,
      groupId: config.arEvents.consumerGroupId,
      dlqTopic: config.arEvents.dlqTopic,
    },
    "AR event consumer started",
  );
};

export const shutdownArEventConsumer = async (): Promise<void> => {
  if (!consumer) return;
  try {
    await dlqProducer?.shutdown();
    await consumer.disconnect();
    logger.info("AR event consumer stopped");
  } finally {
    consumer = null;
    dlqProducer = null;
  }
};
