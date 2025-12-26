import type { CommandDispatchStatus } from "@tartware/schemas";
import type { QueryResultRow } from "pg";

export type QueryExecutor = <T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[],
) => Promise<{ rows: T[] }>;

export type InsertCommandDispatchInput = {
  id: string;
  commandName: string;
  tenantId: string;
  targetService: string;
  targetTopic: string;
  correlationId?: string;
  requestId: string;
  payloadHash: string;
  outboxEventId: string;
  routingMetadata: Record<string, unknown>;
  initiatedBy?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

const INSERT_COMMAND_DISPATCH_SQL = `
  INSERT INTO command_dispatches (
    id,
    command_name,
    tenant_id,
    target_service,
    target_topic,
    correlation_id,
    request_id,
    status,
    payload_hash,
    outbox_event_id,
    routing_metadata,
    initiated_by,
    issued_at,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    'ACCEPTED',
    $8,
    $9,
    $10::jsonb,
    $11::jsonb,
    NOW(),
    $12::jsonb,
    NOW(),
    NOW()
  )
`;

const UPDATE_STATUS_SQL = `
  UPDATE command_dispatches
  SET
    status = $2::command_dispatch_status,
    updated_at = NOW()
  WHERE outbox_event_id = $1
`;

export const createCommandDispatchRepository = (query: QueryExecutor) => {
  const insertCommandDispatch = async (
    input: InsertCommandDispatchInput,
  ): Promise<void> => {
    await query(INSERT_COMMAND_DISPATCH_SQL, [
      input.id,
      input.commandName,
      input.tenantId,
      input.targetService,
      input.targetTopic,
      input.correlationId ?? null,
      input.requestId,
      input.payloadHash,
      input.outboxEventId,
      JSON.stringify(input.routingMetadata ?? {}),
      JSON.stringify(input.initiatedBy ?? null),
      JSON.stringify(input.metadata ?? {}),
    ]);
  };

  const updateCommandDispatchStatus = async (
    outboxEventId: string,
    status: CommandDispatchStatus,
  ): Promise<void> => {
    await query(UPDATE_STATUS_SQL, [outboxEventId, status]);
  };

  return {
    insertCommandDispatch,
    updateCommandDispatchStatus,
  };
};
