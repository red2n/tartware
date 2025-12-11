import type { DomainEvent } from "./event-builder.js";

export interface KafkaEventRecord {
  topic: string;
  key: string;
  value: string;
  headers?: Record<string, string>;
}

export interface CreateKafkaEventRecordOptions<TPayload> {
  event: DomainEvent<TPayload>;
  topic: string;
  partitionKey: string;
  headers?: Record<string, string>;
}

export const createKafkaEventRecord = <TPayload>({
  event,
  topic,
  partitionKey,
  headers,
}: CreateKafkaEventRecordOptions<TPayload>): KafkaEventRecord => ({
  topic,
  key: partitionKey,
  value: JSON.stringify(event),
  headers,
});
