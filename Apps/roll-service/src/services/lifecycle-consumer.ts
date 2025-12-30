import { performance } from "node:perf_hooks";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  type ReservationEvent,
  ReservationEventSchema,
} from "@tartware/schemas";
import type { FastifyBaseLogger } from "fastify";
import { type Consumer, type EachBatchPayload, Kafka, logLevel } from "kafkajs";

import { config } from "../config.js";
import {
  batchDurationHistogram,
  consumerEventTimestampGauge,
  consumerOffsetGauge,
  consumerTimestampDriftGauge,
  lifecycleBatchFailuresCounter,
  lifecycleEventDurationHistogram,
  lifecycleEventsCounter,
  processingLagGauge,
  recordReplayDrift,
} from "../lib/metrics.js";
import { upsertConsumerOffset } from "../repositories/consumer-offset-repository.js";
import { upsertRollLedgerEntry } from "../repositories/ledger-repository.js";

import { buildLedgerEntryFromReservationEvent } from "./roll-ledger-builder.js";

const tracer = trace.getTracer("roll-service");

type LifecycleEventResult =
  | "processed"
  | "skipped"
  | "parse_error"
  | "db_error";

const buildKafkaClient = () =>
  new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    logLevel: logLevel.NOTHING,
  });

export const buildLifecycleConsumer = (logger: FastifyBaseLogger) =>
  new RollLifecycleConsumer(logger);

class RollLifecycleConsumer {
  private readonly logger: FastifyBaseLogger;
  private readonly kafka: Kafka;
  private consumer: Consumer | null = null;
  private running = false;

  constructor(logger: FastifyBaseLogger) {
    this.logger = logger.child({ component: "roll-lifecycle-consumer" });
    this.kafka = buildKafkaClient();
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.consumer = this.kafka.consumer({
      groupId: config.kafka.consumerGroupId,
      allowAutoTopicCreation: false,
      maxBytesPerPartition: config.kafka.maxBatchBytes,
    });

    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: config.kafka.topic,
      fromBeginning: false,
    });

    await this.consumer.run({
      autoCommit: false,
      eachBatchAutoResolve: false,
      eachBatch: (payload) => this.handleBatch(payload),
    });

    this.running = true;
    this.logger.info(
      { topic: config.kafka.topic, groupId: config.kafka.consumerGroupId },
      "Roll lifecycle consumer started",
    );
  }

  async stop(): Promise<void> {
    if (!this.consumer) {
      return;
    }

    await this.consumer.disconnect();
    this.consumer = null;
    this.running = false;
  }

  private async handleBatch(payload: EachBatchPayload): Promise<void> {
    await tracer.startActiveSpan("roll.lifecycle.batch", async (span) => {
      const batchStartedAt = performance.now();
      try {
        if (!payload.isRunning() || payload.isStale()) {
          return;
        }

        const { batch } = payload;
        span.setAttributes({
          "messaging.system": "kafka",
          "messaging.destination": batch.topic,
          "messaging.destination_partition": batch.partition,
          "roll.kafka.batch.size": batch.messages.length,
        });

        let shouldStopBatch = false;

        for (const message of batch.messages) {
          if (!payload.isRunning() || payload.isStale()) {
            break;
          }

          await tracer.startActiveSpan(
            "roll.lifecycle.event",
            async (eventSpan) => {
              const eventStartedAt = performance.now();
              let result: LifecycleEventResult = "processed";
              try {
                eventSpan.setAttributes({
                  "messaging.kafka.partition": batch.partition,
                  "messaging.kafka.offset": message.offset,
                  "messaging.destination": batch.topic,
                });

                if (!message.value) {
                  result = "skipped";
                  this.logger.warn(
                    { partition: batch.partition, offset: message.offset },
                    "Skipping Kafka message with empty value",
                  );
                  payload.resolveOffset(message.offset);
                  await payload.heartbeat();
                  return;
                }

                const rawValue = message.value.toString();
                let event: ReservationEvent;

                try {
                  event = this.parseReservationEvent(rawValue);
                } catch (error) {
                  result = "parse_error";
                  eventSpan.recordException(error as Error);
                  eventSpan.setStatus({
                    code: SpanStatusCode.ERROR,
                    message:
                      error instanceof Error ? error.message : "parse_error",
                  });
                  this.logger.error(
                    { err: error, offset: message.offset },
                    "Failed to parse reservation event; skipping",
                  );
                  payload.resolveOffset(message.offset);
                  await payload.heartbeat();
                  return;
                }

                try {
                  const ledgerEntry =
                    buildLedgerEntryFromReservationEvent(event);
                  const driftStatus = await upsertRollLedgerEntry(ledgerEntry);
                  recordReplayDrift(driftStatus);
                  await this.persistConsumerOffset({
                    batch,
                    messageOffset: message.offset,
                    event,
                  });
                } catch (error) {
                  result = "db_error";
                  shouldStopBatch = true;
                  eventSpan.recordException(error as Error);
                  eventSpan.setStatus({
                    code: SpanStatusCode.ERROR,
                    message:
                      error instanceof Error ? error.message : "db_error",
                  });
                  this.logger.error(
                    {
                      err: error,
                      offset: message.offset,
                      eventId: event?.metadata.id,
                    },
                    "Failed to persist roll ledger entry",
                  );
                  return;
                }

                payload.resolveOffset(message.offset);
                await payload.heartbeat();
                this.updateLagMetric(batch, message.timestamp);
              } finally {
                lifecycleEventsCounter.labels(result).inc();
                const durationSeconds =
                  (performance.now() - eventStartedAt) / 1000;
                lifecycleEventDurationHistogram.observe(durationSeconds);
                eventSpan.end();
              }
            },
          );

          if (shouldStopBatch) {
            break;
          }
        }

        await payload.commitOffsetsIfNecessary();
      } catch (error) {
        lifecycleBatchFailuresCounter.inc();
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : "batch_error",
        });
        throw error;
      } finally {
        const durationSeconds = (performance.now() - batchStartedAt) / 1000;
        batchDurationHistogram.observe(durationSeconds);
        span.end();
      }
    });
  }

  private parseReservationEvent(rawValue: string): ReservationEvent {
    const parsedJson: unknown = JSON.parse(rawValue);
    const result = ReservationEventSchema.safeParse(parsedJson);
    if (!result.success) {
      throw result.error;
    }
    return result.data;
  }

  private async persistConsumerOffset({
    batch,
    messageOffset,
    event,
  }: {
    batch: EachBatchPayload["batch"];
    messageOffset: string;
    event: ReservationEvent;
  }): Promise<void> {
    const labels = {
      topic: batch.topic,
      partition: batch.partition.toString(),
    };

    const offsetValue = Number(messageOffset);
    if (Number.isFinite(offsetValue)) {
      consumerOffsetGauge
        .labels(labels.topic, labels.partition)
        .set(offsetValue);
    }

    const eventTimestamp = Date.parse(event.metadata.timestamp);
    if (!Number.isNaN(eventTimestamp)) {
      consumerEventTimestampGauge
        .labels(labels.topic, labels.partition)
        .set(eventTimestamp / 1000);
      const driftSeconds = Math.max(0, (Date.now() - eventTimestamp) / 1000);
      consumerTimestampDriftGauge
        .labels(labels.topic, labels.partition)
        .set(driftSeconds);
    }

    await upsertConsumerOffset({
      consumerGroup: config.kafka.consumerGroupId,
      topic: batch.topic,
      partition: batch.partition,
      offset: messageOffset,
      highWatermark: batch.highWatermark,
      eventId: event.metadata.id,
      eventCreatedAt: Number.isNaN(eventTimestamp)
        ? undefined
        : new Date(eventTimestamp),
    });
  }

  private updateLagMetric(
    batch: EachBatchPayload["batch"],
    timestamp?: string,
  ): void {
    if (!timestamp) {
      return;
    }
    const parsed = Number(timestamp);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const lagSeconds = Math.max(0, (Date.now() - parsed) / 1000);
    processingLagGauge
      .labels(batch.topic, batch.partition.toString())
      .set(lagSeconds);
  }
}
