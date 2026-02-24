import { Kafka, logLevel as KafkaLogLevel, type Producer, type RecordMetadata } from "kafkajs";

export type KafkaClientConfig = {
  clientId: string;
  brokers: string[];
  logLevel?: "NOTHING" | "WARN" | "ERROR" | "INFO" | "DEBUG";
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
 */
export const createKafkaClient = (config: KafkaClientConfig): Kafka =>
  new Kafka({
    clientId: config.clientId,
    brokers: config.brokers,
    logLevel: LOG_LEVEL_MAP[config.logLevel ?? "NOTHING"] ?? KafkaLogLevel.NOTHING,
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
 * const kafka = createKafkaClient({ clientId: "my-svc", brokers: config.kafka.brokers });
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

  return { publishEvent, publishDlqEvent, shutdown };
};
