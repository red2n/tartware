import type { PoolClient, QueryResult, QueryResultRow } from "pg";

export type QueryFn = <T extends QueryResultRow = QueryResultRow>(
	text: string,
	params?: unknown[],
) => Promise<QueryResult<T>>;

export type WithTransactionFn = <T>(
	callback: (client: PoolClient) => Promise<T>,
) => Promise<T>;

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

export type OutboxRepository = {
	enqueueOutboxRecord: (input: EnqueueOutboxRecordInput) => Promise<void>;
	enqueueOutboxRecordWithClient: (
		client: PoolClient,
		input: EnqueueOutboxRecordInput,
	) => Promise<void>;
	countPendingOutboxRows: () => Promise<number>;
	releaseExpiredLocks: (lockTimeoutMs: number) => Promise<number>;
	claimOutboxBatch: (
		limit: number,
		workerId: string,
		aggregateTypeFilter?: string,
	) => Promise<OutboxRecord[]>;
	markOutboxDelivered: (id: string) => Promise<void>;
	markOutboxDeliveredByEventId: (eventId: string) => Promise<void>;
	markOutboxFailed: (
		id: string,
		error: unknown,
		retryBackoffMs: number,
		maxRetries: number,
	) => Promise<OutboxStatus>;
	markOutboxFailedByEventId: (
		eventId: string,
		error: unknown,
		retryBackoffMs: number,
		maxRetries: number,
	) => Promise<OutboxStatus>;
};

export type OutboxRepositoryDeps = {
	query: QueryFn;
	withTransaction: WithTransactionFn;
};
