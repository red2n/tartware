import {
  CHANNEL_SYNC_DIRECTION_PUSH,
  CHANNEL_SYNC_STATUS_COLUMN,
  type ChannelPushKind,
  type ChannelTarget,
  type ChannelTransportResult,
} from "@tartware/schemas";

import { query } from "../lib/db.js";

/**
 * Persistence for `ota_inventory_sync` — the record of what was pushed to a
 * channel and what the channel said about it.
 *
 * Two things this replaces, both of which made the table lie:
 *
 * - Every handler wrote `sync_direction = 'outbound'`, which the column's CHECK
 *   constraint rejects with 23514. All three outbound OTA commands therefore
 *   threw on every invocation, retryably, burning the full backoff ladder
 *   before the DLQ. `CHANNEL_SYNC_DIRECTION_PUSH` is the accepted word.
 * - Every handler wrote `sync_status = 'completed'` with
 *   `successful_items = total_items` and `failed_items = 0` *before* any push,
 *   for a transport that did not exist.
 *
 * So the row is now written in two steps: `in_progress` before the channel is
 * contacted, and the outcome after it answers. A sync that is still
 * `in_progress` long after `sync_started_at` is a push that died mid-flight,
 * which is a fact worth being able to read.
 */

/** How `ChannelPushKind` maps onto the `sync_type` CHECK vocabulary. */
const SYNC_TYPE_BY_PUSH: Record<ChannelPushKind, string> = {
  INVENTORY: "full",
  RATES: "incremental",
  CONTENT: "incremental",
};

type OpenSyncInput = {
  syncId: string;
  target: ChannelTarget;
  pushKind: ChannelPushKind;
  /** `sync_type` override, where the command distinguishes full from incremental. */
  syncType?: string;
  totalItems: number;
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date | null;
  actorId: string;
};

/**
 * Record the attempt before it is made.
 *
 * Written outside the handler's transaction on purpose: it has to survive the
 * push failing, or a channel that timed out would leave no trace at all.
 */
export const openChannelSync = async (input: OpenSyncInput): Promise<void> => {
  await query(
    `INSERT INTO ota_inventory_sync (
       sync_id, tenant_id, property_id, ota_config_id, channel_name,
       sync_type, sync_direction, sync_status,
       total_items, successful_items, failed_items,
       date_range_start, date_range_end,
       sync_started_at, triggered_by, created_by
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, $7, 'in_progress',
       $8, 0, 0,
       $9, $10,
       NOW(), 'system', $11
     )`,
    [
      input.syncId,
      input.target.tenant_id,
      input.target.property_id,
      input.target.ota_config_id,
      input.target.ota_name,
      input.syncType ?? SYNC_TYPE_BY_PUSH[input.pushKind],
      CHANNEL_SYNC_DIRECTION_PUSH,
      input.totalItems,
      input.dateRangeStart ?? null,
      input.dateRangeEnd ?? null,
      input.actorId,
    ],
  );
};

/**
 * Record what the channel said.
 *
 * `sync_notes` carries the `SIMULATED:` marker for a declared stub, on the same
 * reasoning as the `FORCED:` and `STEP_UP:` prefixes on `flow_approvals` — the
 * record has to say which of the two happened, and a boolean nobody selects is
 * not a record.
 */
export const closeChannelSync = async (
  syncId: string,
  tenantId: string,
  result: ChannelTransportResult,
): Promise<void> => {
  await query(
    `UPDATE ota_inventory_sync
        SET sync_status = $3,
            successful_items = $4,
            failed_items = $5,
            sync_completed_at = NOW(),
            duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - sync_started_at))::int),
            error_code = $6,
            error_message = $7,
            response_payload = $8::jsonb,
            http_status_code = $9,
            api_response_time_ms = $10,
            sync_notes = $11,
            updated_at = NOW()
      WHERE sync_id = $1 AND tenant_id = $2`,
    [
      syncId,
      tenantId,
      CHANNEL_SYNC_STATUS_COLUMN[result.outcome],
      result.accepted_items,
      result.rejected_items,
      result.error_code,
      result.error_message,
      result.response_payload ? JSON.stringify(result.response_payload) : null,
      result.http_status,
      result.response_time_ms,
      result.simulated
        ? "SIMULATED: no channel was contacted — ota_configurations.transport is SIMULATED"
        : result.channel_reference
          ? `CHANNEL_REFERENCE: ${result.channel_reference}`
          : null,
    ],
  );
};

/**
 * Record a push that never reached the channel — a timeout, a socket failure,
 * an unparseable body.
 *
 * Separate from `closeChannelSync` because there is no `ChannelTransportResult`
 * to record: the adapter threw rather than answering, and leaving the row
 * `in_progress` would make an infrastructure failure indistinguishable from a
 * process that was killed mid-push.
 */
export const failChannelSync = async (
  syncId: string,
  tenantId: string,
  error: unknown,
): Promise<void> => {
  await query(
    `UPDATE ota_inventory_sync
        SET sync_status = 'failed',
            failed_items = total_items,
            sync_completed_at = NOW(),
            duration_seconds = GREATEST(0, EXTRACT(EPOCH FROM (NOW() - sync_started_at))::int),
            error_code = 'CHANNEL_TRANSPORT_ERROR',
            error_message = $3,
            updated_at = NOW()
      WHERE sync_id = $1 AND tenant_id = $2`,
    [syncId, tenantId, error instanceof Error ? error.message : String(error)],
  );
};
