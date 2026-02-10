import { v4 as uuid } from "uuid";

import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import {
  fetchReservationStaySnapshot,
} from "../../repositories/reservation-repository.js";
import type {
  ReservationWaitlistAddCommand,
  ReservationWaitlistConvertCommand,
  ReservationWaitlistExpireSweepCommand,
  ReservationWaitlistOfferCommand,
} from "../../schemas/reservation-command.js";
import {
  ReservationCommandError,
  type CreateReservationResult,
  SYSTEM_ACTOR_ID,
} from "./common.js";
import { createReservation } from "./core.js";

/**
 * Add a guest to the waitlist for a sold-out date/room type.
 * Inserts a row into the waitlist_entries table.
 */
export const waitlistAdd = async (
  tenantId: string,
  command: ReservationWaitlistAddCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const waitlistId = uuid();

  const arrivalDate = new Date(command.arrival_date);
  const departureDate = new Date(command.departure_date);
  if (departureDate <= arrivalDate) {
    throw new ReservationCommandError("INVALID_DATES", "departure_date must be after arrival_date");
  }

  await query(
    `INSERT INTO waitlist_entries (
      waitlist_id, tenant_id, property_id, guest_id,
      requested_room_type_id, requested_rate_id,
      arrival_date, departure_date,
      number_of_rooms, number_of_adults, number_of_children,
      flexibility, waitlist_status, vip_flag, notes,
      created_at
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6,
      $7, $8,
      $9, $10, $11,
      $12, 'ACTIVE', $13, $14,
      NOW()
    )`,
    [
      waitlistId,
      tenantId,
      command.property_id,
      command.guest_id,
      command.requested_room_type_id,
      command.requested_rate_id ?? null,
      arrivalDate.toISOString().slice(0, 10),
      departureDate.toISOString().slice(0, 10),
      command.number_of_rooms ?? 1,
      command.number_of_adults ?? 1,
      command.number_of_children ?? 0,
      command.flexibility ?? "NONE",
      command.vip_flag ?? false,
      command.notes ?? null,
    ],
  );

  reservationsLogger.info(
    {
      waitlistId,
      guestId: command.guest_id,
      roomTypeId: command.requested_room_type_id,
      arrivalDate: arrivalDate.toISOString().slice(0, 10),
    },
    "Guest added to waitlist",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Convert a waitlist entry into a confirmed reservation.
 * Marks the waitlist entry as CONFIRMED and creates a new reservation
 * through the normal creation pipeline.
 */
export const waitlistConvert = async (
  tenantId: string,
  command: ReservationWaitlistConvertCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  // 1. Fetch waitlist entry
  const wlResult = await query(
    `SELECT waitlist_id, guest_id, requested_room_type_id, requested_rate_id,
            arrival_date, departure_date, number_of_adults, number_of_children,
            waitlist_status, notes
     FROM waitlist_entries
     WHERE waitlist_id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false
     LIMIT 1`,
    [command.waitlist_id, tenantId],
  );
  const entry = wlResult.rows?.[0] as
    | {
        waitlist_id: string;
        guest_id: string;
        requested_room_type_id: string;
        requested_rate_id: string | null;
        arrival_date: Date;
        departure_date: Date;
        number_of_adults: number;
        number_of_children: number;
        waitlist_status: string;
        notes: string | null;
      }
    | undefined;

  if (!entry) {
    throw new ReservationCommandError(
      "WAITLIST_NOT_FOUND",
      `Waitlist entry ${command.waitlist_id} not found`,
    );
  }
  if (entry.waitlist_status !== "ACTIVE" && entry.waitlist_status !== "OFFERED") {
    throw new ReservationCommandError(
      "INVALID_WAITLIST_STATUS",
      `Cannot convert waitlist with status ${entry.waitlist_status}; must be ACTIVE or OFFERED`,
    );
  }

  // 2. Mark waitlist entry as CONFIRMED
  await query(
    `UPDATE waitlist_entries
     SET waitlist_status = 'CONFIRMED', updated_at = NOW()
     WHERE waitlist_id = $1 AND tenant_id = $2`,
    [command.waitlist_id, tenantId],
  );

  // 3. Create reservation via the normal pipeline
  const roomTypeId = command.room_type_id ?? entry.requested_room_type_id;
  const result = await createReservation(
    tenantId,
    {
      property_id: command.property_id,
      guest_id: entry.guest_id,
      room_type_id: roomTypeId,
      check_in_date: entry.arrival_date,
      check_out_date: entry.departure_date,
      rate_code: command.rate_code,
      allow_rate_fallback: command.allow_rate_fallback,
      total_amount: command.total_amount,
      currency: command.currency,
      notes: command.notes ?? entry.notes ?? undefined,
      source: "DIRECT",
      reservation_type: "TRANSIENT",
    },
    options,
  );

  // 4. Link waitlist entry to the new reservation
  try {
    await query(
      `UPDATE waitlist_entries SET reservation_id = $3, updated_at = NOW()
       WHERE waitlist_id = $1 AND tenant_id = $2`,
      [command.waitlist_id, tenantId, result.eventId],
    );
  } catch {
    // Non-critical
  }

  reservationsLogger.info(
    { waitlistId: command.waitlist_id, guestId: entry.guest_id },
    "Waitlist entry converted to reservation",
  );

  return result;
};

// ─── S21: Waitlist Auto-Offer ───────────────────────────────────────────────────

/**
 * Offer a freed room to a waitlisted guest.
 * Transitions the waitlist entry from ACTIVE → OFFERED, records
 * offer_expiration_at and notification timestamp.
 */
export const waitlistOffer = async (
  tenantId: string,
  command: ReservationWaitlistOfferCommand,
  _context?: { correlationId?: string },
): Promise<{ eventId: string; status: string }> => {
  // 1. Verify entry exists and is ACTIVE
  const { rows: entryRows } = await query<Record<string, unknown>>(
    `SELECT waitlist_id, waitlist_status, guest_id, requested_room_type_id,
           arrival_date, departure_date
     FROM waitlist_entries
     WHERE waitlist_id = $1 AND tenant_id = $2 AND is_deleted = false`,
    [command.waitlist_id, tenantId],
  );
  const entry = entryRows[0];
  if (!entry) {
    throw new ReservationCommandError(
      "WAITLIST_NOT_FOUND",
      `Waitlist entry ${command.waitlist_id} not found`,
    );
  }
  if (entry.waitlist_status !== "ACTIVE") {
    throw new ReservationCommandError(
      "INVALID_WAITLIST_STATUS",
      `Cannot offer to waitlist with status ${entry.waitlist_status}; must be ACTIVE`,
    );
  }

  // 2. Compute offer expiration
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + command.offer_ttl_hours);

  // 3. Transition ACTIVE → OFFERED
  await query(
    `UPDATE waitlist_entries
     SET waitlist_status = 'OFFERED',
         offer_expiration_at = $3,
         offer_response = 'PENDING',
         last_notified_at = NOW(),
         last_notified_via = $4,
         updated_at = NOW()
     WHERE waitlist_id = $1 AND tenant_id = $2`,
    [command.waitlist_id, tenantId, expiresAt.toISOString(), command.notify_via],
  );

  reservationsLogger.info(
    {
      waitlistId: command.waitlist_id,
      guestId: entry.guest_id,
      expiresAt: expiresAt.toISOString(),
      notifyVia: command.notify_via,
    },
    "Waitlist offer extended to guest",
  );

  return { eventId: command.waitlist_id, status: "offered" };
};

/**
 * Sweep expired waitlist offers. Finds all OFFERED entries past their
 * offer_expiration_at and transitions them to EXPIRED. If auto_reoffer
 * is true, automatically offers to the next highest-priority ACTIVE entry
 * for the same property/room-type/date-range.
 */
export const waitlistExpireSweep = async (
  tenantId: string,
  command: ReservationWaitlistExpireSweepCommand,
  _context?: { correlationId?: string },
): Promise<{ expired: number; reoffered: number }> => {
  // 1. Find expired offers
  const { rows: expiredRows } = await query<Record<string, unknown>>(
    `SELECT waitlist_id, guest_id, requested_room_type_id, arrival_date, departure_date
     FROM waitlist_entries
     WHERE tenant_id = $1 AND property_id = $2
       AND waitlist_status = 'OFFERED'
       AND offer_expiration_at < NOW()
       AND is_deleted = false
     ORDER BY offer_expiration_at ASC`,
    [tenantId, command.property_id],
  );

  if (command.dry_run) {
    return { expired: expiredRows.length, reoffered: 0 };
  }

  let expired = 0;
  let reoffered = 0;

  for (const row of expiredRows) {
    // 2. Mark as EXPIRED
    await query(
      `UPDATE waitlist_entries
       SET waitlist_status = 'EXPIRED',
           offer_response = 'EXPIRED',
           offer_response_at = NOW(),
           updated_at = NOW()
       WHERE waitlist_id = $1 AND tenant_id = $2`,
      [row.waitlist_id, tenantId],
    );
    expired++;

    // 3. Auto-reoffer to next highest-priority ACTIVE entry
    if (command.auto_reoffer) {
      const { rows: nextRows } = await query<Record<string, unknown>>(
        `SELECT waitlist_id FROM waitlist_entries
         WHERE tenant_id = $1 AND property_id = $2
           AND waitlist_status = 'ACTIVE'
           AND requested_room_type_id = $3
           AND arrival_date <= $4 AND departure_date >= $5
           AND is_deleted = false
         ORDER BY priority_score DESC, vip_flag DESC, created_at ASC
         LIMIT 1`,
        [
          tenantId,
          command.property_id,
          row.requested_room_type_id,
          row.arrival_date,
          row.departure_date,
        ],
      );

      if (nextRows[0]) {
        await waitlistOffer(tenantId, {
          waitlist_id: nextRows[0].waitlist_id as string,
          property_id: command.property_id,
          offer_ttl_hours: 24,
          notify_via: "EMAIL",
        });
        reoffered++;
      }
    }
  }

  reservationsLogger.info(
    { propertyId: command.property_id, expired, reoffered },
    "Waitlist expire sweep completed",
  );

  return { expired, reoffered };
};
