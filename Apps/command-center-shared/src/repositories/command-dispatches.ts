import type {
  CommandDispatchLookup,
  CommandDispatchStatus,
  InsertCommandDispatchInput,
  QueryExecutor,
} from "@tartware/schemas";

export type { QueryExecutor, InsertCommandDispatchInput, CommandDispatchLookup };

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
  ON CONFLICT DO NOTHING
  RETURNING id
`;

const FIND_COMMAND_DISPATCH_BY_REQUEST_SQL = `
  SELECT
    id,
    command_name,
    tenant_id,
    correlation_id,
    request_id,
    payload_hash,
    target_service,
    target_topic,
    issued_at,
    routing_metadata,
    metadata
  FROM command_dispatches
  WHERE tenant_id = $1
    AND command_name = $2
    AND request_id = $3
  LIMIT 1
`;

const UPDATE_STATUS_SQL = `
  UPDATE command_dispatches
  SET
    status = $2::command_dispatch_status,
    updated_at = NOW()
  WHERE outbox_event_id = $1
`;

const UPDATE_STATUS_BATCH_SQL = `
  UPDATE command_dispatches
  SET
    status = $2::command_dispatch_status,
    updated_at = NOW()
  WHERE outbox_event_id = ANY($1::uuid[])
`;

export const createCommandDispatchRepository = (query: QueryExecutor) => {
  const findCommandDispatchByRequest = async (
    tenantId: string,
    commandName: string,
    requestId: string,
  ): Promise<CommandDispatchLookup | null> => {
    const { rows } = await query<CommandDispatchLookup>(FIND_COMMAND_DISPATCH_BY_REQUEST_SQL, [
      tenantId,
      commandName,
      requestId,
    ]);
    return rows[0] ?? null;
  };

  /**
   * Insert the dispatch row, reporting `false` when one already exists for this
   * (tenant, command, request).
   *
   * The prior lookup cannot rule that out: two identical requests can both read
   * "not found" and then both insert. `ON CONFLICT DO NOTHING` turns the loser
   * of that race into a value the caller can act on instead of a unique-index
   * violation surfacing as a 500 — which is exactly what retry storms produce.
   *
   * No conflict target is named on purpose. `idx_command_dispatches_request_dedupe`
   * covers `(tenant_id, command_name, request_id)`, which omits the `created_at`
   * partition key, so it cannot exist as a table-wide unique index once
   * `95_partition_hot_tables.sql` has run — and naming it as a target would make
   * every insert fail there with "no unique or exclusion constraint matching the
   * ON CONFLICT specification". Untargeted, this matches whatever uniqueness the
   * deployment actually has and degrades to today's behaviour where there is
   * none, rather than trading a rare race for a total outage.
   */
  const insertCommandDispatch = async (input: InsertCommandDispatchInput): Promise<boolean> => {
    const { rows } = await query(INSERT_COMMAND_DISPATCH_SQL, [
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
    // `RETURNING id` yields a row only when the insert actually happened, so an
    // empty result is the conflict rather than an error to interpret.
    return rows.length > 0;
  };

  const updateCommandDispatchStatus = async (
    outboxEventId: string,
    status: CommandDispatchStatus,
  ): Promise<void> => {
    await query(UPDATE_STATUS_SQL, [outboxEventId, status]);
  };

  /**
   * Move a whole dispatched batch to one status in a single statement, so the
   * bookkeeping cost stays flat as the dispatcher's batch size grows.
   */
  const updateCommandDispatchStatusBatch = async (
    outboxEventIds: string[],
    status: CommandDispatchStatus,
  ): Promise<void> => {
    if (outboxEventIds.length === 0) {
      return;
    }
    await query(UPDATE_STATUS_BATCH_SQL, [outboxEventIds, status]);
  };

  return {
    findCommandDispatchByRequest,
    insertCommandDispatch,
    updateCommandDispatchStatus,
    updateCommandDispatchStatusBatch,
  };
};
