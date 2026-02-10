import {
  type ReservationCreatedEvent,
  ReservationCreatedEventSchema,
  type ReservationUpdatedEvent,
  ReservationUpdatedEventSchema,
} from "@tartware/schemas";
import { v4 as uuid } from "uuid";

import {
  type AvailabilityGuardMetadata,
  lockReservationHold,
  releaseReservationHold,
} from "../../clients/availability-guard-client.js";
import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import { recordLifecyclePersisted } from "../../repositories/lifecycle-repository.js";
import {
  upsertReservationGuardMetadata,
} from "../../repositories/reservation-guard-metadata-repository.js";
import type {
  ReservationCheckInCommand,
  ReservationCheckOutCommand,
  ReservationWalkInCheckInCommand,
} from "../../schemas/reservation-command.js";
import { resolveRatePlan } from "../../services/rate-plan-service.js";
import {
  ReservationCommandError,
  type CreateReservationResult,
  DEFAULT_CURRENCY,
  SYSTEM_ACTOR_ID,
  type ReservationUpdatePayload,
  enqueueReservationUpdate,
  fetchRoomInfo,
  findBestAvailableRoom,
} from "./common.js";

/**
 * Check in a reservation: validates status, assigns room, marks room OCCUPIED.
 * PMS industry standard pre-conditions:
 *  - Reservation must exist and belong to this tenant
 *  - Status must be PENDING or CONFIRMED (not already CHECKED_IN, CANCELLED, etc.)
 *  - If a room_id is provided, the room must be AVAILABLE
 */
export const checkInReservation = async (
  tenantId: string,
  command: ReservationCheckInCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  // 1. Validate reservation exists and status allows check-in
  const resResult = await query(
    `SELECT id, status, room_type_id, guest_id, total_amount, check_in_date, check_out_date,
            property_id, rate_code
     FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = resResult.rows?.[0] as
    | {
        id: string;
        status: string;
        room_type_id: string;
        guest_id: string;
        total_amount: number;
        check_in_date: Date;
        check_out_date: Date;
        property_id: string;
        rate_code: string | null;
      }
    | undefined;

  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  const allowedStatuses = ["PENDING", "CONFIRMED"];
  if (!allowedStatuses.includes(reservation.status)) {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_CHECKIN",
      `Cannot check in reservation with status ${reservation.status}; must be PENDING or CONFIRMED`,
    );
  }

  // 2. Validate room is available and clean if room_id provided.
  //    If no room_id, auto-assign the best available room for this room type.
  let assignedRoomId = command.room_id;
  let assignedRoomNumber: string | null = null;

  if (assignedRoomId) {
    const roomResult = await query(
      `SELECT id, status, room_number FROM rooms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [assignedRoomId, tenantId],
    );
    const room = roomResult.rows?.[0] as
      | { id: string; status: string; room_number: string }
      | undefined;
    if (!room) {
      throw new ReservationCommandError("ROOM_NOT_FOUND", `Room ${assignedRoomId} not found`);
    }
    if (room.status === "DIRTY") {
      throw new ReservationCommandError(
        "ROOM_NOT_CLEAN",
        `Room ${room.room_number} is DIRTY and must be cleaned before check-in`,
      );
    }
    if (room.status === "OUT_OF_ORDER" || room.status === "OUT_OF_SERVICE") {
      throw new ReservationCommandError(
        "ROOM_UNAVAILABLE",
        `Room ${room.room_number} is ${room.status} and cannot accept check-ins`,
      );
    }
    if (room.status !== "AVAILABLE") {
      throw new ReservationCommandError(
        "ROOM_NOT_AVAILABLE",
        `Room ${room.room_number} is ${room.status}, not AVAILABLE`,
      );
    }
    assignedRoomNumber = room.room_number;
  } else {
    // Auto-assign: find the best available room matching the reservation's room type
    const resPropertyResult = await query(
      `SELECT property_id FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [command.reservation_id, tenantId],
    );
    const propertyId = (resPropertyResult.rows?.[0] as { property_id: string } | undefined)
      ?.property_id;
    if (propertyId) {
      const bestRoom = await findBestAvailableRoom(
        tenantId,
        propertyId,
        reservation.room_type_id,
        new Date(reservation.check_in_date),
        new Date(reservation.check_out_date),
      );
      if (bestRoom) {
        assignedRoomId = bestRoom.room_id;
        assignedRoomNumber = bestRoom.room_number;
        reservationsLogger.info(
          { reservationId: command.reservation_id, autoAssigned: bestRoom.room_number },
          "Auto-assigned best available room for check-in",
        );
      } else {
        reservationsLogger.warn(
          { reservationId: command.reservation_id, roomTypeId: reservation.room_type_id },
          "No clean available room found for auto-assignment; proceeding without room",
        );
      }
    }
  }

  // 3. S26: Enforce blocking deposit schedules before check-in
  if (!command.force) {
    try {
      const blockingDeposits = await query<{
        schedule_id: string;
        schedule_type: string;
        amount_due: number;
        amount_remaining: number;
        schedule_status: string;
        due_date: Date | null;
      }>(
        `SELECT schedule_id, schedule_type, amount_due, amount_remaining, schedule_status, due_date
         FROM public.deposit_schedules
         WHERE reservation_id = $1::uuid
           AND tenant_id = $2::uuid
           AND blocks_check_in = TRUE
           AND schedule_status NOT IN ('PAID', 'WAIVED', 'CANCELLED')
           AND COALESCE(is_deleted, false) = false`,
        [command.reservation_id, tenantId],
      );

      if (blockingDeposits.rows.length > 0) {
        const totalOutstanding = blockingDeposits.rows.reduce(
          (sum, row) => sum + Number(row.amount_remaining ?? 0),
          0,
        );
        throw new ReservationCommandError(
          "DEPOSIT_REQUIRED",
          `${blockingDeposits.rows.length} blocking deposit(s) outstanding totalling ${totalOutstanding}. ` +
            `Use force=true to override or collect payment before check-in.`,
        );
      }
    } catch (err) {
      // Re-throw our own errors; swallow unexpected DB failures (non-critical path)
      if (err instanceof ReservationCommandError) throw err;
      reservationsLogger.warn(
        { reservationId: command.reservation_id, err },
        "Unable to verify deposit schedules during check-in",
      );
    }
  }

  // 4. Warn if no deposit/payment received at all for a reservation with charges
  if (Number(reservation.total_amount) > 0) {
    try {
      const depositResult = await query(
        `SELECT COALESCE(SUM(amount), 0) AS deposit_total
         FROM payments
         WHERE reservation_id = $1 AND tenant_id = $2
           AND transaction_type IN ('CAPTURE', 'AUTHORIZATION', 'DEPOSIT')
           AND status IN ('COMPLETED', 'AUTHORIZED')`,
        [command.reservation_id, tenantId],
      );
      const depositTotal = Number(depositResult.rows?.[0]?.deposit_total ?? 0);
      if (depositTotal === 0) {
        reservationsLogger.warn(
          { reservationId: command.reservation_id, totalAmount: reservation.total_amount },
          "Check-in without any deposit or payment guarantee on file",
        );
      }
    } catch {
      // Non-critical deposit check
    }
  }

  // S18: Post early check-in fee if guest checks in before the cutoff hour
  const actualCheckInTime = command.checked_in_at ?? new Date();
  try {
    if (reservation.rate_code) {
      const rateResult = await query<{
        early_checkin_fee: number;
        early_checkin_cutoff_hour: number;
      }>(
        `SELECT early_checkin_fee, early_checkin_cutoff_hour
         FROM rates
         WHERE rate_code = $1 AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [reservation.rate_code, tenantId],
      );
      const rate = rateResult.rows?.[0];
      if (rate && Number(rate.early_checkin_fee) > 0) {
        const scheduledDate = new Date(reservation.check_in_date);
        // Build the cutoff timestamp: scheduled check-in date at the cutoff hour (property local time)
        const cutoffTime = new Date(scheduledDate);
        cutoffTime.setHours(rate.early_checkin_cutoff_hour, 0, 0, 0);

        if (actualCheckInTime < cutoffTime) {
          const fee = Number(rate.early_checkin_fee);
          // Find the folio for this reservation
          const folioResult = await query<{ folio_id: string }>(
            `SELECT folio_id FROM folios
             WHERE reservation_id = $1 AND tenant_id = $2 AND folio_status = 'OPEN'
             ORDER BY created_at DESC LIMIT 1`,
            [command.reservation_id, tenantId],
          );
          const folioId = folioResult.rows?.[0]?.folio_id;
          if (folioId) {
            await withTransaction(async (client) => {
              await client.query(
                `INSERT INTO charge_postings (
                   tenant_id, property_id, folio_id, reservation_id,
                   transaction_type, posting_type, charge_code,
                   charge_description, quantity, unit_price, subtotal, total_amount,
                   currency_code, posting_time, business_date,
                   notes, created_by, updated_by
                 ) VALUES (
                   $1::uuid, $2::uuid, $3::uuid, $4::uuid,
                   'CHARGE', 'ROOM', 'EARLY_CHECKIN',
                   'Early check-in fee', 1, $5, $5, $5,
                   'USD', NOW(), CURRENT_DATE,
                   $6, $7::uuid, $7::uuid
                 )`,
                [
                  tenantId,
                  reservation.property_id,
                  folioId,
                  command.reservation_id,
                  fee,
                  `Early check-in before ${rate.early_checkin_cutoff_hour}:00`,
                  SYSTEM_ACTOR_ID,
                ],
              );
              await client.query(
                `UPDATE folios
                 SET total_charges = total_charges + $2,
                     balance = balance + $2,
                     updated_at = NOW()
                 WHERE folio_id = $1 AND tenant_id = $3`,
                [folioId, fee, tenantId],
              );
            });
            reservationsLogger.info(
              {
                reservationId: command.reservation_id,
                fee,
                cutoffHour: rate.early_checkin_cutoff_hour,
              },
              "Early check-in fee posted",
            );
          }
        }
      }
    }
  } catch (feeError) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: feeError },
      "Failed to post early check-in fee — proceeding with check-in",
    );
  }

  const roomNumber =
    assignedRoomNumber ??
    (assignedRoomId ? ((await fetchRoomInfo(tenantId, assignedRoomId))?.roomNumber ?? null) : null);
  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    status: "CHECKED_IN",
    actual_check_in: command.checked_in_at ?? new Date(),
    ...(roomNumber ? { room_number: roomNumber } : {}),
    internal_notes: command.notes,
    metadata: {
      ...command.metadata,
      room_id: assignedRoomId,
      guest_id: reservation.guest_id,
      room_type_id: reservation.room_type_id,
      auto_assigned: !command.room_id && !!assignedRoomId,
    },
  };
  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.check_in",
    updatePayload,
    options,
  );

  // 3. Mark room as OCCUPIED (post-enqueue, best-effort)
  if (assignedRoomId) {
    try {
      await query(
        `UPDATE rooms SET status = 'OCCUPIED', version = version + 1, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [assignedRoomId, tenantId],
      );
      reservationsLogger.info(
        { roomId: assignedRoomId, reservationId: command.reservation_id },
        "Room marked OCCUPIED on check-in",
      );
    } catch (roomError) {
      reservationsLogger.warn(
        { roomId: assignedRoomId, error: roomError },
        "Failed to mark room OCCUPIED on check-in — manual update required",
      );
    }
  }

  return result;
};

/**
 * Check out a reservation: validates status, marks room DIRTY, updates guest stats.
 * PMS industry standard pre-conditions:
 *  - Reservation must exist and be CHECKED_IN
 *  - Guest stats (nights, revenue, last_stay_date) are updated
 *  - Associated room transitions to DIRTY for housekeeping
 *  - Folio should be settled (logged as warning if not, but doesn't block checkout)
 */
export const checkOutReservation = async (
  tenantId: string,
  command: ReservationCheckOutCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  // 1. Validate reservation exists and is CHECKED_IN
  const resResult = await query(
    `SELECT id, status, guest_id, room_number, room_type_id, total_amount,
            check_in_date, check_out_date, actual_check_in, property_id, rate_code,
            travel_agent_id, source
     FROM reservations WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.reservation_id, tenantId],
  );
  const reservation = resResult.rows?.[0] as
    | {
        id: string;
        status: string;
        guest_id: string;
        room_number: string | null;
        room_type_id: string;
        total_amount: number;
        check_in_date: Date;
        check_out_date: Date;
        actual_check_in: Date | null;
        property_id: string;
        rate_code: string | null;
        travel_agent_id: string | null;
        source: string | null;
      }
    | undefined;

  if (!reservation) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  if (reservation.status !== "CHECKED_IN") {
    throw new ReservationCommandError(
      "INVALID_STATUS_FOR_CHECKOUT",
      `Cannot check out reservation with status ${reservation.status}; must be CHECKED_IN`,
    );
  }

  // 2. Enforce folio settlement (blocks checkout unless force=true or express=true)
  try {
    const folioResult = await query(
      `SELECT folio_id, balance FROM folios
       WHERE reservation_id = $1 AND tenant_id = $2 AND folio_status = 'OPEN' LIMIT 1`,
      [command.reservation_id, tenantId],
    );
    const folio = folioResult.rows?.[0] as { folio_id: string; balance: number } | undefined;
    if (folio && Number(folio.balance) > 0) {
      if (command.express) {
        // Express checkout: auto-settle the folio (post-departure billing for any balance)
        try {
          await query(
            `UPDATE folios
             SET folio_status = 'SETTLED',
                 settled_at = NOW(),
                 close_reason = 'EXPRESS_CHECKOUT',
                 updated_at = NOW()
             WHERE folio_id = $1 AND tenant_id = $2`,
            [folio.folio_id, tenantId],
          );
          reservationsLogger.info(
            {
              reservationId: command.reservation_id,
              folioId: folio.folio_id,
              balance: folio.balance,
            },
            "Express checkout: folio auto-settled for post-departure billing",
          );
        } catch (settleErr) {
          reservationsLogger.warn(
            { folioId: folio.folio_id, error: settleErr },
            "Express checkout: failed to auto-settle folio, proceeding anyway",
          );
        }
      } else if (command.force) {
        reservationsLogger.warn(
          {
            reservationId: command.reservation_id,
            folioId: folio.folio_id,
            balance: folio.balance,
          },
          "Check-out forced with unsettled folio balance",
        );
      } else {
        throw new ReservationCommandError(
          "FOLIO_UNSETTLED",
          `Cannot check out — folio ${folio.folio_id} has outstanding balance of ${folio.balance}. Use force:true or express:true to override.`,
        );
      }
    } else if (folio && command.express) {
      // Express checkout with $0 balance: just settle the folio cleanly
      try {
        await query(
          `UPDATE folios
           SET folio_status = 'SETTLED',
               settled_at = NOW(),
               close_reason = 'EXPRESS_CHECKOUT',
               updated_at = NOW()
           WHERE folio_id = $1 AND tenant_id = $2`,
          [folio.folio_id, tenantId],
        );
      } catch {
        // Non-critical
      }
    }
  } catch (err) {
    if (err instanceof ReservationCommandError) throw err;
    // Non-critical if folio query itself fails
  }

  const checkOutTime = command.checked_out_at ?? new Date();

  // S18: Post late check-out fee if guest checks out after the cutoff hour
  try {
    if (reservation.rate_code) {
      const rateResult = await query<{
        late_checkout_fee: number;
        late_checkout_cutoff_hour: number;
      }>(
        `SELECT late_checkout_fee, late_checkout_cutoff_hour
         FROM rates
         WHERE rate_code = $1 AND tenant_id = $2 AND is_active = true
         LIMIT 1`,
        [reservation.rate_code, tenantId],
      );
      const rate = rateResult.rows?.[0];
      if (rate && Number(rate.late_checkout_fee) > 0) {
        const scheduledDate = new Date(reservation.check_out_date);
        // Build the cutoff timestamp: scheduled check-out date at the cutoff hour
        const cutoffTime = new Date(scheduledDate);
        cutoffTime.setHours(rate.late_checkout_cutoff_hour, 0, 0, 0);

        if (checkOutTime > cutoffTime) {
          const fee = Number(rate.late_checkout_fee);
          const folioLookup = await query<{ folio_id: string }>(
            `SELECT folio_id FROM folios
             WHERE reservation_id = $1 AND tenant_id = $2 AND folio_status = 'OPEN'
             ORDER BY created_at DESC LIMIT 1`,
            [command.reservation_id, tenantId],
          );
          const lateFolioId = folioLookup.rows?.[0]?.folio_id;
          if (lateFolioId) {
            await withTransaction(async (client) => {
              await client.query(
                `INSERT INTO charge_postings (
                   tenant_id, property_id, folio_id, reservation_id,
                   transaction_type, posting_type, charge_code,
                   charge_description, quantity, unit_price, subtotal, total_amount,
                   currency_code, posting_time, business_date,
                   notes, created_by, updated_by
                 ) VALUES (
                   $1::uuid, $2::uuid, $3::uuid, $4::uuid,
                   'CHARGE', 'ROOM', 'LATE_CHECKOUT',
                   'Late check-out fee', 1, $5, $5, $5,
                   'USD', NOW(), CURRENT_DATE,
                   $6, $7::uuid, $7::uuid
                 )`,
                [
                  tenantId,
                  reservation.property_id,
                  lateFolioId,
                  command.reservation_id,
                  fee,
                  `Late check-out after ${rate.late_checkout_cutoff_hour}:00`,
                  SYSTEM_ACTOR_ID,
                ],
              );
              await client.query(
                `UPDATE folios
                 SET total_charges = total_charges + $2,
                     balance = balance + $2,
                     updated_at = NOW()
                 WHERE folio_id = $1 AND tenant_id = $3`,
                [lateFolioId, fee, tenantId],
              );
            });
            reservationsLogger.info(
              {
                reservationId: command.reservation_id,
                fee,
                cutoffHour: rate.late_checkout_cutoff_hour,
              },
              "Late check-out fee posted",
            );
          }
        }
      }
    }
  } catch (feeError) {
    reservationsLogger.warn(
      { reservationId: command.reservation_id, error: feeError },
      "Failed to post late check-out fee — proceeding with check-out",
    );
  }

  const updatePayload: ReservationUpdatePayload = {
    id: command.reservation_id,
    tenant_id: tenantId,
    status: "CHECKED_OUT",
    actual_check_out: checkOutTime,
    internal_notes: command.notes,
    metadata: {
      ...command.metadata,
      guest_id: reservation.guest_id,
      room_number: reservation.room_number,
    },
  };
  const result = await enqueueReservationUpdate(
    tenantId,
    "reservation.check_out",
    updatePayload,
    options,
  );

  // 3. Mark room as DIRTY for housekeeping (post-enqueue, best-effort)
  if (reservation.room_number) {
    try {
      await query(
        `UPDATE rooms SET status = 'DIRTY', version = version + 1, updated_at = NOW()
         WHERE room_number = $1 AND tenant_id = $2`,
        [reservation.room_number, tenantId],
      );
      reservationsLogger.info(
        { roomNumber: reservation.room_number, reservationId: command.reservation_id },
        "Room marked DIRTY on check-out",
      );
    } catch (roomError) {
      reservationsLogger.warn(
        { roomNumber: reservation.room_number, error: roomError },
        "Failed to mark room DIRTY on check-out",
      );
    }
  }

  // 4. Update guest stay statistics (total_nights, total_revenue, last_stay_date)
  try {
    const actualIn = reservation.actual_check_in ?? reservation.check_in_date;
    const nights = Math.max(
      1,
      Math.round((checkOutTime.getTime() - new Date(actualIn).getTime()) / (1000 * 60 * 60 * 24)),
    );
    const { updateGuestStayStats } = await import("../reservation-event-handler.js");
    await updateGuestStayStats(
      tenantId,
      reservation.guest_id,
      nights,
      Number(reservation.total_amount),
      checkOutTime,
    );
    reservationsLogger.info(
      { guestId: reservation.guest_id, nights, revenue: reservation.total_amount },
      "Guest stay stats updated on check-out",
    );
  } catch (statsError) {
    reservationsLogger.warn(
      { guestId: reservation.guest_id, error: statsError },
      "Failed to update guest stay stats on check-out",
    );
  }

  // S10: Calculate and record commission for travel-agent / OTA bookings
  if (reservation.travel_agent_id || reservation.source) {
    try {
      const actualIn = reservation.actual_check_in ?? reservation.check_in_date;
      const _stayNights = Math.max(
        1,
        Math.round((checkOutTime.getTime() - new Date(actualIn).getTime()) / (1000 * 60 * 60 * 24)),
      );

      // Find commission config from booking_sources or commission_rules
      let commissionType = "PERCENTAGE";
      let commissionRate = 0;
      let flatAmount = 0;
      let agentCompanyId: string | null = null;

      if (reservation.travel_agent_id) {
        const ruleResult = await query<{
          commission_type: string;
          default_rate: number;
          room_rate: number;
          flat_amount: number;
          company_id: string | null;
        }>(
          `SELECT cr.commission_type, cr.default_rate, cr.room_rate,
                  COALESCE(cr.flat_amount_per_booking, 0) AS flat_amount,
                  cr.company_id
           FROM commission_rules cr
           WHERE cr.tenant_id = $1
             AND cr.is_active = true
             AND (cr.company_id = (SELECT company_id FROM travel_agents WHERE agent_id = $2 AND tenant_id = $1 LIMIT 1)
                  OR cr.apply_to_all_agents = true)
             AND (cr.effective_start IS NULL OR cr.effective_start <= CURRENT_DATE)
             AND (cr.effective_end IS NULL OR cr.effective_end >= CURRENT_DATE)
           ORDER BY cr.apply_to_all_agents ASC, cr.priority DESC
           LIMIT 1`,
          [tenantId, reservation.travel_agent_id],
        );
        const rule = ruleResult.rows?.[0];
        if (rule) {
          commissionType = rule.commission_type;
          commissionRate = Number(rule.room_rate || rule.default_rate || 0);
          flatAmount = Number(rule.flat_amount || 0);
          agentCompanyId = rule.company_id;
        }
      }

      // Fallback to booking_sources commission config
      if (commissionRate === 0 && flatAmount === 0 && reservation.source) {
        const srcResult = await query<{
          commission_type: string;
          commission_percentage: number;
          commission_fixed_amount: number;
        }>(
          `SELECT commission_type, COALESCE(commission_percentage, 0) AS commission_percentage,
                  COALESCE(commission_fixed_amount, 0) AS commission_fixed_amount
           FROM booking_sources
           WHERE source_code = $1 AND tenant_id = $2 LIMIT 1`,
          [reservation.source, tenantId],
        );
        const src = srcResult.rows?.[0];
        if (src && src.commission_type !== "NONE") {
          commissionType = src.commission_type;
          commissionRate = Number(src.commission_percentage);
          flatAmount = Number(src.commission_fixed_amount);
        }
      }

      // Calculate gross commission
      let grossCommission = 0;
      const roomRevenue = Number(reservation.total_amount);
      if (
        (commissionType === "PERCENTAGE" || commissionType === "percentage") &&
        commissionRate > 0
      ) {
        grossCommission = (roomRevenue * commissionRate) / 100;
      } else if (
        commissionType === "FIXED" ||
        commissionType === "FLAT_RATE" ||
        commissionType === "flat_rate"
      ) {
        grossCommission = flatAmount;
      } else if (commissionRate > 0) {
        grossCommission = (roomRevenue * commissionRate) / 100;
      }

      if (grossCommission > 0) {
        grossCommission = Math.round(grossCommission * 100) / 100;
        await withTransaction(async (client) => {
          await client.query(
            `INSERT INTO travel_agent_commissions (
               tenant_id, property_id, reservation_id,
               agent_id, company_id, commission_type, room_revenue,
               room_commission_rate, gross_commission_amount,
               currency_code, payment_status,
               created_by, updated_by
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid,
               $4::uuid, $5::uuid, $6, $7,
               $8, $9,
               'USD', 'PENDING',
               $10::uuid, $10::uuid
             )`,
            [
              tenantId,
              reservation.property_id,
              command.reservation_id,
              reservation.travel_agent_id,
              agentCompanyId,
              commissionType.toLowerCase(),
              roomRevenue,
              commissionRate,
              grossCommission,
              SYSTEM_ACTOR_ID,
            ],
          );
          await client.query(
            `INSERT INTO commission_tracking (
               tenant_id, property_id, reservation_id,
               commission_type, beneficiary_type, beneficiary_id,
               base_amount, commission_rate, calculated_amount,
               final_amount, currency_code, status,
               created_by, updated_by
             ) VALUES (
               $1::uuid, $2::uuid, $3::uuid,
               'booking', 'agent', $4::uuid,
               $5, $6, $7,
               $7, 'USD', 'pending',
               $8::uuid, $8::uuid
             )`,
            [
              tenantId,
              reservation.property_id,
              command.reservation_id,
              reservation.travel_agent_id ?? null,
              roomRevenue,
              commissionRate,
              grossCommission,
              SYSTEM_ACTOR_ID,
            ],
          );
        });
        reservationsLogger.info(
          {
            reservationId: command.reservation_id,
            grossCommission,
            commissionRate,
            commissionType,
            agentId: reservation.travel_agent_id,
          },
          "Commission calculated and recorded on check-out",
        );
      }
    } catch (commErr) {
      reservationsLogger.warn(
        { reservationId: command.reservation_id, error: commErr },
        "Failed to calculate commission on check-out — continuing",
      );
    }
  }

  return result;
};

/**
 * Walk-in express check-in: creates a reservation, assigns a room, and checks
 * in the guest in a single synchronous operation. Bypasses the normal async
 * create pipeline because the guest is at the front desk and needs immediate
 * accommodation.
 *
 * Flow: Direct INSERT → room OCCUPIED → availability lock → outbox event.
 */
export const walkInCheckIn = async (
  tenantId: string,
  command: ReservationWalkInCheckInCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const reservationId = uuid();
  const now = new Date();
  const checkInDate = now;
  const checkOutDate = new Date(command.check_out_date);

  if (checkOutDate <= checkInDate) {
    throw new ReservationCommandError(
      "INVALID_DATES",
      "check_out_date must be after today for walk-in check-in",
    );
  }

  // 1. Resolve rate plan
  const rateResolution = await resolveRatePlan({
    tenantId,
    propertyId: command.property_id,
    roomTypeId: command.room_type_id,
    stayStart: checkInDate,
    stayEnd: checkOutDate,
    requestedRateCode: command.rate_code,
  });

  if (rateResolution.fallbackApplied && !command.allow_rate_fallback) {
    throw new ReservationCommandError(
      "RATE_FALLBACK_NOT_ALLOWED",
      `Requested rate "${rateResolution.requestedRateCode}" unavailable; set allow_rate_fallback=true for fallback to "${rateResolution.appliedRateCode}"`,
    );
  }

  // 2. Find or validate room
  let roomId = command.room_id ?? null;
  let roomNumber: string | null = null;

  if (roomId) {
    const roomInfo = await fetchRoomInfo(tenantId, roomId);
    if (!roomInfo) throw new ReservationCommandError("ROOM_NOT_FOUND", `Room ${roomId} not found`);
    // Validate room is available
    const roomResult = await query(
      `SELECT status FROM rooms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [roomId, tenantId],
    );
    const roomStatus = (roomResult.rows?.[0] as { status: string } | undefined)?.status;
    if (roomStatus !== "AVAILABLE") {
      throw new ReservationCommandError(
        "ROOM_NOT_AVAILABLE",
        `Room ${roomInfo.roomNumber} is ${roomStatus}, not AVAILABLE`,
      );
    }
    roomNumber = roomInfo.roomNumber;
  } else {
    // Auto-assign best available room
    const bestRoom = await findBestAvailableRoom(
      tenantId,
      command.property_id,
      command.room_type_id,
      checkInDate,
      checkOutDate,
    );
    if (!bestRoom) {
      throw new ReservationCommandError(
        "NO_AVAILABLE_ROOMS",
        "No clean available rooms found for the requested room type",
      );
    }
    roomId = bestRoom.room_id;
    roomNumber = bestRoom.room_number;
  }

  // 3. Look up guest details
  const guestResult = await query(
    `SELECT first_name, last_name, email FROM guests WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [command.guest_id, tenantId],
  );
  const guest = guestResult.rows?.[0] as
    | { first_name: string; last_name: string; email: string }
    | undefined;
  const guestName = guest
    ? `${guest.first_name ?? ""} ${guest.last_name ?? ""}`.trim()
    : "Walk-In Guest";
  const guestEmail = guest?.email ?? "walkin@unknown.com";

  // 4. Calculate nightly rate
  const nights = Math.max(
    1,
    Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const totalAmount = Number(command.total_amount ?? 0);
  const roomRate = Number((totalAmount / nights).toFixed(2));
  const currency = (command.currency ?? DEFAULT_CURRENCY).toUpperCase();
  const confirmation = `TW-${reservationId.slice(0, 8).toUpperCase()}`;

  // 5. Lock availability
  const walkInGuardMetadata = await lockReservationHold({
    tenantId,
    reservationId,
    roomTypeId: command.room_type_id,
    roomId,
    stayStart: checkInDate,
    stayEnd: checkOutDate,
    reason: "WALKIN_CHECKIN",
    correlationId: options.correlationId ?? eventId,
  });

  // 6. Direct INSERT + room OCCUPIED + outbox event in one transaction
  try {
    await withTransaction(async (client) => {
      // Insert reservation directly (CHECKED_IN from the start)
      await client.query(
        `INSERT INTO reservations (
        id, tenant_id, property_id, guest_id, room_type_id,
        check_in_date, check_out_date, booking_date,
        status, source, reservation_type,
        room_rate, total_amount, currency,
        guest_name, guest_email, confirmation_number,
        room_number, actual_check_in,
        eta, company_id, travel_agent_id,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, NOW(),
        'CHECKED_IN', 'WALKIN', 'TRANSIENT',
        $8, $9, $10,
        $11, $12, $13,
        $14, NOW(),
        $15, $16, $17,
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING`,
        [
          reservationId,
          tenantId,
          command.property_id,
          command.guest_id,
          command.room_type_id,
          checkInDate.toISOString().slice(0, 10),
          checkOutDate.toISOString().slice(0, 10),
          roomRate,
          totalAmount,
          currency,
          guestName,
          guestEmail,
          confirmation,
          roomNumber,
          command.eta ?? null,
          command.company_id ?? null,
          command.travel_agent_id ?? null,
        ],
      );

      // Mark room OCCUPIED
      await client.query(
        `UPDATE rooms SET status = 'OCCUPIED', version = version + 1, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
        [roomId, tenantId],
      );

      // Record lifecycle
      await recordLifecyclePersisted(client, {
        eventId,
        tenantId,
        reservationId,
        commandName: "reservation.walkin_checkin",
        correlationId: options.correlationId,
        partitionKey: command.guest_id,
        details: {
          tenantId,
          reservationId,
          command: "reservation.walkin_checkin",
          roomNumber,
          source: "WALKIN",
        },
        metadata: { eventType: "reservation.created" },
      });

      // Enqueue outbox event for downstream consumers
      const createdEvent = {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "reservation.created",
          timestamp: now.toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          id: reservationId,
          property_id: command.property_id,
          guest_id: command.guest_id,
          room_type_id: command.room_type_id,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          booking_date: now,
          total_amount: totalAmount,
          currency,
          status: "CHECKED_IN",
          source: "WALKIN",
          reservation_type: "TRANSIENT",
          rate_code: rateResolution.appliedRateCode,
        },
      };

      await enqueueOutboxRecordWithClient(client, {
        eventId,
        tenantId,
        aggregateId: reservationId,
        aggregateType: "reservation",
        eventType: "reservation.created",
        payload: createdEvent,
        headers: { tenantId, eventId },
        correlationId: options.correlationId,
        partitionKey: command.guest_id,
        metadata: {
          source: serviceConfig.serviceId,
          walkIn: true,
          roomNumber,
        },
      });
    });
  } catch (txError) {
    // P1-2: Release availability lock on transaction failure to prevent lock leak
    if (walkInGuardMetadata.status === "LOCKED" && walkInGuardMetadata.lockId) {
      try {
        await releaseReservationHold({
          tenantId,
          lockId: walkInGuardMetadata.lockId,
          reservationId,
          reason: "TRANSACTION_FAILURE_ROLLBACK",
          correlationId: options.correlationId ?? eventId,
        });
        reservationsLogger.info(
          { reservationId, lockId: walkInGuardMetadata.lockId },
          "Released availability lock after walk-in transaction failure",
        );
      } catch (releaseError) {
        reservationsLogger.error(
          { reservationId, lockId: walkInGuardMetadata.lockId, err: releaseError },
          "Failed to release availability lock after walk-in failure — lock will expire via TTL",
        );
      }
    }
    throw txError;
  }

  reservationsLogger.info(
    { reservationId, roomNumber, guestName, confirmation },
    "Walk-in express check-in completed",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};
