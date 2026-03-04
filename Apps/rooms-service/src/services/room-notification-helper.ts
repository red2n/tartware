import crypto from "node:crypto";

import { config } from "../config.js";
import { publishEvent } from "../kafka/producer.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "room-notification-helper" });

type NotificationPayload = {
  tenantId: string;
  propertyId: string;
  guestId: string;
  reservationId?: string;
  templateCode: string;
  recipientName?: string;
  recipientEmail?: string;
  context: Record<string, string | number | boolean | null>;
  idempotencyKey: string;
  initiatedBy?: { userId?: string } | null;
};

/**
 * Publish a `notification.send` command to the command center topic.
 *
 * Best-effort: failures are logged but do not propagate to the caller
 * since the primary room operation has already succeeded.
 */
export const publishNotificationCommand = async (params: NotificationPayload): Promise<void> => {
  const commandId = crypto.randomUUID();
  try {
    await publishEvent({
      topic: config.commandCenter.topic,
      key: commandId,
      value: JSON.stringify({
        metadata: {
          commandId,
          commandName: "notification.send",
          tenantId: params.tenantId,
          targetService: "notification-service",
          targetTopic: config.commandCenter.topic,
          issuedAt: new Date().toISOString(),
          route: { id: "system", source: "internal", tenantId: null },
          initiatedBy: params.initiatedBy ?? {
            userId: "00000000-0000-0000-0000-000000000000",
            role: "SYSTEM",
          },
          featureStatus: "enabled",
        },
        payload: {
          property_id: params.propertyId,
          guest_id: params.guestId,
          reservation_id: params.reservationId ?? null,
          template_code: params.templateCode,
          recipient_name: params.recipientName ?? null,
          recipient_email: params.recipientEmail ?? null,
          context: params.context,
          idempotency_key: params.idempotencyKey,
        },
      }),
      headers: {
        "x-command-name": "notification.send",
        "x-command-tenant-id": params.tenantId,
        "x-command-request-id": commandId,
        "x-command-target": "notification-service",
      },
    });
    logger.info(
      { commandId, templateCode: params.templateCode, guestId: params.guestId },
      "Room notification command published",
    );
  } catch (err) {
    logger.warn(
      { err, templateCode: params.templateCode, guestId: params.guestId },
      "Failed to publish room notification command (best-effort)",
    );
  }
};

type ArrivingReservation = {
  id: string;
  guest_id: string;
  property_id: string;
  confirmation_number: string;
  room_type_name: string;
  guest_name: string;
  guest_email: string | null;
  check_in_date: string;
  check_out_date: string;
};

/**
 * Find today's arriving reservation assigned to a given room.
 *
 * Returns the first matching reservation with status CONFIRMED or PENDING
 * whose check-in date is today and whose room_number matches the supplied
 * room_number. Returns `null` when no match is found.
 */
export const findArrivingReservation = async (
  tenantId: string,
  roomNumber: string,
): Promise<ArrivingReservation | null> => {
  const { rows } = await query<ArrivingReservation>(
    `SELECT
       r.id,
       r.guest_id,
       r.property_id,
       r.confirmation_number,
       COALESCE(rt.name, '') AS room_type_name,
       COALESCE(g.first_name || ' ' || g.last_name, 'Guest') AS guest_name,
       g.email AS guest_email,
       r.check_in_date::text AS check_in_date,
       r.check_out_date::text AS check_out_date
     FROM public.reservations r
     LEFT JOIN public.room_types rt ON rt.id = r.room_type_id AND rt.tenant_id = r.tenant_id
     LEFT JOIN public.guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id
     WHERE r.tenant_id = $1::uuid
       AND r.room_number = $2
       AND r.check_in_date::date = CURRENT_DATE
       AND r.status IN ('CONFIRMED', 'PENDING')
       AND COALESCE(r.is_deleted, false) = false
     ORDER BY r.created_at ASC
     LIMIT 1`,
    [tenantId, roomNumber],
  );
  return rows[0] ?? null;
};
