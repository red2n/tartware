import { v4 as uuid } from "uuid";

import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import type {
  GroupAddRoomsCommand,
  GroupBillingSetupCommand,
  GroupCreateCommand,
  GroupCutoffEnforceCommand,
  GroupUploadRoomingListCommand,
} from "../../schemas/reservation-command.js";
import {
  ReservationCommandError,
  type CreateReservationResult,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/* ================================================================== */
/*  GROUP BOOKING HANDLERS                                            */
/* ================================================================== */

/**
 * Create a new group booking.
 * Inserts into `group_bookings` with status INQUIRY/TENTATIVE and
 * generates a unique group_code.
 */
export const createGroupBooking = async (
  tenantId: string,
  command: GroupCreateCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const groupBookingId = uuid();

  const arrivalDate = new Date(command.arrival_date);
  const departureDate = new Date(command.departure_date);
  if (departureDate <= arrivalDate) {
    throw new ReservationCommandError("INVALID_DATES", "departure_date must be after arrival_date");
  }

  // Generate a unique group code: GRP-<8 hex chars>
  const groupCode = `GRP-${groupBookingId.slice(0, 8).toUpperCase()}`;

  // Calculate cutoff_date if not provided
  const cutoffDays = command.cutoff_days_before_arrival ?? 14;
  const cutoffDate = command.cutoff_date
    ? new Date(command.cutoff_date)
    : new Date(arrivalDate.getTime() - cutoffDays * 86_400_000);

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO group_bookings (
        group_booking_id, tenant_id, property_id,
        group_name, group_code, group_type,
        company_id, organization_name,
        contact_name, contact_email, contact_phone,
        arrival_date, departure_date,
        total_rooms_requested, total_rooms_blocked,
        cutoff_date, cutoff_days_before_arrival, release_unsold_rooms,
        block_status, rate_type, negotiated_rate,
        payment_method, deposit_amount, deposit_due_date,
        complimentary_rooms, complimentary_ratio,
        meeting_space_required, catering_required,
        cancellation_policy, cancellation_deadline,
        notes, created_by, updated_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8,
        $9, $10, $11,
        $12, $13,
        $14, 0,
        $15, $16, TRUE,
        $17, $18, $19,
        $20, $21, $22,
        $23, $24,
        $25, $26,
        $27, $28,
        $29, $30, $30
      )`,
      [
        groupBookingId,
        tenantId,
        command.property_id,
        command.group_name,
        groupCode,
        command.group_type,
        command.company_id ?? null,
        command.organization_name ?? null,
        command.contact_name,
        command.contact_email ?? null,
        command.contact_phone ?? null,
        arrivalDate.toISOString().slice(0, 10),
        departureDate.toISOString().slice(0, 10),
        command.total_rooms_requested,
        cutoffDate.toISOString().slice(0, 10),
        cutoffDays,
        command.block_status ?? "tentative",
        command.rate_type ?? null,
        command.negotiated_rate ?? null,
        command.payment_method ?? null,
        command.deposit_amount ?? 0,
        command.deposit_due_date
          ? new Date(command.deposit_due_date).toISOString().slice(0, 10)
          : null,
        command.complimentary_rooms ?? 0,
        command.complimentary_ratio ?? null,
        command.meeting_space_required ?? false,
        command.catering_required ?? false,
        command.cancellation_policy ?? null,
        command.cancellation_deadline
          ? new Date(command.cancellation_deadline).toISOString().slice(0, 10)
          : null,
        command.notes ?? null,
        SYSTEM_ACTOR_ID,
      ],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: groupBookingId,
      aggregateType: "group_booking",
      eventType: "group.created",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "group.created",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          group_booking_id: groupBookingId,
          group_code: groupCode,
          group_name: command.group_name,
          group_type: command.group_type,
          property_id: command.property_id,
          arrival_date: arrivalDate.toISOString().slice(0, 10),
          departure_date: departureDate.toISOString().slice(0, 10),
          total_rooms_requested: command.total_rooms_requested,
          block_status: command.block_status ?? "tentative",
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: groupBookingId,
      metadata: { source: serviceConfig.serviceId, action: "group.create" },
    });
  });

  reservationsLogger.info(
    { groupBookingId, groupCode, groupName: command.group_name },
    "Group booking created",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Add or update room block allocations for a group by date + room type.
 * Uses UPSERT on the unique (group_booking_id, room_type_id, block_date) index.
 * Also recalculates group-level totals.
 */
export const addGroupRooms = async (
  tenantId: string,
  command: GroupAddRoomsCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    // Verify group exists and belongs to tenant
    const { rows: groupRows } = await client.query(
      `SELECT group_booking_id, block_status
       FROM group_bookings
       WHERE group_booking_id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [command.group_booking_id, tenantId],
    );
    if (groupRows.length === 0) {
      throw new ReservationCommandError(
        "GROUP_NOT_FOUND",
        `Group booking ${command.group_booking_id} not found`,
      );
    }
    if (groupRows[0].block_status === "cancelled") {
      throw new ReservationCommandError(
        "GROUP_CANCELLED",
        "Cannot add rooms to a cancelled group booking",
      );
    }

    // Upsert each block entry
    for (const block of command.blocks) {
      await client.query(
        `INSERT INTO group_room_blocks (
          block_id, group_booking_id, room_type_id, block_date,
          blocked_rooms, negotiated_rate, rack_rate, discount_percentage,
          block_status, created_by, updated_by
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3,
          $4, $5, $6, $7,
          'active', $8, $8
        )
        ON CONFLICT (group_booking_id, room_type_id, block_date)
        DO UPDATE SET
          blocked_rooms = EXCLUDED.blocked_rooms,
          negotiated_rate = EXCLUDED.negotiated_rate,
          rack_rate = COALESCE(EXCLUDED.rack_rate, group_room_blocks.rack_rate),
          discount_percentage = COALESCE(EXCLUDED.discount_percentage, group_room_blocks.discount_percentage),
          updated_at = NOW(),
          updated_by = $8`,
        [
          command.group_booking_id,
          block.room_type_id,
          new Date(block.block_date).toISOString().slice(0, 10),
          block.blocked_rooms,
          block.negotiated_rate,
          block.rack_rate ?? null,
          block.discount_percentage ?? null,
          SYSTEM_ACTOR_ID,
        ],
      );
    }

    // Recalculate group-level totals
    await client.query(
      `UPDATE group_bookings
       SET total_rooms_blocked = (
         SELECT COALESCE(SUM(blocked_rooms), 0)
         FROM group_room_blocks
         WHERE group_booking_id = $1 AND block_status != 'cancelled'
       ),
       updated_at = NOW(), updated_by = $2, version = version + 1
       WHERE group_booking_id = $1 AND tenant_id = $3`,
      [command.group_booking_id, SYSTEM_ACTOR_ID, tenantId],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.group_booking_id,
      aggregateType: "group_booking",
      eventType: "group.rooms_added",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "group.rooms_added",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          group_booking_id: command.group_booking_id,
          blocks_count: command.blocks.length,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.group_booking_id,
      metadata: { source: serviceConfig.serviceId, action: "group.add_rooms" },
    });
  });

  reservationsLogger.info(
    { groupBookingId: command.group_booking_id, blocksAdded: command.blocks.length },
    "Room blocks added to group",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Upload a rooming list to create individual reservations from a group block.
 * For each guest entry, creates a reservation with reservation_type GROUP
 * and increments picked_rooms on the matching block row.
 */
export const uploadGroupRoomingList = async (
  tenantId: string,
  command: GroupUploadRoomingListCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    // Verify group booking exists
    const { rows: groupRows } = await client.query(
      `SELECT group_booking_id, property_id, block_status, negotiated_rate
       FROM group_bookings
       WHERE group_booking_id = $1 AND tenant_id = $2 AND is_deleted = FALSE
       FOR UPDATE`,
      [command.group_booking_id, tenantId],
    );
    if (groupRows.length === 0) {
      throw new ReservationCommandError(
        "GROUP_NOT_FOUND",
        `Group booking ${command.group_booking_id} not found`,
      );
    }
    const group = groupRows[0];
    if (group.block_status === "cancelled" || group.block_status === "completed") {
      throw new ReservationCommandError(
        "GROUP_INVALID_STATUS",
        `Cannot upload rooming list for group in ${group.block_status} status`,
      );
    }

    let pickedCount = 0;

    for (const guest of command.guests) {
      const reservationId = uuid();
      const arrivalDate = new Date(guest.arrival_date).toISOString().slice(0, 10);
      const departureDate = new Date(guest.departure_date).toISOString().slice(0, 10);

      // Verify and decrement block availability
      const { rowCount } = await client.query(
        `UPDATE group_room_blocks
         SET picked_rooms = picked_rooms + 1,
             updated_at = NOW(), updated_by = $5
         WHERE group_booking_id = $1
           AND room_type_id = $2
           AND block_date = $3
           AND picked_rooms < blocked_rooms
           AND block_status IN ('active', 'pending')`,
        [command.group_booking_id, guest.room_type_id, arrivalDate, departureDate, SYSTEM_ACTOR_ID],
      );

      if (!rowCount || rowCount === 0) {
        reservationsLogger.warn(
          {
            groupBookingId: command.group_booking_id,
            roomTypeId: guest.room_type_id,
            guestName: guest.guest_name,
            arrivalDate,
          },
          "No available block for guest — creating reservation without block decrement",
        );
      }

      // Create individual reservation linked to the group
      await client.query(
        `INSERT INTO reservations (
          id, tenant_id, property_id, room_type_id,
          check_in_date, check_out_date, booking_date,
          status, reservation_type, source,
          total_amount, currency,
          special_requests, group_booking_id,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, NOW(),
          'CONFIRMED', 'GROUP', 'DIRECT',
          $7, 'USD',
          $8, $9,
          $10, $10
        )`,
        [
          reservationId,
          tenantId,
          group.property_id,
          guest.room_type_id,
          arrivalDate,
          departureDate,
          group.negotiated_rate ?? 0,
          guest.special_requests ?? null,
          command.group_booking_id,
          SYSTEM_ACTOR_ID,
        ],
      );

      pickedCount++;
    }

    // Update group totals and rooming list flags
    await client.query(
      `UPDATE group_bookings
       SET total_rooms_picked = (
         SELECT COALESCE(SUM(picked_rooms), 0)
         FROM group_room_blocks
         WHERE group_booking_id = $1
       ),
       rooming_list_received = TRUE,
       rooming_list_received_date = NOW(),
       rooming_list_format = $3,
       updated_at = NOW(), updated_by = $4, version = version + 1
       WHERE group_booking_id = $1 AND tenant_id = $2`,
      [command.group_booking_id, tenantId, command.rooming_list_format ?? "api", SYSTEM_ACTOR_ID],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.group_booking_id,
      aggregateType: "group_booking",
      eventType: "group.rooming_list_uploaded",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "group.rooming_list_uploaded",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          group_booking_id: command.group_booking_id,
          guests_count: command.guests.length,
          reservations_created: pickedCount,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.group_booking_id,
      metadata: { source: serviceConfig.serviceId, action: "group.upload_rooming_list" },
    });
  });

  reservationsLogger.info(
    { groupBookingId: command.group_booking_id, guestsProcessed: command.guests.length },
    "Rooming list uploaded and reservations created",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Enforce cutoff dates for group bookings.
 * Finds groups whose cutoff_date <= business_date and releases unsold
 * room blocks back to general inventory. Updates block status to 'released'.
 */
export const enforceGroupCutoff = async (
  tenantId: string,
  command: GroupCutoffEnforceCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const businessDate = command.business_date
    ? new Date(command.business_date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // Find all group bookings past cutoff for this property
  const { rows: expiredGroups } = await query(
    `SELECT gb.group_booking_id, gb.group_name, gb.cutoff_date,
            gb.cancellation_penalty_percentage, gb.negotiated_rate,
            gb.total_rooms_requested, gb.total_rooms_picked
     FROM group_bookings gb
     WHERE gb.tenant_id = $1
       AND gb.property_id = $2
       AND gb.cutoff_date <= $3::date
       AND gb.release_unsold_rooms = TRUE
       AND gb.block_status IN ('tentative', 'definite', 'confirmed')
       AND gb.is_deleted = FALSE`,
    [tenantId, command.property_id, businessDate],
  );

  if (command.dry_run) {
    reservationsLogger.info(
      { propertyId: command.property_id, businessDate, groupsFound: expiredGroups.length },
      "Cutoff enforcement dry run complete",
    );
    return { eventId, correlationId: options.correlationId, status: "accepted" };
  }

  let totalBlocksReleased = 0;

  for (const group of expiredGroups) {
    await withTransaction(async (client) => {
      // Release unsold blocks
      const { rowCount } = await client.query(
        `UPDATE group_room_blocks
         SET block_status = 'released',
             released_date = NOW(),
             released_by = $3::uuid,
             updated_at = NOW(), updated_by = $3::uuid
         WHERE group_booking_id = $1
           AND block_status IN ('active', 'pending')
           AND picked_rooms < blocked_rooms
           AND block_date >= $2::date`,
        [group.group_booking_id, businessDate, SYSTEM_ACTOR_ID],
      );

      totalBlocksReleased += rowCount ?? 0;

      // Update group status
      await client.query(
        `UPDATE group_bookings
         SET block_status = CASE
           WHEN total_rooms_picked >= total_rooms_requested THEN 'confirmed'
           WHEN total_rooms_picked > 0 THEN 'partial'
           ELSE block_status
         END,
         updated_at = NOW(), updated_by = $2, version = version + 1
         WHERE group_booking_id = $1 AND tenant_id = $3`,
        [group.group_booking_id, SYSTEM_ACTOR_ID, tenantId],
      );

      await enqueueOutboxRecordWithClient(client, {
        eventId: uuid(),
        tenantId,
        aggregateId: group.group_booking_id,
        aggregateType: "group_booking",
        eventType: "group.cutoff_enforced",
        payload: {
          metadata: {
            id: uuid(),
            source: serviceConfig.serviceId,
            type: "group.cutoff_enforced",
            timestamp: new Date().toISOString(),
            version: "1.0",
            correlationId: options.correlationId,
            tenantId,
            retryCount: 0,
          },
          payload: {
            group_booking_id: group.group_booking_id,
            group_name: group.group_name,
            blocks_released: rowCount ?? 0,
            cutoff_date: group.cutoff_date,
          },
        },
        headers: { tenantId, eventId },
        correlationId: options.correlationId,
        partitionKey: group.group_booking_id,
        metadata: { source: serviceConfig.serviceId, action: "group.cutoff_enforce" },
      });
    });
  }

  reservationsLogger.info(
    {
      propertyId: command.property_id,
      businessDate,
      groupsProcessed: expiredGroups.length,
      totalBlocksReleased,
    },
    "Group cutoff enforcement completed",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};

/**
 * Create a MASTER folio for a group booking and configure charge routing.
 * Updates the group_bookings record with the master_folio_id and
 * stores routing rules as JSONB metadata on the folio.
 */
export const setupGroupBilling = async (
  tenantId: string,
  command: GroupBillingSetupCommand,
  options: { correlationId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();

  await withTransaction(async (client) => {
    // Fetch group booking
    const { rows: groupRows } = await client.query(
      `SELECT group_booking_id, property_id, group_name, group_code,
              master_folio_id, contact_name, billing_contact_name,
              billing_contact_email, billing_contact_phone, organization_name
       FROM group_bookings
       WHERE group_booking_id = $1 AND tenant_id = $2 AND is_deleted = FALSE
       FOR UPDATE`,
      [command.group_booking_id, tenantId],
    );
    if (groupRows.length === 0) {
      throw new ReservationCommandError(
        "GROUP_NOT_FOUND",
        `Group booking ${command.group_booking_id} not found`,
      );
    }
    const group = groupRows[0];

    if (group.master_folio_id) {
      throw new ReservationCommandError(
        "MASTER_FOLIO_EXISTS",
        `Group ${command.group_booking_id} already has master folio ${group.master_folio_id}`,
      );
    }

    const folioId = uuid();
    const folioNumber = `GRP-${group.group_code ?? group.group_booking_id.slice(0, 8).toUpperCase()}`;

    // Default routing: room & tax → master, incidentals → individual
    const routingRules = command.routing_rules ?? [
      { charge_type: "ROOM", target: "master" },
      { charge_type: "TAX", target: "master" },
      { charge_type: "INCIDENTAL", target: "individual" },
    ];

    // Create MASTER folio
    await client.query(
      `INSERT INTO folios (
        folio_id, tenant_id, property_id,
        folio_number, folio_type, folio_status,
        guest_name, company_name,
        tax_exempt, tax_id,
        notes,
        created_by, updated_by
      ) VALUES (
        $1, $2, $3,
        $4, 'MASTER', 'OPEN',
        $5, $6,
        $7, $8,
        $9,
        $10, $10
      )`,
      [
        folioId,
        tenantId,
        group.property_id,
        folioNumber,
        command.billing_contact_name ?? group.billing_contact_name ?? group.contact_name,
        group.organization_name ?? group.group_name,
        command.tax_exempt ?? false,
        command.tax_id ?? null,
        JSON.stringify({ routing_rules: routingRules }),
        SYSTEM_ACTOR_ID,
      ],
    );

    // Link folio to group booking and update billing details
    await client.query(
      `UPDATE group_bookings
       SET master_folio_id = $1,
           payment_method = COALESCE($3, payment_method),
           billing_contact_name = COALESCE($4, billing_contact_name),
           billing_contact_email = COALESCE($5, billing_contact_email),
           billing_contact_phone = COALESCE($6, billing_contact_phone),
           updated_at = NOW(), updated_by = $7, version = version + 1
       WHERE group_booking_id = $2 AND tenant_id = $8`,
      [
        folioId,
        command.group_booking_id,
        command.payment_method ?? null,
        command.billing_contact_name ?? null,
        command.billing_contact_email ?? null,
        command.billing_contact_phone ?? null,
        SYSTEM_ACTOR_ID,
        tenantId,
      ],
    );

    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.group_booking_id,
      aggregateType: "group_booking",
      eventType: "group.billing_setup",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "group.billing_setup",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          group_booking_id: command.group_booking_id,
          master_folio_id: folioId,
          folio_number: folioNumber,
          payment_method: command.payment_method,
          routing_rules: routingRules,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.group_booking_id,
      metadata: { source: serviceConfig.serviceId, action: "group.billing.setup" },
    });
  });

  reservationsLogger.info(
    { groupBookingId: command.group_booking_id },
    "Group billing setup completed with master folio",
  );

  return { eventId, correlationId: options.correlationId, status: "accepted" };
};
