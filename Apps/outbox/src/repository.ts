import type { PoolClient, QueryResultRow } from "pg";

import type {
	EnqueueOutboxRecordInput,
	OutboxRecord,
	OutboxRepository,
	OutboxRepositoryDeps,
	OutboxStatus,
} from "./types.js";

type SqlExecutor = Pick<PoolClient, "query">;

const insertOutboxRecord = async (
	executor: SqlExecutor,
	input: EnqueueOutboxRecordInput,
): Promise<void> => {
	await executor.query(
		`
        INSERT INTO transactional_outbox (
          event_id,
          tenant_id,
          aggregate_id,
          aggregate_type,
          event_type,
          payload,
          headers,
          priority,
          available_at,
          correlation_id,
          partition_key,
          metadata
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6::jsonb,
          $7::jsonb,
          $8,
          NOW(),
          $9,
          $10,
          $11::jsonb
        )
      `,
		[
			input.eventId,
			input.tenantId,
			input.aggregateId,
			input.aggregateType,
			input.eventType,
			JSON.stringify(input.payload),
			JSON.stringify(input.headers),
			input.priority ?? 0,
			input.correlationId ?? null,
			input.partitionKey ?? null,
			JSON.stringify({
				lifecycleState: "PERSISTED",
				...(input.metadata ?? {}),
			}),
		],
	);
};

export const createOutboxRepository = ({
	query,
	withTransaction,
}: OutboxRepositoryDeps): OutboxRepository => {
	const enqueueOutboxRecord = async (
		input: EnqueueOutboxRecordInput,
	): Promise<void> => {
		await insertOutboxRecord({ query } as SqlExecutor, input);
	};

	const enqueueOutboxRecordWithClient = async (
		client: PoolClient,
		input: EnqueueOutboxRecordInput,
	): Promise<void> => {
		await insertOutboxRecord(client, input);
	};

	const countPendingOutboxRows = async (): Promise<number> => {
		const result = await query<{ count: string }>(
			`
        SELECT COUNT(*)::text AS count
        FROM transactional_outbox
        WHERE status IN ('PENDING', 'FAILED')
      `,
		);
		return Number(result.rows[0]?.count ?? "0");
	};

	const releaseExpiredLocks = async (
		lockTimeoutMs: number,
	): Promise<number> => {
		const result = await query(
			`
        UPDATE transactional_outbox
        SET
          status = 'FAILED',
          locked_at = NULL,
          locked_by = NULL,
          updated_at = NOW(),
          available_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'lifecycleState',
            'FAILED',
            'lockReleasedAt',
            NOW()
          )
        WHERE status = 'IN_PROGRESS'
          AND locked_at < NOW() - ($1::int * interval '1 millisecond')
      `,
			[lockTimeoutMs],
		);
		return result.rowCount ?? 0;
	};

	const claimOutboxBatch = async (
		limit: number,
		workerId: string,
		aggregateTypeFilter?: string,
	): Promise<OutboxRecord[]> => {
		return withTransaction(async (client) => {
			const params: (string | number)[] = [limit, workerId];
			const aggregateFilter = aggregateTypeFilter
				? `AND aggregate_type = $${params.push(aggregateTypeFilter)}`
				: "";
			const result = await client.query(
				`
          WITH due AS (
            SELECT id
            FROM transactional_outbox
            WHERE status IN ('PENDING', 'FAILED')
              AND available_at <= NOW()
              ${aggregateFilter}
            ORDER BY priority DESC, available_at ASC
            FOR UPDATE SKIP LOCKED
            LIMIT $1
          )
          UPDATE transactional_outbox o
          SET
            status = 'IN_PROGRESS',
            locked_at = NOW(),
						locked_by = $2::text,
            retry_count = CASE
              WHEN o.status = 'FAILED' THEN o.retry_count + 1
              ELSE o.retry_count
            END,
            metadata = COALESCE(o.metadata, '{}'::jsonb) || jsonb_build_object(
              'lifecycleState',
              'IN_PROGRESS',
              'lockedAt',
              NOW(),
              'lockedBy',
							$2::text
            ),
            updated_at = NOW()
          FROM due
          WHERE o.id = due.id
          RETURNING o.*;
        `,
				params,
			);
			return result.rows.map(mapOutboxRow);
		});
	};

	const markOutboxDelivered = async (id: string): Promise<void> => {
		await query(
			`
        UPDATE transactional_outbox
        SET
          status = 'DELIVERED',
          delivered_at = NOW(),
          locked_at = NULL,
          locked_by = NULL,
          last_error = NULL,
          updated_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'lifecycleState',
            'PUBLISHED',
            'publishedAt',
            NOW()
          )
        WHERE id = $1
      `,
			[id],
		);
	};

	const markOutboxDeliveredByEventId = async (
		eventId: string,
	): Promise<void> => {
		await query(
			`
        UPDATE transactional_outbox
        SET
          status = 'DELIVERED',
          delivered_at = NOW(),
          locked_at = NULL,
          locked_by = NULL,
          last_error = NULL,
          updated_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'lifecycleState',
            'PUBLISHED',
            'publishedAt',
            NOW()
          )
        WHERE event_id = $1
      `,
			[eventId],
		);
	};

	const markOutboxFailed = async (
		id: string,
		error: unknown,
		retryBackoffMs: number,
		maxRetries: number,
	): Promise<OutboxStatus> => {
		const errorMessage =
			error instanceof Error
				? `${error.name}: ${error.message}`
				: String(error);

		const result = await query<{ status: OutboxStatus }>(
			`
        WITH updated AS (
          UPDATE transactional_outbox
          SET
            retry_count = retry_count + 1,
            status = CASE
              WHEN retry_count + 1 >= $3 THEN 'DLQ'
              ELSE 'FAILED'
            END,
            last_error = $2,
            locked_at = NULL,
            locked_by = NULL,
            available_at = CASE
              WHEN retry_count + 1 >= $3 THEN available_at
              ELSE NOW() + ($4::int * interval '1 millisecond')
            END,
            updated_at = NOW(),
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'lifecycleState',
              CASE
                WHEN retry_count + 1 >= $3 THEN 'DLQ'
                ELSE 'FAILED'
              END,
              'lastError',
              $2,
              'updatedAt',
              NOW()
            )
          WHERE id = $1
          RETURNING status
        )
        SELECT status FROM updated
      `,
			[id, errorMessage, maxRetries, retryBackoffMs],
		);

		return result.rows[0]?.status ?? "FAILED";
	};

	const markOutboxFailedByEventId = async (
		eventId: string,
		error: unknown,
		retryBackoffMs: number,
		maxRetries: number,
	): Promise<OutboxStatus> => {
		const errorMessage =
			error instanceof Error
				? `${error.name}: ${error.message}`
				: String(error);

		const result = await query<{ status: OutboxStatus }>(
			`
        WITH updated AS (
          UPDATE transactional_outbox
          SET
            retry_count = retry_count + 1,
            status = CASE
              WHEN retry_count + 1 >= $3 THEN 'DLQ'
              ELSE 'FAILED'
            END,
            last_error = $2,
            locked_at = NULL,
            locked_by = NULL,
            available_at = CASE
              WHEN retry_count + 1 >= $3 THEN available_at
              ELSE NOW() + ($4::int * interval '1 millisecond')
            END,
            updated_at = NOW(),
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
              'lifecycleState',
              CASE
                WHEN retry_count + 1 >= $3 THEN 'DLQ'
                ELSE 'FAILED'
              END,
              'lastError',
              $2,
              'updatedAt',
              NOW()
            )
          WHERE event_id = $1
          RETURNING status
        )
        SELECT status FROM updated
      `,
			[eventId, errorMessage, maxRetries, retryBackoffMs],
		);

		return result.rows[0]?.status ?? "FAILED";
	};

	return {
		enqueueOutboxRecord,
		enqueueOutboxRecordWithClient,
		countPendingOutboxRows,
		releaseExpiredLocks,
		claimOutboxBatch,
		markOutboxDelivered,
		markOutboxDeliveredByEventId,
		markOutboxFailed,
		markOutboxFailedByEventId,
	};
};

const mapOutboxRow = (row: QueryResultRow): OutboxRecord => ({
	id: row.id?.toString(),
	eventId: row.event_id,
	tenantId: row.tenant_id,
	aggregateId: row.aggregate_id,
	aggregateType: row.aggregate_type,
	eventType: row.event_type,
	payload: coerceObject(row.payload),
	headers: coerceStringRecord(row.headers),
	priority: Number(row.priority ?? 0),
	availableAt: row.available_at,
	retryCount: Number(row.retry_count ?? 0),
	correlationId: row.correlation_id,
	partitionKey: row.partition_key,
	metadata: coerceObject(row.metadata),
});

const coerceObject = (value: unknown): Record<string, unknown> => {
	if (typeof value === "object" && value !== null) {
		return value as Record<string, unknown>;
	}
	if (typeof value === "string") {
		try {
			return JSON.parse(value) as Record<string, unknown>;
		} catch {
			return {};
		}
	}
	return {};
};

const coerceStringRecord = (value: unknown): Record<string, string> => {
	const result: Record<string, string> = {};
	const source = coerceObject(value);
	for (const [key, entryValue] of Object.entries(source)) {
		if (entryValue !== undefined && entryValue !== null) {
			result[key] = String(entryValue);
		}
	}
	return result;
};
