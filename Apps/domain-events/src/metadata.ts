import { randomUUID } from "node:crypto";

import { z } from "zod";

export const EventMetadataSchema = z.object({
  id: z.string().uuid(),
  source: z.string().min(1),
  type: z.string().min(1),
  timestamp: z.string().datetime(),
  version: z.string().min(1),
  correlationId: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
});

export type EventMetadata = z.infer<typeof EventMetadataSchema>;

export interface CreateEventMetadataInput {
  id?: string;
  source: string;
  type: string;
  tenantId: string;
  correlationId?: string;
  version?: string;
  timestamp?: string | Date;
}

export const createEventMetadata = (input: CreateEventMetadataInput): EventMetadata => {
  const timestamp =
    typeof input.timestamp === "string" ? input.timestamp : input.timestamp?.toISOString();

  return EventMetadataSchema.parse({
    id: input.id ?? randomUUID(),
    source: input.source,
    type: input.type,
    tenantId: input.tenantId,
    version: input.version ?? "1.0",
    correlationId: input.correlationId,
    timestamp: timestamp ?? new Date().toISOString(),
  });
};
