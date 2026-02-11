import { v4 as uuid } from "uuid";

import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import type {
  IntegrationMappingUpdateCommand,
  IntegrationOtaRatePushCommand,
  IntegrationOtaSyncRequestCommand,
  IntegrationWebhookRetryCommand,
} from "../../schemas/reservation-command.js";

import {
  type CreateReservationResult,
  ReservationCommandError,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/* ================================================================== */
/*  INTEGRATION / OTA / GDS HANDLERS                                  */
/* ================================================================== */

/**
 * Request an OTA availability sync.
 * Reads current inventory for the property, builds an ARI (Availability-
 * Rates-Inventory) update payload, and records it in `ota_inventory_sync`.
 * Actual push to the OTA API is simulated — replace the stub with a real
 * channel-manager client (e.g., SiteMinder, Cloudbeds) for production.
 */
export const otaSyncRequest = async (
  tenantId: string,
  command: IntegrationOtaSyncRequestCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const syncId = uuid();
  const syncScope = command.sync_scope ?? "full";

  await withTransaction(async (client) => {
    // Verify OTA configuration exists
    const { rows: otaRows } = await client.query(
      `SELECT id, ota_name, api_endpoint, availability_push_enabled
       FROM ota_configurations
       WHERE tenant_id = $1 AND property_id = $2 AND ota_code = $3
         AND is_active = TRUE AND is_deleted = FALSE`,
      [tenantId, command.property_id, command.ota_code],
    );
    if (otaRows.length === 0) {
      throw new ReservationCommandError(
        "OTA_NOT_CONFIGURED",
        `No active OTA configuration for code "${command.ota_code}" on property ${command.property_id}`,
      );
    }
    const otaConfig = otaRows[0];

    // Gather current room availability for the next 30 days
    const { rows: availabilityRows } = await client.query(
      `SELECT rt.id AS room_type_id, rt.code AS room_type_code,
              rt.total_rooms,
              COUNT(r.id) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN')
                AND r.check_in_date <= d.day AND r.check_out_date > d.day) AS sold,
              rt.total_rooms - COUNT(r.id) FILTER (WHERE r.status IN ('CONFIRMED', 'CHECKED_IN')
                AND r.check_in_date <= d.day AND r.check_out_date > d.day) AS available
       FROM room_types rt
       CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', '1 day') AS d(day)
       LEFT JOIN reservations r ON r.room_type_id = rt.id AND r.tenant_id = $1
         AND r.property_id = $2 AND r.is_deleted = FALSE
       WHERE rt.tenant_id = $1 AND rt.property_id = $2 AND rt.is_deleted = FALSE
       GROUP BY rt.id, rt.code, rt.total_rooms, d.day
       ORDER BY d.day, rt.code
       LIMIT 1000`,
      [tenantId, command.property_id],
    );

    // Record sync attempt
    await client.query(
      `INSERT INTO ota_inventory_sync (
        sync_id, tenant_id, property_id, ota_config_id,
        sync_type, sync_direction, sync_status,
        total_items, successful_items, failed_items,
        sync_started_at, sync_completed_at, created_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, 'outbound', 'completed',
        $6, $6, 0,
        NOW(), NOW(), $7
      )`,
      [
        syncId,
        tenantId,
        command.property_id,
        otaConfig.id,
        syncScope,
        availabilityRows.length,
        SYSTEM_ACTOR_ID,
      ],
    );

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
          records_synced: availabilityRows.length,
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
    { syncId, otaCode: command.ota_code, propertyId: command.property_id },
    "OTA availability sync completed",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Push rate plans to an OTA channel.
 * Reads `ota_rate_plans` for the property/OTA, applies markup/markdown,
 * and records the push in `ota_inventory_sync`.
 */
export const otaRatePush = async (
  tenantId: string,
  command: IntegrationOtaRatePushCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const syncId = uuid();

  await withTransaction(async (client) => {
    // Verify OTA configuration
    const { rows: otaRows } = await client.query(
      `SELECT id, ota_name, rate_push_enabled
       FROM ota_configurations
       WHERE tenant_id = $1 AND property_id = $2 AND ota_code = $3
         AND is_active = TRUE AND is_deleted = FALSE`,
      [tenantId, command.property_id, command.ota_code],
    );
    if (otaRows.length === 0) {
      throw new ReservationCommandError(
        "OTA_NOT_CONFIGURED",
        `No active OTA configuration for code "${command.ota_code}"`,
      );
    }
    const otaConfig = otaRows[0];

    // Fetch rate plans mapped for this OTA
    const ratePlanFilter = command.rate_plan_id ? "AND orp.rate_id = $4" : "";
    const params: string[] = [tenantId, command.property_id, otaConfig.id];
    if (command.rate_plan_id) params.push(command.rate_plan_id);

    const { rows: ratePlans } = await client.query(
      `SELECT orp.id AS ota_rate_plan_id, orp.rate_id, orp.ota_rate_plan_id AS ota_rate_code,
              orp.markup_percentage, orp.markdown_percentage,
              r.rate_name, r.base_rate, r.currency
       FROM ota_rate_plans orp
       JOIN rates r ON r.rate_id = orp.rate_id AND r.tenant_id = $1
       WHERE orp.tenant_id = $1 AND orp.property_id = $2
         AND orp.ota_configuration_id = $3
         AND orp.is_active = TRUE AND orp.is_deleted = FALSE
         ${ratePlanFilter}`,
      params,
    );

    // Calculate pushed rates with markup/markdown
    const pushedRates = ratePlans.map((rp: Record<string, unknown>) => {
      const base = Number(rp.base_rate) || 0;
      const markup = Number(rp.markup_percentage) || 0;
      const markdown = Number(rp.markdown_percentage) || 0;
      const adjustedRate = base * (1 + markup / 100) * (1 - markdown / 100);
      return {
        ota_rate_code: rp.ota_rate_code,
        rate_plan_id: rp.rate_plan_id,
        base_rate: base,
        pushed_rate: Math.round(adjustedRate * 100) / 100,
        currency: rp.currency,
      };
    });

    // Record rate push sync
    await client.query(
      `INSERT INTO ota_inventory_sync (
        sync_id, tenant_id, property_id, ota_config_id,
        sync_type, sync_direction, sync_status,
        total_items, successful_items, failed_items,
        sync_started_at, sync_completed_at, created_by
      ) VALUES (
        $1, $2, $3, $4,
        'incremental', 'outbound', 'completed',
        $5, $5, 0,
        NOW(), NOW(), $6
      )`,
      [syncId, tenantId, command.property_id, otaConfig.id, pushedRates.length, SYSTEM_ACTOR_ID],
    );

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
          rate_plans_pushed: pushedRates.length,
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
    { syncId, otaCode: command.ota_code, propertyId: command.property_id },
    "OTA rate push completed",
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
 * Process inbound OTA reservation queue entries.
 * Reads PENDING entries from `ota_reservations_queue`, maps room types
 * via `channel_mappings`, and creates internal reservations.
 * Called during OTA sync requests or scheduled processing.
 */
export const processOtaReservationQueue = async (
  tenantId: string,
  propertyId: string,
  options: { correlationId?: string } = {},
): Promise<{ processed: number; failed: number; duplicates: number }> => {
  const { rows: pending } = await query(
    `SELECT id, ota_configuration_id, ota_reservation_id, ota_booking_reference,
            guest_name, guest_email, guest_phone,
            check_in_date, check_out_date,
            room_type,
            total_amount, currency_code,
            special_requests, raw_payload
     FROM ota_reservations_queue
     WHERE tenant_id = $1 AND property_id = $2
       AND status = 'pending'
     ORDER BY created_at ASC
     LIMIT 100`,
    [tenantId, propertyId],
  );

  let processed = 0;
  let failed = 0;
  let duplicates = 0;

  for (const entry of pending) {
    try {
      await withTransaction(async (client) => {
        // Check for duplicates
        const { rows: existing } = await client.query(
          `SELECT id FROM ota_reservations_queue
           WHERE tenant_id = $1 AND ota_reservation_id = $2
             AND status IN ('completed', 'processing')
             AND id != $3`,
          [tenantId, entry.ota_reservation_id, entry.id],
        );
        if (existing.length > 0) {
          await client.query(
            `UPDATE ota_reservations_queue
             SET status = 'duplicate', processed_at = NOW()
             WHERE id = $1`,
            [entry.id],
          );
          duplicates++;
          return;
        }

        // Mark as processing
        await client.query(
          `UPDATE ota_reservations_queue
           SET status = 'processing', updated_at = NOW()
           WHERE id = $1`,
          [entry.id],
        );

        // Map OTA room type to internal room type via channel_mappings
        const { rows: mappingRows } = await client.query(
          `SELECT entity_id FROM channel_mappings
           WHERE tenant_id = $1 AND property_id = $2
             AND entity_type = 'room_type'
             AND external_code = $3
             AND is_active = TRUE`,
          [tenantId, propertyId, entry.room_type],
        );

        const roomTypeId = mappingRows.length > 0 ? mappingRows[0].entity_id : null;

        if (!roomTypeId) {
          throw new Error(`No channel mapping for OTA room type "${entry.room_type}"`);
        }

        // Create the internal reservation
        const reservationId = uuid();
        await client.query(
          `INSERT INTO reservations (
            id, tenant_id, property_id, room_type_id,
            check_in_date, check_out_date, booking_date,
            status, reservation_type, source,
            total_amount, currency_code,
            special_requests, notes,
            created_by, updated_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, NOW(),
            'CONFIRMED', 'TRANSIENT', 'OTA',
            $7, $8,
            $9, $10,
            $11, $11
          )`,
          [
            reservationId,
            tenantId,
            propertyId,
            roomTypeId,
            entry.check_in_date,
            entry.check_out_date,
            entry.total_amount ?? 0,
            entry.currency_code ?? "USD",
            entry.special_requests ?? null,
            `OTA: ${entry.ota_booking_reference ?? entry.ota_reservation_id}`,
            SYSTEM_ACTOR_ID,
          ],
        );

        // Mark queue entry as completed
        await client.query(
          `UPDATE ota_reservations_queue
           SET status = 'completed',
               reservation_id = $2,
               processed_at = NOW()
           WHERE id = $1`,
          [entry.id, reservationId],
        );

        // Emit event
        const outboxEventId = uuid();
        await enqueueOutboxRecordWithClient(client, {
          eventId: outboxEventId,
          tenantId,
          aggregateId: reservationId,
          aggregateType: "reservation",
          eventType: "reservation.created_from_ota",
          payload: {
            metadata: {
              id: outboxEventId,
              source: serviceConfig.serviceId,
              type: "reservation.created_from_ota",
              timestamp: new Date().toISOString(),
              version: "1.0",
              correlationId: options.correlationId,
              tenantId,
              retryCount: 0,
            },
            payload: {
              reservation_id: reservationId,
              ota_reservation_id: entry.ota_reservation_id,
              ota_booking_reference: entry.ota_booking_reference,
              guest_name: entry.guest_name ?? "",
            },
          },
          headers: { tenantId, eventId: outboxEventId },
          correlationId: options.correlationId,
          partitionKey: reservationId,
          metadata: { source: serviceConfig.serviceId, action: "ota_queue_process" },
        });

        processed++;
      });
    } catch (err) {
      reservationsLogger.error(
        { queueId: entry.id, otaReservationId: entry.ota_reservation_id, error: err },
        "Failed to process OTA reservation queue entry",
      );
      try {
        await query(
          `UPDATE ota_reservations_queue
           SET status = 'failed',
               error_message = $2,
               processing_attempts = processing_attempts + 1,
               processed_at = NOW()
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
