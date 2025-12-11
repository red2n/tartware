import type { EventMetadata } from "./metadata.js";
import { createEventMetadata } from "./metadata.js";

export interface DomainEvent<TPayload = Record<string, unknown>> {
  metadata: EventMetadata;
  payload: TPayload;
}

export interface BuildDomainEventOptions<TPayload> {
  type: string;
  payload: TPayload;
  source: string;
  tenantId: string;
  correlationId?: string;
  eventId?: string;
  version?: string;
  timestamp?: string | Date;
}

export const buildDomainEvent = <TPayload>(
  options: BuildDomainEventOptions<TPayload>,
): DomainEvent<TPayload> => ({
  metadata: createEventMetadata({
    id: options.eventId,
    source: options.source,
    type: options.type,
    tenantId: options.tenantId,
    correlationId: options.correlationId,
    version: options.version,
    timestamp: options.timestamp,
  }),
  payload: options.payload,
});
