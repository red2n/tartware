import { createKafkaLogCreator, type KafkaBridgeLogger } from "@tartware/telemetry";
import { Kafka, logLevel as KafkaLogLevel, type Producer, type RecordMetadata } from "kafkajs";

export type KafkaClientConfig = {
  clientId: string;
  brokers: string[];
  /**
   * Service logger. KafkaJS' own broker/consumer/producer logs are routed
   * through it, so they carry the service formatting, redaction and OTLP
   * export instead of KafkaJS printing raw JSON to stdout. Required — a client
   * built without one is how unformatted log lines get into the output.
   */
  logger: KafkaBridgeLogger;
  /** How much KafkaJS itself logs. Defaults to `NOTHING` (client logs suppressed). */
  logLevel?: "NOTHING" | "WARN" | "ERROR" | "INFO" | "DEBUG";
  /** `component` binding on KafkaJS log records. Defaults to `kafkajs`. */
  component?: string;
};

export type KafkaProducerConfig = {
  commandTopic: string;
  dlqTopic: string;
};

const LOG_LEVEL_MAP: Record<string, number> = {
  NOTHING: KafkaLogLevel.NOTHING,
  WARN: KafkaLogLevel.WARN,
  ERROR: KafkaLogLevel.ERROR,
  INFO: KafkaLogLevel.INFO,
  DEBUG: KafkaLogLevel.DEBUG,
};

/**
 * Create a KafkaJS client from shared config.
 *
 * This is the only supported way to build a Kafka client in this monorepo:
 * it guarantees every client shares the same log routing and level handling.
 * `scripts/check-shared-framework-usage.mjs` fails the build on a raw
 * `new Kafka(...)` elsewhere.
 */
export const createKafkaClient = (config: KafkaClientConfig): Kafka =>
  new Kafka({
    clientId: config.clientId,
    brokers: config.brokers,
    logLevel: LOG_LEVEL_MAP[config.logLevel ?? "NOTHING"] ?? KafkaLogLevel.NOTHING,
    logCreator: createKafkaLogCreator(config.logger, { component: config.component }),
  });

export type KafkaEventMessage = {
  key: string;
  value: string;
  headers?: Record<string, string>;
  topic?: string;
};

/**
 * Create a lazily-initialized producer with `publishEvent`, `publishDlqEvent`,
 * and `shutdown` helpers.
 *
 * @example
 * ```ts
 * import { createKafkaClient, createKafkaProducer } from "@tartware/command-consumer-utils/producer";
 *
 * const kafka = createKafkaClient({
 *   clientId: "my-svc",
 *   brokers: config.kafka.brokers,
 *   logger: appLogger,
 * });
 * const { publishEvent, publishDlqEvent, shutdown } = createKafkaProducer(kafka, {
 *   commandTopic: config.commandCenter.topic,
 *   dlqTopic: config.commandCenter.dlqTopic,
 * });
 * ```
 */
export const createKafkaProducer = (kafka: Kafka, producerConfig: KafkaProducerConfig) => {
  let producer: Producer | null = null;

  const getProducer = async (): Promise<Producer> => {
    if (producer) {
      return producer;
    }
    producer = kafka.producer();
    await producer.connect();
    return producer;
  };

  const publishEvent = async (message: KafkaEventMessage): Promise<RecordMetadata[]> => {
    const p = await getProducer();
    return p.send({
      topic: message.topic ?? producerConfig.commandTopic,
      messages: [
        {
          key: message.key,
          value: message.value,
          headers: message.headers,
        },
      ],
    });
  };

  /**
   * Publish many records — across however many topics — in one broker request.
   *
   * `publishEvent` awaits an acknowledgement per call, so draining a claimed
   * outbox batch one row at a time serialises the whole dispatcher behind a
   * round trip per record. Measured, that is the difference between ~7 rows/sec
   * and ~2,000. `sendBatch` pays the latency once for the entire batch.
   */
  const publishBatch = async (
    topicMessages: Array<{
      topic: string;
      messages: Array<{
        key: string;
        value: string;
        headers?: Record<string, string>;
      }>;
    }>,
  ): Promise<void> => {
    if (topicMessages.length === 0) {
      return;
    }
    const p = await getProducer();
    await p.sendBatch({ topicMessages });
  };

  const publishDlqEvent = async (
    message: Omit<KafkaEventMessage, "topic">,
  ): Promise<RecordMetadata[]> =>
    publishEvent({
      ...message,
      topic: producerConfig.dlqTopic,
    });

  const shutdown = async (): Promise<void> => {
    if (producer) {
      await producer.disconnect();
      producer = null;
    }
  };

  return { publishEvent, publishBatch, publishDlqEvent, shutdown };
};
