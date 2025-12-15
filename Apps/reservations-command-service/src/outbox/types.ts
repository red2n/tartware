/**
 * Canonical record fetched from the transactional outbox.
 */
export type OutboxRecord = {
  id: string;
  eventId: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  priority: number;
  availableAt: Date;
  retryCount: number;
  correlationId?: string | null;
  partitionKey?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Input for enqueuing a new outbox record.
 */
export type EnqueueOutboxRecordInput = {
  eventId: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  correlationId?: string;
  partitionKey?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
};

export type OutboxStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "FAILED"
  | "DLQ";
