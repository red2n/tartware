import { query } from "./db.js";

/**
 * Payload required to upsert a reservation event offset entry.
 */
type UpsertReservationEventOffsetInput = {
  tenantId: string;
  consumerGroup: string;
  topic: string;
  partition: number;
  offset: string;
  eventId?: string;
  reservationId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Persists the highest processed offset per topic/partition so that stateless
 * Kubernetes deployments can safely resume consumption without duplicating work.
 *
 * Uses an UPSERT to keep the latest offset and contextual metadata.
 */
export const upsertReservationEventOffset = async (
  input: UpsertReservationEventOffsetInput,
): Promise<void> => {
  await query(
    `
      INSERT INTO reservation_event_offsets (
        tenant_id,
        consumer_group,
        topic,
        partition,
        last_processed_offset,
        last_event_id,
        reservation_id,
        correlation_id,
        metadata,
        processed_at,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9::jsonb,
        NOW(), NOW(), NOW()
      )
      ON CONFLICT (consumer_group, topic, partition)
      DO UPDATE SET
        last_processed_offset = EXCLUDED.last_processed_offset,
        last_event_id = EXCLUDED.last_event_id,
        reservation_id = EXCLUDED.reservation_id,
        correlation_id = EXCLUDED.correlation_id,
        metadata = reservation_event_offsets.metadata || EXCLUDED.metadata,
        processed_at = NOW(),
        updated_at = NOW();
    `,
    [
      input.tenantId,
      input.consumerGroup,
      input.topic,
      input.partition,
      BigInt(input.offset),
      input.eventId ?? null,
      input.reservationId ?? null,
      input.correlationId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
};
