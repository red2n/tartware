import { CommandError } from "@tartware/command-consumer-utils/command-utils";
import type {
  CreateFolioParams,
  ReservationCancelledEvent,
  ReservationCreatedEvent,
  ReservationEvent,
  ReservationEventHandlerResult,
  ReservationUpdatedEvent,
} from "@tartware/schemas";
import { expandStayPlan, StayPlanError } from "@tartware/schemas";
import type { PoolClient } from "pg";

import { query, withTransaction } from "../lib/db.js";
import { reservationsLogger } from "../logger.js";
import {
  resyncStayWindow,
  syncReservationTotalsFromNights,
  writeReservationStay,
} from "../repositories/reservation-stay-repository.js";

import { dispatchNotificationCommand } from "./reservation-commands/notification-dispatch.js";

/**
 * ReservationEventError — see {@link CommandError} for the `retryable` contract
 * the command consumer reads when deciding retry vs DLQ.
 */
class ReservationEventError extends CommandError {}

/**
 * MED-008 + N+1 elimination: Validate property belongs to tenant AND fetch
 * guest details in a single round-trip. Property validation is mandatory
 * (raises if missing); guest is best-effort (falls back to "Unknown Guest"
 * if the guest row hasn't replicated yet).
 *
 * Hot path: called once per `reservation.created` event. At 20K ops/sec this
 * replaces 2 sequential SELECTs with one.
 */
const validateAndFetchGuest = async (
  tenantId: string,
  propertyId: string,
  guestId: string,
): Promise<{
  first_name: string | null;
  last_name: string | null;
  email: string | null;
} | null> => {
  const { rows } = await query<{
    property_exists: boolean;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }>(
    `
      SELECT
        TRUE AS property_exists,
        g.first_name,
        g.last_name,
        g.email
      FROM properties p
      LEFT JOIN guests g
        ON g.id = $3::uuid AND g.tenant_id = $1::uuid
      WHERE p.id = $2::uuid AND p.tenant_id = $1::uuid
      LIMIT 1
    `,
    [tenantId, propertyId, guestId],
  );

  if (rows.length === 0) {
    throw new ReservationEventError(
      "PROPERTY_NOT_FOUND_FOR_TENANT",
      `Property ${propertyId} does not belong to tenant ${tenantId}`,
    );
  }

  const row = rows[0];
  // No guest match → callers fall back to placeholder name/email.
  if (!row || row.first_name === null) {
    return null;
  }
  return { first_name: row.first_name, last_name: row.last_name, email: row.email };
};

/**
 * MED-008: Validate that property_id belongs to the given tenant
 * to prevent cross-tenant data pollution from malformed events
 */
const validatePropertyBelongsToTenant = async (
  tenantId: string,
  propertyId: string,
): Promise<void> => {
  const { rowCount } = await query(
    `SELECT 1 FROM properties WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [propertyId, tenantId],
  );
  if (!rowCount || rowCount === 0) {
    throw new ReservationEventError(
      "PROPERTY_NOT_FOUND_FOR_TENANT",
      `Property ${propertyId} does not belong to tenant ${tenantId}`,
    );
  }
};

/**
 * Route reservation events to the appropriate handler.
 */
export const processReservationEvent = async (
  event: ReservationEvent,
): Promise<ReservationEventHandlerResult> => {
  const eventType = event.metadata.type;
  switch (eventType) {
    case "reservation.created":
      return {
        reservationId: await handleReservationCreated(event as ReservationCreatedEvent),
      };
    case "reservation.updated":
      return {
        reservationId: await handleReservationUpdated(event as ReservationUpdatedEvent),
      };
    case "reservation.cancelled":
      return {
        reservationId: await handleReservationCancelled(event as ReservationCancelledEvent),
      };
    default:
      reservationsLogger.warn({ eventType }, "Unhandled reservation event type");
      return {};
  }
};

/**
 * `reservation_rooms.status` is the per-room lifecycle, which is narrower than
 * the reservation's own: a room is never INQUIRY, QUOTED, WAITLISTED or
 * EXPIRED. Anything outside the room lifecycle starts the room at PENDING.
 */
const ROOM_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
]);

const toRoomStatus = (reservationStatus: string | undefined): string =>
  reservationStatus && ROOM_STATUSES.has(reservationStatus) ? reservationStatus : "PENDING";

const handleReservationCreated = async (event: ReservationCreatedEvent): Promise<string> => {
  const payload = event.payload;
  const tenantId = event.metadata.tenantId;
  // Use metadata.id as fallback — core.ts sets aggregateId = payload.id ?? eventId,
  // and eventId === metadata.id, so this keeps the reservation ID consistent across services.
  const reservationId = payload.id ?? event.metadata.id;
  const confirmation =
    (payload as { confirmation_number?: string }).confirmation_number ??
    `TW-${reservationId.slice(0, 8).toUpperCase()}`;

  // MED-008 + N+1 fix: Validate property and fetch guest in ONE round-trip
  // (was 2 sequential SELECTs).
  const guest = await validateAndFetchGuest(tenantId, payload.property_id, payload.guest_id);
  const guestName = guest
    ? `${guest.first_name ?? ""} ${guest.last_name ?? ""}`.trim()
    : "Unknown Guest";
  const guestEmail = guest?.email ?? "unknown@unknown.com";

  const checkIn = new Date(payload.check_in_date);
  const checkOut = new Date(payload.check_out_date);
  const totalAmount = Number(payload.total_amount ?? 0);
  const currency = payload.currency ?? "USD";

  // The stay is the source of truth for what this booking holds and what it
  // costs. `rooms` on the event is what the command accepted; when it is
  // absent this expands to the pre-multi-room shape — one room for the whole
  // window at an even split of total_amount — so an old producer keeps
  // working unchanged.
  let plan: ReturnType<typeof expandStayPlan>;
  try {
    plan = expandStayPlan(
      {
        check_in_date: checkIn,
        check_out_date: checkOut,
        room_type_id: payload.room_type_id,
        guest_id: payload.guest_id,
        currency,
        rate_code: payload.rate_code,
        total_amount: totalAmount,
      },
      payload.rooms,
    );
  } catch (error) {
    if (error instanceof StayPlanError) {
      // A plan this malformed will never expand, however many times it is
      // redelivered — fail it straight to the DLQ rather than burn the ladder.
      throw new ReservationEventError(error.code, error.message);
    }
    throw error;
  }

  // `reservations.room_rate` is the deprecated scalar kept for readers that
  // have not moved to reservation_nights yet. The first night of the first
  // room is the advertised nightly rate; total_amount / nights stopped being
  // that the moment a booking could hold more than one room.
  const roomRate = plan.rooms[0]?.nights[0]?.rate_amount ?? 0;

  await withTransaction(async (client) => {
    await client.query(
      `
      INSERT INTO reservations (
        id,
        tenant_id,
        property_id,
        guest_id,
        room_type_id,
        check_in_date,
        check_out_date,
        booking_date,
        status,
        source,
        reservation_type,
        room_rate,
        total_amount,
        currency,
        guest_name,
        guest_email,
        confirmation_number,
        cancellation_policy_snapshot,
        market_segment_id,
        eta,
        company_id,
        travel_agent_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19,
        $20::time, $21, $22, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE
        SET
          property_id = EXCLUDED.property_id,
          guest_id = EXCLUDED.guest_id,
          room_type_id = EXCLUDED.room_type_id,
          check_in_date = EXCLUDED.check_in_date,
          check_out_date = EXCLUDED.check_out_date,
          booking_date = EXCLUDED.booking_date,
          status = EXCLUDED.status,
          source = EXCLUDED.source,
          reservation_type = EXCLUDED.reservation_type,
          room_rate = EXCLUDED.room_rate,
          total_amount = EXCLUDED.total_amount,
          currency = EXCLUDED.currency,
          guest_name = EXCLUDED.guest_name,
          guest_email = EXCLUDED.guest_email,
          confirmation_number = EXCLUDED.confirmation_number,
          -- Never overwrite a non-null snapshot with null on event re-delivery.
          cancellation_policy_snapshot = COALESCE(reservations.cancellation_policy_snapshot, EXCLUDED.cancellation_policy_snapshot),
          -- Same reasoning: a re-delivered event without a segment must not
          -- erase an attribution that was already recorded.
          market_segment_id = COALESCE(reservations.market_segment_id, EXCLUDED.market_segment_id),
          eta = COALESCE(EXCLUDED.eta, reservations.eta),
          company_id = COALESCE(reservations.company_id, EXCLUDED.company_id),
          travel_agent_id = COALESCE(reservations.travel_agent_id, EXCLUDED.travel_agent_id),
          updated_at = NOW();
    `,
      [
        reservationId,
        tenantId,
        payload.property_id,
        payload.guest_id,
        payload.room_type_id,
        payload.check_in_date,
        payload.check_out_date,
        payload.booking_date ?? new Date().toISOString(),
        payload.status ?? "PENDING",
        payload.source ?? "DIRECT",
        (payload as { reservation_type?: string }).reservation_type ?? "TRANSIENT",
        roomRate,
        totalAmount,
        payload.currency ?? "USD",
        guestName,
        guestEmail,
        confirmation,
        payload.cancellation_policy_snapshot
          ? JSON.stringify(payload.cancellation_policy_snapshot)
          : null,
        payload.market_segment_id ?? null,
        payload.eta ?? null,
        payload.company_id ?? null,
        payload.travel_agent_id ?? null,
      ],
    );

    // Rooms, nights and occupants share the reservation's transaction: a room
    // with no nights, or nights with no room, is not a state any reader should
    // ever observe.
    await writeReservationStay(client, {
      tenantId,
      propertyId: payload.property_id,
      reservationId,
      plan,
      status: toRoomStatus(payload.status),
      fallbackName: guestName,
      fallbackEmail: guestEmail,
    });
  });

  // N+1 fix: Auto-create folio AND increment guest booking count in parallel.
  // Both are best-effort (errors are logged inside each helper, never thrown);
  // running concurrently saves one DB round-trip on the hot path.
  await Promise.all([
    createFolioForReservation({
      reservationId,
      tenantId,
      propertyId: payload.property_id,
      guestId: payload.guest_id,
      guestName,
      currency: payload.currency ?? "USD",
    }),
    incrementGuestBookingCount(tenantId, payload.guest_id),
    linkWaitlistEntry(tenantId, reservationId, (payload as { waitlist_id?: string }).waitlist_id),
  ]);

  return reservationId;
};

/**
 * Point a converted waitlist entry at the reservation it produced.
 *
 * This has to happen here rather than in the convert command: that command only
 * emits reservation.created, so waitlist_entries.reservation_id has no row to
 * reference until the insert above has run. Best-effort like the folio and
 * booking-count writes beside it — a missing link is not worth failing an
 * otherwise good booking over — but it is logged, never swallowed.
 */
const linkWaitlistEntry = async (
  tenantId: string,
  reservationId: string,
  waitlistId: string | undefined,
): Promise<void> => {
  if (!waitlistId) return;
  try {
    await query(
      `UPDATE waitlist_entries
          SET reservation_id = $3, updated_at = NOW()
        WHERE waitlist_id = $1 AND tenant_id = $2`,
      [waitlistId, tenantId, reservationId],
    );
  } catch (error) {
    reservationsLogger.warn(
      { err: error, waitlistId, reservationId },
      "Reservation created but the waitlist entry could not be linked to it",
    );
  }
};

/**
 * Carry a reservation's lifecycle down to its rooms.
 *
 * `reservation_rooms.status` was written once at creation and never again, so
 * every room row froze at its booking status while the reservation moved on: a
 * checked-in guest's room still read CONFIRMED. Anything gating on the per-room
 * status — a room move, per-room reporting — saw a stay that had never started.
 *
 * Rows already carrying the target status are skipped, which is what keeps a
 * part-checked-in three-room booking expressible: the column exists precisely
 * so rooms can differ from each other.
 */
const propagateRoomStatus = async (
  client: PoolClient,
  tenantId: string,
  reservationId: string,
  reservationStatus: string,
): Promise<void> => {
  await client.query(
    `UPDATE public.reservation_rooms
        SET status = $3,
            updated_at = NOW()
      WHERE tenant_id = $2::uuid
        AND reservation_id = $1::uuid
        AND status <> $3
        AND COALESCE(is_deleted, false) = false`,
    [reservationId, tenantId, toRoomStatus(reservationStatus)],
  );
};

/**
 * Record which physical room a booking's room row was given.
 *
 * Check-in and assign-room wrote the number onto `reservations` and stopped, so
 * `reservation_rooms.room_id` stayed NULL for the life of the stay. Everything
 * that works from the room row rather than the booking — a room move needing to
 * know which room to vacate, per-room housekeeping — saw an unassigned room for
 * a guest who was demonstrably in one.
 *
 * Only rows without an assignment are filled. A booking holding three rooms
 * must not have all three pointed at whichever room this event mentions, and a
 * room already assigned is changed by a move, not by a status update.
 */
const propagateRoomAssignment = async (
  client: PoolClient,
  tenantId: string,
  reservationId: string,
  roomId: string,
  roomNumber: string | null,
): Promise<void> => {
  await client.query(
    `UPDATE public.reservation_rooms
        SET room_id = $3::uuid,
            room_number = COALESCE($4, room_number),
            updated_at = NOW()
      WHERE tenant_id = $2::uuid
        AND reservation_id = $1::uuid
        AND room_id IS NULL
        AND COALESCE(is_deleted, false) = false`,
    [reservationId, tenantId, roomId, roomNumber],
  );
};

/** `metadata.room_id` is where the check-in and assign commands put it. */
const roomIdFromPayload = (payload: { metadata?: unknown }): string | null => {
  const meta = payload.metadata;
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as { room_id?: unknown }).room_id;
  return typeof value === "string" && value.length > 0 ? value : null;
};

const handleReservationUpdated = async (event: ReservationUpdatedEvent): Promise<string> => {
  const payload = event.payload;
  const tenantId = event.metadata.tenantId;
  const fields: string[] = [];
  const values: unknown[] = [payload.id, tenantId];

  const addField = (column: string, value: unknown) => {
    fields.push(`${column} = $${fields.length + 3}`);
    values.push(value);
  };

  // MED-008: Validate property belongs to tenant if property_id is being changed
  if (payload.property_id !== undefined) {
    await validatePropertyBelongsToTenant(tenantId, payload.property_id);
    addField("property_id", payload.property_id);
  }
  if (payload.guest_id !== undefined) addField("guest_id", payload.guest_id);
  if (payload.room_type_id !== undefined) addField("room_type_id", payload.room_type_id);
  if (payload.check_in_date !== undefined) addField("check_in_date", payload.check_in_date);
  if (payload.check_out_date !== undefined) addField("check_out_date", payload.check_out_date);
  if (payload.actual_check_in !== undefined) addField("actual_check_in", payload.actual_check_in);
  if (payload.actual_check_out !== undefined)
    addField("actual_check_out", payload.actual_check_out);
  if (payload.room_number !== undefined) addField("room_number", payload.room_number);
  if (payload.status !== undefined) addField("status", payload.status);
  if (payload.source !== undefined) addField("source", payload.source);
  if (payload.total_amount !== undefined)
    addField("total_amount", Number(payload.total_amount ?? 0));
  if (payload.currency !== undefined) addField("currency", payload.currency);
  if (payload.internal_notes !== undefined) addField("internal_notes", payload.internal_notes);
  if (payload.market_segment_id !== undefined)
    addField("market_segment_id", payload.market_segment_id);
  if (payload.metadata !== undefined) {
    const index = fields.length + 3;
    fields.push(`metadata = COALESCE(metadata, '{}'::jsonb) || $${index}::jsonb`);
    values.push(JSON.stringify(payload.metadata ?? {}));
  }
  if ((payload as { confirmation_number?: string }).confirmation_number !== undefined) {
    addField(
      "confirmation_number",
      (payload as { confirmation_number?: string }).confirmation_number,
    );
  }

  if (fields.length === 0) {
    return payload.id;
  }

  const sql = `
    UPDATE reservations
    SET ${fields.join(", ")}, version = version + 1, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
  `;

  // A stay-date change is a diff over reservation_nights, not an overwrite of
  // a scalar: extend inserts the nights the window gained, shorten deletes the
  // ones it lost, and the surviving nights keep the price they were booked at.
  // Both halves share the reservation's transaction so the row and its nights
  // can never disagree about how long the stay is.
  const stayWindowChanged =
    payload.check_in_date !== undefined || payload.check_out_date !== undefined;

  if (!stayWindowChanged) {
    const assignedRoomId = roomIdFromPayload(payload);
    if (payload.status || assignedRoomId) {
      // The row and its rooms must not be able to disagree, so they move
      // together even on the path that has no stay-window work to do.
      await withTransaction(async (client) => {
        await client.query(sql, values);
        if (payload.status) {
          await propagateRoomStatus(client, tenantId, payload.id, payload.status as string);
        }
        if (assignedRoomId) {
          await propagateRoomAssignment(
            client,
            tenantId,
            payload.id,
            assignedRoomId,
            payload.room_number ?? null,
          );
        }
      });
    } else {
      await query(sql, values);
    }
    return payload.id;
  }

  await withTransaction(async (client) => {
    await client.query(sql, values);

    const { rows } = await client.query<{ check_in_date: Date; check_out_date: Date }>(
      `SELECT check_in_date, check_out_date
         FROM reservations
        WHERE id = $1::uuid AND tenant_id = $2::uuid
        LIMIT 1`,
      [payload.id, tenantId],
    );
    const stay = rows[0];
    if (!stay) {
      throw new ReservationEventError(
        "RESERVATION_NOT_FOUND",
        `Reservation ${payload.id} not found for tenant ${tenantId}`,
      );
    }

    await resyncStayWindow(client, {
      tenantId,
      reservationId: payload.id,
      checkInDate: stay.check_in_date,
      checkOutDate: stay.check_out_date,
    });

    if (payload.status) {
      await propagateRoomStatus(client, tenantId, payload.id, payload.status);
    }
    const assignedRoomId = roomIdFromPayload(payload);
    if (assignedRoomId) {
      await propagateRoomAssignment(
        client,
        tenantId,
        payload.id,
        assignedRoomId,
        payload.room_number ?? null,
      );
    }

    // The caller's own total wins when it sent one; otherwise the nights are
    // the price, which is what makes an extend actually cost more.
    if (payload.total_amount === undefined) {
      await syncReservationTotalsFromNights(client, tenantId, payload.id);
    }
  });

  return payload.id;
};

const handleReservationCancelled = async (event: ReservationCancelledEvent): Promise<string> => {
  const payload = event.payload;
  const tenantId = event.metadata.tenantId;
  await query(
    `
      UPDATE reservations
      SET
        status = 'CANCELLED',
        cancellation_date = $2,
        cancellation_reason = $3,
        cancellation_fee = $4,
        version = version + 1,
        updated_at = NOW()
      WHERE id = $1 AND tenant_id = $5
    `,
    [
      payload.id,
      payload.cancelled_at,
      payload.reason ?? null,
      payload.cancellation_fee ?? null,
      tenantId,
    ],
  );

  // S21: Auto-offer to waitlisted guests when a reservation is cancelled.
  // N+1 fix: a single writable CTE reads the cancelled reservation, picks the
  // top-priority active waitlist entry that overlaps the freed dates, and
  // updates its status to OFFERED in one round-trip (was 3 sequential queries).
  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const { rows: offerRows } = await query<{
      waitlist_id: string;
      guest_id: string;
      property_id: string;
      check_in_date: string;
      check_out_date: string;
    }>(
      `
        WITH res AS (
          SELECT property_id, room_type_id, check_in_date, check_out_date
          FROM reservations
          WHERE id = $1::uuid AND tenant_id = $2::uuid
        ),
        candidate AS (
          SELECT we.waitlist_id
          FROM waitlist_entries we, res
          WHERE we.tenant_id = $2::uuid
            AND we.property_id = res.property_id
            AND we.requested_room_type_id = res.room_type_id
            AND we.waitlist_status = 'ACTIVE'
            AND we.arrival_date <= res.check_in_date
            AND we.departure_date >= res.check_out_date
            AND we.is_deleted = false
          ORDER BY we.priority_score DESC, we.vip_flag DESC, we.created_at ASC
          LIMIT 1
        ),
        offered AS (
          UPDATE waitlist_entries we
          SET waitlist_status = 'OFFERED',
              offer_expiration_at = $3::timestamptz,
              offer_response = 'PENDING',
              last_notified_at = NOW(),
              last_notified_via = 'EMAIL',
              updated_at = NOW()
          WHERE we.waitlist_id = (SELECT waitlist_id FROM candidate)
            AND we.tenant_id = $2::uuid
          RETURNING we.waitlist_id, we.guest_id
        )
        SELECT
          o.waitlist_id,
          o.guest_id,
          r.property_id,
          r.check_in_date::text AS check_in_date,
          r.check_out_date::text AS check_out_date
        FROM offered o
        CROSS JOIN res r
      `,
      [payload.id, tenantId, expiresAt.toISOString()],
    );

    const offer = offerRows[0];
    if (offer) {
      reservationsLogger.info(
        {
          waitlistId: offer.waitlist_id,
          guestId: offer.guest_id,
          reservationId: payload.id,
        },
        "Auto-offered freed room to waitlisted guest after cancellation",
      );

      // S21: Notify the waitlisted guest about the offer
      await dispatchNotificationCommand({
        tenantId,
        guestId: offer.guest_id,
        propertyId: offer.property_id,
        templateCode: "WAITLIST_OFFER",
        waitlistId: offer.waitlist_id,
        arrivalDate: offer.check_in_date,
        departureDate: offer.check_out_date,
        expiresAt: expiresAt.toISOString(),
      });
    }
  } catch (err) {
    // Non-critical: log but don't fail the cancellation
    reservationsLogger.warn(
      { err, reservationId: payload.id },
      "Failed to auto-offer to waitlist after cancellation",
    );
  }

  return payload.id;
};

/**
 * Auto-create a GUEST folio when a reservation is created.
 * PMS industry standard: every reservation must have an associated folio
 * for tracking charges, payments, and settlements throughout the stay.
 *
 * Uses ON CONFLICT to ensure idempotency — duplicate event replays won't
 * create extra folios.
 */
const createFolioForReservation = async (params: CreateFolioParams): Promise<void> => {
  const folioNumber = `F-${params.reservationId.slice(0, 8).toUpperCase()}`;
  const systemActorId = "33333333-3333-3333-3333-333333333333";

  try {
    await query(
      `
        INSERT INTO folios (
          tenant_id,
          property_id,
          folio_number,
          folio_type,
          folio_status,
          reservation_id,
          guest_id,
          guest_name,
          balance,
          total_charges,
          total_payments,
          total_credits,
          currency_code,
          opened_at,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, 'GUEST', 'OPEN',
          $4, $5, $6,
          0.00, 0.00, 0.00, 0.00,
          $7, NOW(), $8, NOW(), NOW()
        )
        ON CONFLICT (tenant_id, property_id, folio_number) DO NOTHING
      `,
      [
        params.tenantId,
        params.propertyId,
        folioNumber,
        params.reservationId,
        params.guestId,
        params.guestName,
        params.currency,
        systemActorId,
      ],
    );
    reservationsLogger.info(
      { reservationId: params.reservationId, folioNumber },
      "Auto-created GUEST folio for reservation",
    );
  } catch (folioError) {
    // Folio creation is important but should not fail the reservation
    reservationsLogger.error(
      { reservationId: params.reservationId, error: folioError },
      "Failed to auto-create folio for reservation — manual creation required",
    );
  }
};

/**
 * Increment guest total_bookings count when a new reservation is created.
 * Part of guest profile statistics (PMS industry standard).
 * total_nights, total_revenue, and last_stay_date are updated at check-out.
 */
const incrementGuestBookingCount = async (tenantId: string, guestId: string): Promise<void> => {
  try {
    await query(
      `
        UPDATE guests
        SET total_bookings = COALESCE(total_bookings, 0) + 1,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
      `,
      [guestId, tenantId],
    );
  } catch (statsError) {
    reservationsLogger.warn(
      { guestId, tenantId, error: statsError },
      "Failed to increment guest booking count — guest profile stats may be stale",
    );
  }
};

/**
 * Update guest stay statistics at check-out.
 * Increments total_nights, total_revenue, and sets last_stay_date.
 */
export const updateGuestStayStats = async (
  tenantId: string,
  guestId: string,
  nights: number,
  revenue: number,
  checkOutDate: Date,
): Promise<void> => {
  try {
    await query(
      `
        UPDATE guests
        SET total_nights = COALESCE(total_nights, 0) + $3,
            total_revenue = COALESCE(total_revenue, 0) + $4,
            last_stay_date = $5,
            version = version + 1,
            updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
      `,
      [guestId, tenantId, nights, revenue, checkOutDate],
    );
  } catch (statsError) {
    reservationsLogger.warn(
      { guestId, tenantId, error: statsError },
      "Failed to update guest stay stats at check-out",
    );
  }
};
