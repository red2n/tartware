import {
  applyChannelRateAdjustment,
  type ChannelContentItem,
  type ChannelInventoryItem,
  type ChannelPushKind,
  type ChannelRateItem,
  type ChannelTarget,
  type ChannelTransport,
  type ChannelTransportResult,
  formatChannelMoney,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import { resolveChannelTransport } from "../../channels/transports.js";
import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import {
  closeChannelSync,
  failChannelSync,
  openChannelSync,
} from "../../repositories/channel-sync-repository.js";
import type {
  IntegrationMappingUpdateCommand,
  IntegrationOtaContentSyncCommand,
  IntegrationOtaRatePushCommand,
  IntegrationOtaSyncRequestCommand,
  IntegrationWebhookRetryCommand,
} from "../../schemas/reservation-command.js";

import {
  type CreateReservationResult,
  DEFAULT_CURRENCY,
  ReservationCommandError,
  SYSTEM_ACTOR_ID,
} from "./common.js";
import { createReservation } from "./core.js";

/* ================================================================== */
/*  INTEGRATION / OTA / GDS HANDLERS                                  */
/* ================================================================== */

/**
 * What every outbound handler needs from `ota_configurations`, including the
 * `transport` column that decides whether anything is contacted at all.
 */
type ChannelConfigRow = {
  id: string;
  ota_name: string;
  ota_code: string;
  transport: string;
  hotel_id: string | null;
  api_endpoint: string | null;
  api_key: string | null;
  api_secret: string | null;
};

/** Build the adapter's view of a channel from its configuration row. */
const toChannelTarget = (
  tenantId: string,
  propertyId: string,
  row: ChannelConfigRow,
): ChannelTarget => ({
  tenant_id: tenantId,
  property_id: propertyId,
  ota_config_id: row.id,
  ota_code: row.ota_code,
  ota_name: row.ota_name,
  hotel_id: row.hotel_id,
  api_endpoint: row.api_endpoint,
  api_key: row.api_key,
  api_secret: row.api_secret,
});

/**
 * Contact a channel and record what it said.
 *
 * The order is the whole point of this function. The sync row is opened
 * `in_progress` *before* the push and closed with the outcome *after* it, so a
 * channel that times out leaves a row saying so. Every one of these handlers
 * used to write `sync_status = 'completed', failed_items = 0` inside the same
 * transaction as the outbox enqueue, before any transport existed — and to
 * write it with `sync_direction = 'outbound'`, which the column's CHECK
 * rejects, so the whole statement threw 23514 on every call.
 *
 * An unconfigured channel throws before the row is opened: nothing was
 * attempted, so there is no attempt to log, and the error is non-retryable
 * because no amount of waiting configures a channel.
 */
const pushToChannel = async (params: {
  syncId: string;
  target: ChannelTarget;
  transportKind: string;
  pushKind: ChannelPushKind;
  syncType?: string;
  totalItems: number;
  dateRangeStart?: Date | null;
  dateRangeEnd?: Date | null;
  actorId: string;
  send: (transport: ChannelTransport) => Promise<ChannelTransportResult>;
}): Promise<ChannelTransportResult> => {
  const transport = resolveChannelTransport(params.transportKind, params.target.ota_code);

  await openChannelSync({
    syncId: params.syncId,
    target: params.target,
    pushKind: params.pushKind,
    syncType: params.syncType,
    totalItems: params.totalItems,
    dateRangeStart: params.dateRangeStart,
    dateRangeEnd: params.dateRangeEnd,
    actorId: params.actorId,
  });

  let result: ChannelTransportResult;
  try {
    result = await params.send(transport);
  } catch (error) {
    // A transport failure is the one kind a retry can fix, so the original
    // error is rethrown unchanged and the consumer's ladder decides.
    await failChannelSync(params.syncId, params.target.tenant_id, error);
    throw error;
  }

  await closeChannelSync(params.syncId, params.target.tenant_id, result);

  // A channel that rejected everything is a failed command, not a quiet one —
  // but it is recorded first, and non-retryable, because the answer will not
  // change on a second attempt. A PARTIAL push is left to stand: some of the
  // inventory did land, and the row says how much.
  if (result.outcome === "FAILED") {
    throw new ReservationCommandError(
      "CHANNEL_PUSH_FAILED",
      `Channel "${params.target.ota_code}" rejected the ${params.pushKind.toLowerCase()} push: ${
        result.error_message ?? result.error_code ?? "no reason given"
      }`,
    );
  }

  return result;
};

/**
 * Load a channel's configuration, or refuse the command.
 *
 * `transport` is selected alongside the credentials because it is what decides
 * whether the push happens at all — reading the row without it is how three
 * handlers came to record successful pushes to channels that were never
 * contacted.
 */
const loadChannelConfig = async (params: {
  tenantId: string;
  propertyId: string;
  otaCode?: string;
  otaConfigId?: string;
}): Promise<ChannelConfigRow> => {
  const byId = Boolean(params.otaConfigId);
  const { rows } = await query<ChannelConfigRow>(
    `SELECT id, ota_name, ota_code, transport, hotel_id, api_endpoint, api_key, api_secret
       FROM ota_configurations
      WHERE tenant_id = $1 AND property_id = $2
        AND ${byId ? "id = $3" : "ota_code = $3"}
        AND is_active = TRUE AND is_deleted = FALSE`,
    [params.tenantId, params.propertyId, params.otaConfigId ?? params.otaCode],
  );
  if (rows.length === 0) {
    throw new ReservationCommandError(
      "OTA_NOT_CONFIGURED",
      `No active OTA configuration ${byId ? "with id" : "for code"} "${
        params.otaConfigId ?? params.otaCode
      }" on property ${params.propertyId}`,
    );
  }
  return rows[0];
};

/**
 * Request an OTA availability sync.
 *
 * Reads current inventory for the property, maps each room type to the code
 * this channel knows it by, pushes the ARI update through the channel's
 * configured transport, and records the outcome in `ota_inventory_sync`.
 */
export const otaSyncRequest = async (
  tenantId: string,
  command: IntegrationOtaSyncRequestCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const syncId = uuid();
  const syncScope = command.sync_scope ?? "full";

  const otaConfig = await loadChannelConfig({
    tenantId,
    propertyId: command.property_id,
    otaCode: command.ota_code,
  });

  // Availability for the next 30 days, joined to the code this channel knows
  // each room type by. The join is INNER: a room type this channel has no
  // mapping for cannot be pushed, and `channel_code` scopes the mapping to
  // *this* channel — without it a Booking.com code would match an Expedia row.
  const { rows: availabilityRows } = await query<{
    room_type_id: string;
    room_type_code: string;
    stay_date: Date;
    total_rooms: number;
    sold: string;
    available: string;
  }>(
    // room_types has no total_rooms column — the room inventory is the source
    // of truth, so the count comes from rooms. Computed in a lateral subquery
    // rather than another LEFT JOIN, which would multiply against the
    // reservations join and inflate the sold count.
    `SELECT rt.id AS room_type_id, cm.external_code AS room_type_code,
            d.day::date AS stay_date,
            inv.total_rooms,
            COUNT(r.id) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN')
              AND r.check_in_date <= d.day AND r.check_out_date > d.day) AS sold,
            inv.total_rooms - COUNT(r.id) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN')
              AND r.check_in_date <= d.day AND r.check_out_date > d.day) AS available
     FROM room_types rt
     JOIN channel_mappings cm ON cm.tenant_id = $1 AND cm.property_id = $2
       AND cm.entity_type = 'room_type' AND cm.entity_id = rt.id
       AND cm.channel_code = $3 AND cm.is_active = TRUE
       AND COALESCE(cm.is_deleted, FALSE) = FALSE
     CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '1 day') AS d(day)
     CROSS JOIN LATERAL (
       SELECT COUNT(rm.id)::int AS total_rooms
         FROM rooms rm
        WHERE rm.room_type_id = rt.id AND rm.tenant_id = $1
          AND rm.property_id = $2 AND COALESCE(rm.is_deleted, FALSE) = FALSE
     ) inv
     LEFT JOIN reservations r ON r.room_type_id = rt.id AND r.tenant_id = $1
       AND r.property_id = $2 AND r.is_deleted = FALSE
     WHERE rt.tenant_id = $1 AND rt.property_id = $2 AND rt.is_deleted = FALSE
     GROUP BY rt.id, cm.external_code, inv.total_rooms, d.day
     ORDER BY d.day, cm.external_code
     LIMIT 1000`,
    [tenantId, command.property_id, otaConfig.ota_code],
  );

  if (availabilityRows.length === 0) {
    throw new ReservationCommandError(
      "CHANNEL_MAPPING_MISSING",
      `No active room-type mappings for channel "${otaConfig.ota_code}" on property ${command.property_id}; nothing can be pushed until channel_mappings has one`,
    );
  }

  const items: ChannelInventoryItem[] = availabilityRows.map((row) => ({
    room_type_id: row.room_type_id,
    room_type_code: row.room_type_code,
    stay_date: new Date(row.stay_date),
    available: Number(row.available),
    sold: Number(row.sold),
    total_rooms: Number(row.total_rooms),
  }));

  const target = toChannelTarget(tenantId, command.property_id, otaConfig);
  const result = await pushToChannel({
    syncId,
    target,
    transportKind: otaConfig.transport,
    pushKind: "INVENTORY",
    syncType: syncScope === "full" ? "full" : "incremental",
    totalItems: items.length,
    dateRangeStart: items[0]?.stay_date ?? null,
    dateRangeEnd: items[items.length - 1]?.stay_date ?? null,
    actorId: SYSTEM_ACTOR_ID,
    send: (transport) => transport.pushInventory(target, items),
  });

  await withTransaction(async (client) => {
    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: syncId,
      aggregateType: "ota_sync",
      eventType: "integration.ota.availability_synced",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "integration.ota.availability_synced",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          sync_id: syncId,
          ota_code: command.ota_code,
          property_id: command.property_id,
          sync_scope: syncScope,
          // What the channel accepted, not what was computed. The two differ on
          // a PARTIAL push, and the event is read as the record of what is now
          // live on the channel.
          records_synced: result.accepted_items,
          records_rejected: result.rejected_items,
          simulated: result.simulated,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.property_id,
      metadata: { source: serviceConfig.serviceId, action: "integration.ota.sync_request" },
    });
  });

  reservationsLogger.info(
    {
      syncId,
      otaCode: command.ota_code,
      propertyId: command.property_id,
      outcome: result.outcome,
      accepted: result.accepted_items,
      rejected: result.rejected_items,
      simulated: result.simulated,
    },
    "OTA availability push recorded",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Push rate plans to an OTA channel.
 *
 * Reads `ota_rate_plans` for the property/OTA, applies markup/markdown, pushes
 * through the channel's configured transport, and records the outcome.
 */
export const otaRatePush = async (
  tenantId: string,
  command: IntegrationOtaRatePushCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const syncId = uuid();

  const otaConfig = await loadChannelConfig({
    tenantId,
    propertyId: command.property_id,
    otaCode: command.ota_code,
  });

  const ratePlanFilter = command.rate_plan_id ? "AND orp.rate_id = $4" : "";
  const params: string[] = [tenantId, command.property_id, otaConfig.id];
  if (command.rate_plan_id) params.push(command.rate_plan_id);

  const { rows: ratePlans } = await query<{
    rate_id: string;
    ota_rate_code: string;
    markup_percentage: string | null;
    markdown_percentage: string | null;
    base_rate: string | null;
    currency: string | null;
  }>(
    `SELECT orp.rate_id, orp.ota_rate_plan_id AS ota_rate_code,
            orp.markup_percentage, orp.markdown_percentage,
            r.base_rate, r.currency
       FROM ota_rate_plans orp
       JOIN rates r ON r.id = orp.rate_id AND r.tenant_id = $1
      WHERE orp.tenant_id = $1 AND orp.property_id = $2
        AND orp.ota_configuration_id = $3
        AND orp.is_active = TRUE AND orp.is_deleted = FALSE
        ${ratePlanFilter}`,
    params,
  );

  if (ratePlans.length === 0) {
    throw new ReservationCommandError(
      "CHANNEL_RATE_PLANS_MISSING",
      `No active rate-plan mappings for channel "${otaConfig.ota_code}" on property ${command.property_id}`,
    );
  }

  const items: ChannelRateItem[] = ratePlans.map((plan) => ({
    rate_plan_id: plan.rate_id,
    ota_rate_code: plan.ota_rate_code,
    base_rate: formatChannelMoney(plan.base_rate ?? "0", plan.currency),
    pushed_rate: applyChannelRateAdjustment(
      plan.base_rate ?? "0",
      plan.markup_percentage,
      plan.markdown_percentage,
      plan.currency,
    ),
    currency: plan.currency ?? DEFAULT_CURRENCY,
  }));

  const target = toChannelTarget(tenantId, command.property_id, otaConfig);
  const result = await pushToChannel({
    syncId,
    target,
    transportKind: otaConfig.transport,
    pushKind: "RATES",
    totalItems: items.length,
    actorId: SYSTEM_ACTOR_ID,
    send: (transport) => transport.pushRates(target, items),
  });

  await withTransaction(async (client) => {
    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: syncId,
      aggregateType: "ota_sync",
      eventType: "integration.ota.rates_pushed",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "integration.ota.rates_pushed",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          sync_id: syncId,
          ota_code: command.ota_code,
          property_id: command.property_id,
          rate_plans_pushed: result.accepted_items,
          rate_plans_rejected: result.rejected_items,
          simulated: result.simulated,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.property_id,
      metadata: { source: serviceConfig.serviceId, action: "integration.ota.rate_push" },
    });
  });

  reservationsLogger.info(
    {
      syncId,
      otaCode: command.ota_code,
      propertyId: command.property_id,
      outcome: result.outcome,
      accepted: result.accepted_items,
      rejected: result.rejected_items,
      simulated: result.simulated,
    },
    "OTA rate push recorded",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Retry a failed webhook delivery.
 * Finds the webhook subscription, increments retry count,
 * and re-enqueues the delivery attempt.
 */
export const webhookRetry = async (
  tenantId: string,
  command: IntegrationWebhookRetryCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE webhook_subscriptions
       SET retry_count = retry_count + 1,
           last_triggered_at = NOW(),
           updated_at = NOW()
       WHERE subscription_id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [command.subscription_id, tenantId],
    );

    if (!rowCount || rowCount === 0) {
      throw new ReservationCommandError(
        "WEBHOOK_NOT_FOUND",
        `Webhook subscription ${command.subscription_id} not found`,
      );
    }

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.subscription_id,
      aggregateType: "webhook",
      eventType: "integration.webhook.retried",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "integration.webhook.retried",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          subscription_id: command.subscription_id,
          event_id: command.event_id,
          reason: command.reason,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.subscription_id,
      metadata: { source: serviceConfig.serviceId, action: "integration.webhook.retry" },
    });
  });

  reservationsLogger.info({ subscriptionId: command.subscription_id }, "Webhook retry scheduled");

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Update an integration mapping (channel_mappings / integration_mappings).
 * Applies the new mapping payload and records the change.
 */
export const updateIntegrationMapping = async (
  tenantId: string,
  command: IntegrationMappingUpdateCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE integration_mappings
       SET transformation_rules = COALESCE(($3::jsonb)->'transformation_rules', transformation_rules),
           field_mappings = COALESCE(($3::jsonb)->'field_mappings', field_mappings),
           is_active = COALESCE((($3::jsonb)->>'is_active')::boolean, is_active),
           updated_at = NOW(), updated_by = $4
       WHERE mapping_id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [command.mapping_id, tenantId, JSON.stringify(command.mapping_payload), SYSTEM_ACTOR_ID],
    );

    if (!rowCount || rowCount === 0) {
      throw new ReservationCommandError(
        "MAPPING_NOT_FOUND",
        `Integration mapping ${command.mapping_id} not found`,
      );
    }

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.mapping_id,
      aggregateType: "integration_mapping",
      eventType: "integration.mapping.updated",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "integration.mapping.updated",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          mapping_id: command.mapping_id,
          reason: command.reason,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.mapping_id,
      metadata: { source: serviceConfig.serviceId, action: "integration.mapping.update" },
    });
  });

  reservationsLogger.info({ mappingId: command.mapping_id }, "Integration mapping updated");

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Drain the inbound OTA reservation queue.
 *
 * Each entry becomes a `reservation.create` command, which is the whole point
 * of this rewrite. It used to `INSERT INTO reservations` directly, and so an
 * OTA booking — the one booking path where the hotel does not control the
 * input — was the only one that took no availability hold, evaluated no
 * restriction, passed no blacklist gate, entered no legal initial status, and
 * wrote neither `reservation_rooms` nor `reservation_nights`. Every control
 * built into `createReservation` was absent from it, and a control with a
 * cheaper route around it is not a control.
 *
 * The consequence of going through the command is that the reservation does not
 * exist when this function returns: `createReservation` enqueues an event and
 * the applier inserts the row. So an accepted entry is left `PROCESSING` and is
 * moved to `COMPLETED` by the event handler, which is also where
 * `reservation_id` can first be set — the column has a foreign key, and there
 * is nothing to point it at until the insert has run. `waitlist_entries` solves
 * the identical problem the identical way.
 */
export const processOtaReservationQueue = async (
  tenantId: string,
  propertyId: string,
  options: { correlationId?: string } = {},
): Promise<{ processed: number; failed: number; duplicates: number }> => {
  const { rows: pending } = await query<{
    id: string;
    ota_configuration_id: string;
    ota_code: string;
    ota_reservation_id: string;
    ota_booking_reference: string | null;
    guest_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    check_in_date: Date;
    check_out_date: Date;
    room_type: string;
    total_amount: string | null;
    currency_code: string | null;
    special_requests: string | null;
  }>(
    // 'PENDING', not 'pending'. The DDL default, the CHECK-free column's own
    // documentation and three partial indexes described as "critical for queue
    // processing" all say uppercase; this reader said lowercase, so the indexes
    // could not serve it and a row inserted with the documented default would
    // never have been drained.
    `SELECT q.id, q.ota_configuration_id, c.ota_code,
            q.ota_reservation_id, q.ota_booking_reference,
            q.guest_name, q.guest_email, q.guest_phone,
            q.check_in_date, q.check_out_date,
            q.room_type,
            q.total_amount, q.currency_code,
            q.special_requests
       FROM ota_reservations_queue q
       JOIN ota_configurations c ON c.id = q.ota_configuration_id
      WHERE q.tenant_id = $1 AND q.property_id = $2
        AND q.status = 'PENDING'
      ORDER BY q.created_at ASC
      LIMIT 100`,
    [tenantId, propertyId],
  );

  let processed = 0;
  let failed = 0;
  let duplicates = 0;

  // Sequential, as before, but for a different reason. The duplicate check that
  // used to require it is gone — `idx_ota_queue_ota_reservation_id` is unique
  // now, so a redelivery cannot become a second row and there is no drain-time
  // race left to lose. What keeps this loop one-at-a-time is that each entry
  // now runs a full `createReservation`, which takes an availability hold per
  // room; firing a hundred of those concurrently would contend on the guard for
  // no gain on a queue this size.
  for (const entry of pending) {
    // Claim the entry conditionally. Two drains running at once — the command
    // is dispatchable and also called from a schedule — must not both turn one
    // channel booking into two reservations.
    const claimed = await query(
      `UPDATE ota_reservations_queue
          SET status = 'PROCESSING', updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2 AND status = 'PENDING'`,
      [entry.id, tenantId],
    );
    if (claimed.rowCount === 0) {
      duplicates++;
      continue;
    }

    try {
      // The channel's room code, resolved through this channel's own mappings.
      // `channel_code` scopes the lookup, which it never did: without it a
      // Booking.com room code matched an Expedia mapping row, and the booking
      // was created against whichever room type happened to answer first.
      const { rows: mappingRows } = await query<{ entity_id: string }>(
        `SELECT entity_id FROM channel_mappings
          WHERE tenant_id = $1 AND property_id = $2
            AND entity_type = 'room_type'
            AND external_code = $3
            AND channel_code = $4
            AND is_active = TRUE
            AND COALESCE(is_deleted, FALSE) = FALSE
          LIMIT 1`,
        [tenantId, propertyId, entry.room_type, entry.ota_code],
      );
      const roomTypeId = mappingRows[0]?.entity_id;
      if (!roomTypeId) {
        throw new ReservationCommandError(
          "CHANNEL_MAPPING_MISSING",
          `No active mapping on channel "${entry.ota_code}" for room type "${entry.room_type}"`,
        );
      }

      const guestId = await resolveOtaGuest(tenantId, entry);

      // The same command the front desk runs. Everything it enforces —
      // restrictions, the availability hold, the blacklist gate, the legal
      // initial status, the stay tables — now applies to a channel booking.
      await createReservation(
        tenantId,
        {
          property_id: propertyId,
          guest_id: guestId,
          room_type_id: roomTypeId,
          check_in_date: entry.check_in_date,
          check_out_date: entry.check_out_date,
          total_amount: Number(entry.total_amount ?? 0),
          currency: entry.currency_code ?? DEFAULT_CURRENCY,
          source: "OTA",
          reservation_type: "TRANSIENT",
          notes: entry.special_requests ?? undefined,
          ota_queue_id: entry.id,
        },
        { correlationId: options.correlationId, actorId: SYSTEM_ACTOR_ID },
      );

      // Left PROCESSING deliberately. The command is accepted, not applied —
      // `linkOtaQueueEntry` in the event handler completes the row when the
      // reservation actually exists. An entry still PROCESSING long after
      // `updated_at` is a booking whose command never landed, which is a fact
      // worth being able to read; `idx_ota_queue_processing` indexes exactly
      // that, and now that this file agrees with it on the spelling, it works.
      processed++;
    } catch (err) {
      reservationsLogger.error(
        { queueId: entry.id, otaReservationId: entry.ota_reservation_id, error: err },
        "Failed to process OTA reservation queue entry",
      );
      try {
        await query(
          `UPDATE ota_reservations_queue
              SET status = 'FAILED',
                  error_message = $2,
                  processing_attempts = processing_attempts + 1,
                  processed_at = NOW(),
                  updated_at = NOW()
            WHERE id = $1`,
          [entry.id, err instanceof Error ? err.message : String(err)],
        );
      } catch {
        /* ignore tracking error */
      }
      failed++;
    }
  }

  reservationsLogger.info(
    { propertyId, processed, failed, duplicates },
    "OTA reservation queue processing completed",
  );

  return { processed, failed, duplicates };
};

/**
 * Find or create the guest a channel booking belongs to.
 *
 * Matching is by email only, never by name: an OTA booking must not silently
 * attach to the wrong person, and two guests called J. Smith is the ordinary
 * case rather than the edge one. A booking with no email always gets a new
 * profile, which is the honest outcome — a duplicate profile is recoverable,
 * a merged one is not.
 */
const resolveOtaGuest = async (
  tenantId: string,
  entry: {
    guest_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
  },
): Promise<string> => {
  const guestName = entry.guest_name?.trim() || "OTA Guest";
  const guestEmail = entry.guest_email?.trim() || null;

  if (guestEmail) {
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM guests
        WHERE tenant_id = $1::uuid AND LOWER(email) = LOWER($2)
          AND COALESCE(is_deleted, false) = false
        LIMIT 1`,
      [tenantId, guestEmail],
    );
    if (rows[0]?.id) return rows[0].id;
  }

  const [firstName, ...restName] = guestName.split(/\s+/);
  const { rows: created } = await query<{ id: string }>(
    `INSERT INTO guests (tenant_id, first_name, last_name, email, phone, created_by, updated_by)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::uuid, $6::uuid)
     RETURNING id`,
    [
      tenantId,
      firstName ?? "OTA",
      restName.join(" ") || "Guest",
      guestEmail,
      entry.guest_phone ?? null,
      SYSTEM_ACTOR_ID,
    ],
  );
  return created[0].id;
};

/**
 * Sync property content (photos, descriptions, amenities, policies, room types)
 * to an OTA channel.
 *
 * Reads the requested content categories from the local DB, pushes them
 * through the channel's configured transport, and records the outcome in
 * `ota_inventory_sync`.
 */
export const otaContentSync = async (
  tenantId: string,
  command: IntegrationOtaContentSyncCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const syncId = uuid();
  const contentTypes = command.content_types.includes("ALL")
    ? ["PHOTOS", "DESCRIPTIONS", "AMENITIES", "POLICIES", "ROOM_TYPES"]
    : command.content_types;

  const otaConfig = await loadChannelConfig({
    tenantId,
    propertyId: command.property_id,
    otaConfigId: command.ota_config_id,
  });

  const items: ChannelContentItem[] = [];

  if (contentTypes.includes("ROOM_TYPES")) {
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM room_types
        WHERE tenant_id = $1 AND property_id = $2 AND is_deleted = FALSE`,
      [tenantId, command.property_id],
    );
    for (const row of rows) {
      items.push({
        content_type: "ROOM_TYPES",
        reference_id: row.id,
        ...(command.language ? { language: command.language } : {}),
      });
    }
  }

  if (contentTypes.includes("AMENITIES")) {
    const { rows } = await query<{ amenity_id: string }>(
      `SELECT amenity_id FROM room_amenity_catalog
        WHERE tenant_id = $1 AND property_id = $2 AND is_active = TRUE`,
      [tenantId, command.property_id],
    );
    for (const row of rows) {
      items.push({
        content_type: "AMENITIES",
        reference_id: row.amenity_id,
        ...(command.language ? { language: command.language } : {}),
      });
    }
  }

  // Photos, descriptions and policies are property-level: one item each.
  for (const contentType of ["PHOTOS", "DESCRIPTIONS", "POLICIES"]) {
    if (contentTypes.includes(contentType)) {
      items.push({
        content_type: contentType,
        ...(command.language ? { language: command.language } : {}),
      });
    }
  }

  if (items.length === 0) {
    throw new ReservationCommandError(
      "CHANNEL_CONTENT_EMPTY",
      `No content of types ${contentTypes.join(", ")} exists on property ${command.property_id}`,
    );
  }

  const target = toChannelTarget(tenantId, command.property_id, otaConfig);
  const result = await pushToChannel({
    syncId,
    target,
    transportKind: otaConfig.transport,
    pushKind: "CONTENT",
    syncType: command.force_full_sync ? "full" : "incremental",
    totalItems: items.length,
    actorId: SYSTEM_ACTOR_ID,
    send: (transport) => transport.pushContent(target, items),
  });

  await withTransaction(async (client) => {
    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: syncId,
      aggregateType: "ota_sync",
      eventType: "integration.ota.content_synced",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "integration.ota.content_synced",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          sync_id: syncId,
          ota_config_id: command.ota_config_id,
          property_id: command.property_id,
          content_types: contentTypes,
          language: command.language,
          force_full_sync: command.force_full_sync,
          items_synced: result.accepted_items,
          items_rejected: result.rejected_items,
          simulated: result.simulated,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.property_id,
      metadata: { source: serviceConfig.serviceId, action: "integration.ota.content_sync" },
    });
  });

  reservationsLogger.info(
    {
      syncId,
      otaConfigId: command.ota_config_id,
      contentTypes,
      propertyId: command.property_id,
      outcome: result.outcome,
      accepted: result.accepted_items,
      simulated: result.simulated,
    },
    "OTA content push recorded",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};
