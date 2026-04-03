/**
 * DEV DOC
 * Module: api/roll.ts
 * Purpose: Roll-service repository input/row types and domain value types
 * Ownership: Schema package
 */

// =====================================================
// CHECKPOINT REPOSITORY TYPES
// =====================================================

/** DB row shape for the backfill checkpoint record. */
export type CheckpointRow = {
	tenant_id: string;
	last_event_id: string | null;
	last_event_created_at: Date | null;
};

/** Input for upserting a backfill checkpoint record. */
export type BackfillCheckpointInput = {
	tenantId: string;
	lastEventId: string;
	lastEventCreatedAt: Date;
};

// =====================================================
// CONSUMER OFFSET REPOSITORY TYPES
// =====================================================

/** Input for upserting a Kafka consumer offset record. */
export type UpsertConsumerOffsetInput = {
	consumerGroup: string;
	topic: string;
	partition: number;
	offset: bigint | number | string;
	highWatermark?: bigint | number | string;
	eventId?: string;
	eventCreatedAt?: Date;
	tenantId: string;
};

// =====================================================
// LEDGER REPOSITORY TYPES
// =====================================================

/** DB row shape for the shadow ledger table. */
export type ShadowLedgerRow = {
	ledger_id: string;
	tenant_id: string;
	reservation_id: string | null;
	lifecycle_event_id: string;
	roll_type: string;
	roll_date: string;
	occurred_at: string;
	source_event_type: string;
	event_payload: Record<string, unknown> | null;
};

// =============================================================================
// ROLL SERVICE — domain and service-layer types
// =============================================================================

/** Computation type for a roll ledger entry. */
export type RollComputationType = "EOD" | "CHECKOUT" | "CANCEL" | "UNKNOWN";

/** Service-layer shape for a roll ledger entry (camelCase, hydrated from DB row). */
export type RollLedgerEntry = {
	tenantId: string;
	reservationId?: string;
	lifecycleEventId: string;
	rollType: RollComputationType;
	rollDate: string;
	occurredAt: Date;
	sourceEventType: string;
	payload: Record<string, unknown>;
};

/** Service-layer shape for a computed shadow ledger entry. */
export type ShadowLedgerEntry = {
	ledgerId: string;
	tenantId: string;
	reservationId?: string;
	lifecycleEventId: string;
	rollType: string;
	rollDate: string;
	occurredAt: Date;
	sourceEventType: string;
	payload: Record<string, unknown>;
};

/** Raw DB row read by the roll ledger builder to construct ledger entries. */
export type LifecycleRow = {
	event_id: string;
	tenant_id: string;
	reservation_id: string | null;
	command_name: string;
	current_state: string;
	metadata: Record<string, unknown> | null;
	created_at: Date;
};

/** In-memory backfill checkpoint showing progress per tenant. */
export type BackfillCheckpoint = {
	tenantId: string;
	lastEventId: string | null;
	lastEventCreatedAt: Date | null;
};

/** Drift detection outcome for roll replay validation. */
export type ReplayDriftStatus = "match" | "mismatch" | "missing";

/** Snapshot of the date-roll scheduler state, returned by health/status endpoints. */
export type SchedulerStatus = {
	enabled: boolean;
	running: boolean;
	lastCheckAt: string | null;
	scheduledProperties: {
		tenantId: string;
		propertyId: string;
		propertyName: string;
		autoRollTime: string;
		lastAuditDate: string | null;
		currentBusinessDate: string | null;
		dateStatus: string | null;
	}[];
	lastDispatchResults: {
		propertyId: string;
		propertyName: string;
		dispatchedAt: string;
		success: boolean;
		error?: string;
	}[];
};
