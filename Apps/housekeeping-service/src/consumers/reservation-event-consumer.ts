/**
 * Reservation Event Consumer — listens to reservation lifecycle events
 * and auto-creates housekeeping tasks on checkout.
 *
 * Cross-flow integration (Flow 7 → Flow 8):
 *   - reservation.checked_out → housekeeping.task.create (CHECKOUT_CLEAN, priority HIGH)
 *
 * Uses a SEPARATE consumer group from other services consuming the same topic
 * to enable independent fan-out processing.
 *
 * @module consumers/reservation-event-consumer
 */
import { enterTenantScope } from "@tartware/config/db";
import { ReservationEventSchema } from "@tartware/schemas";
import type { Consumer, EachMessagePayload } from "kafkajs";

import { kafka } from "../kafka/client.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "reservation-event-consumer" });

const EVENTS_TOPIC = "reservations.events";
const CONSUMER_GROUP = "housekeeping-reservation-events-consumer";

let consumer: Consumer | null = null;

/**
 * Resolve room_id from reservation to get the room for housekeeping task creation.
 */
const resolveRoomFromReservation = async (
  tenantId: string,
  reservationId: string,
): Promise<{ roomId: string; propertyId: string } | null> => {
  const result = await query<{ room_id: string; property_id: string }>(
    `SELECT room_id, property_id FROM reservations
     WHERE id = $1::uuid AND tenant_id = $2::uuid AND room_id IS NOT NULL
     LIMIT 1`,
    [reservationId, tenantId],
  );
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  if (!row) return null;
  return { roomId: row.room_id, propertyId: row.property_id };
};

/**
 * Check if a housekeeping task already exists for this room + date (idempotency).
 */
const taskAlreadyExists = async (
  tenantId: string,
  roomId: string,
  taskDate: string,
): Promise<boolean> => {
  const { rows } = await query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM housekeeping_tasks
     WHERE tenant_id = $1::uuid
       AND room_number = (SELECT room_number FROM rooms WHERE id = $2::uuid AND tenant_id = $1::uuid LIMIT 1)
       AND task_type = 'CHECKOUT_CLEAN'
       AND scheduled_date = $3::date
       AND status NOT IN ('CANCELLED')`,
    [tenantId, roomId, taskDate],
  );
  return Number(rows[0]?.cnt ?? 0) > 0;
};

/**
 * Create a housekeeping task for a room after checkout.
 */
const createCheckoutCleanTask = async (
  tenantId: string,
  roomId: string,
  propertyId: string,
): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);

  // Idempotency: skip if task already exists for this room today
  if (await taskAlreadyExists(tenantId, roomId, today)) {
    logger.debug({ roomId, tenantId }, "Checkout clean task already exists — skipping");
    return;
  }

  // Resolve room_number from room_id
  const { rows: roomRows } = await query<{ room_number: string }>(
    `SELECT room_number FROM rooms WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
    [roomId, tenantId],
  );
  if (roomRows.length === 0) {
    logger.warn({ roomId, tenantId }, "Room not found for checkout clean task");
    return;
  }
  const roomNumber = roomRows[0]?.room_number;

  await query(
    `INSERT INTO public.housekeeping_tasks (
       tenant_id, property_id, room_number, task_type, priority,
       status, scheduled_date, notes, created_at, updated_at, created_by, updated_by
     ) VALUES (
       $1::uuid, $2::uuid, $3, 'CHECKOUT_CLEAN', 'high',
       'DIRTY', $4::date, 'Auto-created on guest checkout', NOW(), NOW(),
       'system:checkout-event', 'system:checkout-event'
     )`,
    [tenantId, propertyId, roomNumber, today],
  );

  logger.info(
    { roomId, roomNumber, propertyId, tenantId },
    "Created CHECKOUT_CLEAN housekeeping task from checkout event",
  );
};

/**
 * Classify a reservation.updated event — detect checkout.
 */
const isCheckoutEvent = (payload: Record<string, unknown>): boolean => {
  return payload.status === "CHECKED_OUT" && !!payload.actual_check_out;
};

/**
 * Process a single reservation event for housekeeping integration.
 */
const processEvent = async (rawValue: string): Promise<void> => {
  let event: ReturnType<typeof ReservationEventSchema.parse>;
  try {
    event = ReservationEventSchema.parse(JSON.parse(rawValue));
  } catch {
    logger.debug("Skipping unparseable reservation event");
    return;
  }

  const tenantId = event.metadata.tenantId;
  if (!tenantId) return;

  enterTenantScope(tenantId);

  // Handle reservation.updated events — detect checkout
  if (event.metadata.type === "reservation.updated") {
    const payload = event.payload as Record<string, unknown>;

    if (isCheckoutEvent(payload)) {
      const reservationId = payload.reservation_id as string;
      if (!reservationId) return;

      const roomInfo = await resolveRoomFromReservation(tenantId, reservationId);
      if (!roomInfo) {
        logger.debug({ reservationId }, "No room assigned — skipping checkout clean task");
        return;
      }

      await createCheckoutCleanTask(tenantId, roomInfo.roomId, roomInfo.propertyId);
    }
  }
};

export const startReservationEventConsumer = async (): Promise<void> => {
  if (consumer) return;

  consumer = kafka.consumer({
    groupId: CONSUMER_GROUP,
    allowAutoTopicCreation: false,
  });

  await consumer.connect();
  await consumer.subscribe({ topic: EVENTS_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) return;

      try {
        await processEvent(message.value.toString());
      } catch (err) {
        logger.error(
          { err, offset: message.offset },
          "Reservation event consumer: failed to process event",
        );
        // Non-fatal — commit offset and continue.
      }
    },
  });

  logger.info(
    { topic: EVENTS_TOPIC, groupId: CONSUMER_GROUP },
    "Housekeeping reservation event consumer started",
  );
};

export const shutdownReservationEventConsumer = async (): Promise<void> => {
  if (!consumer) return;
  try {
    await consumer.disconnect();
  } catch (err) {
    logger.error({ err }, "Error disconnecting reservation event consumer");
  }
  consumer = null;
};
