import type { QueryResult, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

type QueryExecutor = {
  query: <TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[],
  ) => Promise<QueryResult<TRow>>;
};

const runQuery = async (
  text: string,
  params: unknown[],
  client?: QueryExecutor,
) => {
  if (client) {
    return client.query(text, params);
  }
  return query(text, params);
};

type UpsertConsumerOffsetInput = {
  consumerGroup: string;
  topic: string;
  partition: number;
  offset: bigint | number | string;
  highWatermark?: bigint | number | string;
  eventId?: string;
  eventCreatedAt?: Date;
};

export const upsertConsumerOffset = async (
  input: UpsertConsumerOffsetInput,
  client?: QueryExecutor,
): Promise<void> => {
  await runQuery(
    `
      INSERT INTO roll_service_consumer_offsets (
        consumer_group,
        topic,
        partition,
        offset,
        high_watermark,
        last_event_id,
        last_event_created_at,
        updated_at
      ) VALUES (
        $1,
        $2,
        $3,
        $4::bigint,
        $5::bigint,
        $6::uuid,
        $7::timestamptz,
        NOW()
      )
      ON CONFLICT (consumer_group, topic, partition) DO UPDATE
      SET
        offset = EXCLUDED.offset,
        high_watermark = EXCLUDED.high_watermark,
        last_event_id = EXCLUDED.last_event_id,
        last_event_created_at = EXCLUDED.last_event_created_at,
        updated_at = NOW()
    `,
    [
      input.consumerGroup,
      input.topic,
      input.partition,
      input.offset,
      input.highWatermark ?? null,
      input.eventId ?? null,
      input.eventCreatedAt?.toISOString() ?? null,
    ],
    client,
  );
};
