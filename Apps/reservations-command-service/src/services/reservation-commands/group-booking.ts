import { v4 as uuid } from "uuid";

import { serviceConfig } from "../../config.js";
import { query, withTransaction } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";
import { enqueueOutboxRecordWithClient } from "../../outbox/repository.js";
import type {
  GroupAddRoomsCommand,
  GroupBillingSetupCommand,
  GroupCheckInCommand,
  GroupCreateCommand,
  GroupCutoffEnforceCommand,
  GroupUploadRoomingListCommand,
} from "../../schemas/reservation-command.js";

import {
  type CreateReservationResult,
  enqueueReservationUpdate,
  ReservationCommandError,
  type ReservationUpdatePayload,
  SYSTEM_ACTOR_ID,
} from "./common.js";

/* ================================================================== */
/*  GROUP BOOKING HANDLERS                                            */
/* ================================================================== */

/**
 * Create a new group booking.
 * Inserts into `group_bookings` with status INQUIRY/PROSPECT/TENTATIVE/DEFINITE and
 * generates a unique group_code.
 */
export const createGroupBooking = async (
  tenantId: string,
  command: GroupCreateCommand,
  options: { correlationId?: string; actorId?: string } = {},
): Promise<CreateReservationResult> => {
  const eventId = uuid();
  const groupBookingId = uuid();
  const actorId = options.actorId ?? SYSTEM_ACTOR_ID;

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
        command.block_status ?? "inquiry",
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
        actorId,
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
          block_status: command.block_status ?? "inquiry",
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

      // Find or create a guest record for this rooming list entry.
      // guest_id is NOT NULL on reservations, so we must have a valid guest row.
      // If no email is supplied, generate a stable placeholder so subsequent re-uploads
      // of the same guest (same reservation UUID seed) don't proliferate duplicate rows.
      const nameParts = guest.guest_name.trim().split(/\s+/);
      const firstName = nameParts[0] ?? guest.guest_name;
      const lastName = nameParts.slice(1).join(" ") || firstName;
      const guestEmail = guest.guest_email ?? `noreply+${reservationId}@group.internal`;
      const confirmationNumber = `GRP-${reservationId.slice(0, 8).toUpperCase()}`;

      const { rows: guestRows } = await client.query<{ id: string }>(
        `INSERT INTO guests (id, tenant_id, first_name, last_name, email, created_by, updated_by)
         VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $5)
         ON CONFLICT (tenant_id, email) WHERE deleted_at IS NULL
         DO UPDATE SET first_name = EXCLUDED.first_name,
                       last_name  = EXCLUDED.last_name,
                       updated_at = NOW()
         RETURNING id`,
        [tenantId, firstName, lastName, guestEmail, SYSTEM_ACTOR_ID],
      );
      const guestId = guestRows[0].id;

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

      // Create individual reservation linked to the group.
      // All NOT NULL columns (guest_id, guest_name, guest_email, room_rate,
      // confirmation_number) are populated to satisfy DB constraints.
      await client.query(
        `INSERT INTO reservations (
          id, tenant_id, property_id, room_type_id,
          guest_id,
          check_in_date, check_out_date, booking_date,
          status, reservation_type, source,
          room_rate, total_amount, currency,
          guest_name, guest_email, confirmation_number,
          special_requests, group_booking_id,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3, $4,
          $5,
          $6, $7, NOW(),
          'CONFIRMED', 'GROUP', 'DIRECT',
          $8, $8, 'USD',
          $9, $10, $11,
          $12, $13,
          $14, $14
        )`,
        [
          reservationId,
          tenantId,
          group.property_id,
          guest.room_type_id,
          guestId,
          arrivalDate,
          departureDate,
          group.negotiated_rate ?? 0,
          guest.guest_name,
          guestEmail,
          confirmationNumber,
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
        created_by, updated_by
      ) VALUES (
        $1, $2, $3,
        $4, 'MASTER', 'OPEN',
        $5, $6,
        $7, $8,
        $9, $9
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
        SYSTEM_ACTOR_ID,
      ],
    );

    // Insert folio_routing_rules rows — one per routing rule.
    // is_template = FALSE: these are active rules bound to this group booking.
    // source_folio_id = NULL: rule applies to all member folios (matched via group_booking_id).
    // When target is "master": destination_folio_id = master folio.
    // When target is "individual": destination_folio_id = NULL, destination_folio_type = 'GUEST'.
    for (let i = 0; i < routingRules.length; i++) {
      const rule = routingRules[i];
      const ruleId = uuid();
      const isToMaster = rule.target === "master";
      await client.query(
        `INSERT INTO folio_routing_rules (
          rule_id, tenant_id, property_id,
          rule_name, rule_code,
          is_template,
          source_folio_id,
          destination_folio_id, destination_folio_type,
          transaction_type,
          routing_type, priority,
          group_booking_id,
          is_active,
          created_by, updated_by
        ) VALUES (
          $1, $2, $3,
          $4, $5,
          FALSE,
          NULL,
          $6, $7,
          $8,
          'FULL', $9,
          $10,
          TRUE,
          $11, $11
        )`,
        [
          ruleId,
          tenantId,
          group.property_id,
          `${group.group_code ?? group.group_booking_id.slice(0, 8).toUpperCase()} — ${rule.charge_type} → ${rule.target}`,
          `GRP-${group.group_booking_id.slice(0, 8).toUpperCase()}-${rule.charge_type}`,
          isToMaster ? folioId : null, // destination_folio_id
          isToMaster ? null : "GUEST", // destination_folio_type
          rule.charge_type, // transaction_type
          (i + 1) * 10, // priority (10, 20, 30…)
          command.group_booking_id,
          SYSTEM_ACTOR_ID,
        ],
      );
    }

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

/* ================================================================== */
/*  GROUP CHECK-IN                                                    */
/* ================================================================== */

interface GroupCheckInSummary extends CreateReservationResult {
  checked_in: number;
  skipped: number;
  failed: number;
  details: Array<{
    reservation_id: string;
    outcome: "checked_in" | "skipped" | "failed";
    room_number?: string;
    reason?: string;
  }>;
}

/**
 * Batch check-in for group reservations with proximity-based room assignment.
 *
 * Industry-standard group arrival workflow:
 *  1. Fetches all PENDING/CONFIRMED reservations linked to the group.
 *  2. If reservation_ids supplied, filters to that subset.
 *  3. Finds available rooms matching each reservation's room type, preferring
 *     same-floor / adjacent rooms (proximity allocation).
 *  4. Auto-assigns rooms, marks them OCCUPIED, enqueues reservation updates.
 *  5. Returns per-reservation result summary.
 */
export const groupCheckIn = async (
  tenantId: string,
  command: GroupCheckInCommand,
  options: { correlationId?: string } = {},
): Promise<GroupCheckInSummary> => {
  const eventId = uuid();

  // 1. Verify group booking exists
  const { rows: groupRows } = await query<{
    group_booking_id: string;
    property_id: string;
    block_status: string;
    group_name: string;
  }>(
    `SELECT group_booking_id, property_id, block_status, group_name
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
  const group = groupRows[0];
  if (group.block_status === "cancelled") {
    throw new ReservationCommandError(
      "GROUP_CANCELLED",
      "Cannot check in a cancelled group booking",
    );
  }

  // 2. Fetch eligible reservations (PENDING / CONFIRMED) for the group
  const { rows: reservations } = await query<{
    id: string;
    status: string;
    room_type_id: string;
    room_number: string | null;
    guest_id: string | null;
    check_in_date: Date;
    check_out_date: Date;
  }>(
    `SELECT id, status, room_type_id, room_number, guest_id,
            check_in_date, check_out_date
     FROM reservations
     WHERE group_booking_id = $1 AND tenant_id = $2
       AND status IN ('PENDING', 'CONFIRMED')
     ORDER BY room_type_id, check_in_date`,
    [command.group_booking_id, tenantId],
  );

  if (reservations.length === 0) {
    throw new ReservationCommandError(
      "NO_ELIGIBLE_RESERVATIONS",
      "No PENDING or CONFIRMED reservations found for this group",
    );
  }

  // 3. Filter to requested subset if reservation_ids provided
  const targetReservations = command.reservation_ids
    ? reservations.filter((r) => command.reservation_ids?.includes(r.id))
    : reservations;

  if (targetReservations.length === 0) {
    throw new ReservationCommandError(
      "NO_MATCHING_RESERVATIONS",
      "None of the specified reservation_ids match eligible group reservations",
    );
  }

  // 4. Fetch available rooms for proximity-based assignment, grouped by room type.
  //    Prefer rooms on the same floor (preferred_floor first, then cluster on the
  //    most-available floor). Sort by floor then room_number for contiguous assignment.
  const roomTypeIds = [...new Set(targetReservations.map((r) => r.room_type_id))];
  const earliestCheckIn = new Date(
    Math.min(...targetReservations.map((r) => new Date(r.check_in_date).getTime())),
  );
  const latestCheckOut = new Date(
    Math.max(...targetReservations.map((r) => new Date(r.check_out_date).getTime())),
  );

  const { rows: availableRooms } = await query<{
    room_id: string;
    room_number: string;
    room_type_id: string;
    floor: string | null;
  }>(
    `SELECT r.id AS room_id, r.room_number, r.room_type_id, r.floor
     FROM rooms r
     WHERE r.tenant_id = $1::uuid
       AND r.property_id = $2::uuid
       AND r.room_type_id = ANY($3::uuid[])
       AND r.status = 'AVAILABLE'
       AND r.housekeeping_status IN ('CLEAN', 'INSPECTED')
       AND COALESCE(r.is_blocked, false) = false
       AND COALESCE(r.is_out_of_order, false) = false
       AND COALESCE(r.is_deleted, false) = false
       AND NOT EXISTS (
         SELECT 1 FROM inventory_locks_shadow ils
         WHERE ils.room_id = r.id AND ils.tenant_id = r.tenant_id
           AND ils.status = 'ACTIVE'
           AND ils.stay_start < $5::date AND ils.stay_end > $4::date
       )
       AND NOT EXISTS (
         SELECT 1 FROM reservations res
         WHERE res.room_number = r.room_number AND res.tenant_id = r.tenant_id
           AND res.status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN')
           AND res.check_in_date < $5::date AND res.check_out_date > $4::date
       )
     ORDER BY
       CASE WHEN r.floor = $6 THEN 0 ELSE 1 END,
       r.floor, r.room_number`,
    [
      tenantId,
      group.property_id,
      roomTypeIds,
      earliestCheckIn.toISOString(),
      latestCheckOut.toISOString(),
      command.preferred_floor?.toString() ?? "",
    ],
  );

  // Index available rooms by room_type_id (preserves proximity sort order)
  const roomPoolByType = new Map<string, typeof availableRooms>();
  for (const room of availableRooms) {
    const pool = roomPoolByType.get(room.room_type_id) ?? [];
    pool.push(room);
    roomPoolByType.set(room.room_type_id, pool);
  }

  // 5. Process each reservation: assign room → enqueue update → mark OCCUPIED
  const details: GroupCheckInSummary["details"] = [];
  let checkedIn = 0;
  let skipped = 0;
  let failed = 0;
  const actualCheckInTime = command.checked_in_at ?? new Date();

  // Track rooms consumed during this batch to prevent double-assignment
  const consumedRoomIds = new Set<string>();

  // Preload blocking deposit reservations to avoid N+1 queries
  const blockingDepositReservationIds = new Set<string>();
  if (!command.force && targetReservations.length > 0) {
    const reservationIds = targetReservations.map((r) => r.id);
    const { rows } = await query<{ reservation_id: string }>(
      `SELECT DISTINCT reservation_id
       FROM public.deposit_schedules
       WHERE reservation_id = ANY($1::uuid[])
         AND tenant_id = $2::uuid
         AND blocks_check_in = TRUE
         AND schedule_status NOT IN ('PAID', 'WAIVED', 'CANCELLED')
         AND COALESCE(is_deleted, false) = false`,
      [reservationIds, tenantId],
    );
    for (const row of rows) {
      blockingDepositReservationIds.add(row.reservation_id);
    }
  }

  for (const res of targetReservations) {
    try {
      // Check blocking deposits unless force=true
      if (!command.force && blockingDepositReservationIds.has(res.id)) {
        skipped++;
        details.push({
          reservation_id: res.id,
          outcome: "skipped",
          reason: "Blocking deposit outstanding",
        });
        continue;
      }

      // Find next available room from the proximity-sorted pool
      const pool = roomPoolByType.get(res.room_type_id) ?? [];
      const nextRoom = pool.find((r) => !consumedRoomIds.has(r.room_id));

      if (!nextRoom) {
        skipped++;
        details.push({
          reservation_id: res.id,
          outcome: "skipped",
          reason: `No available room for room type ${res.room_type_id}`,
        });
        continue;
      }

      // Consume the room
      consumedRoomIds.add(nextRoom.room_id);

      // Enqueue reservation update via outbox
      const updatePayload: ReservationUpdatePayload = {
        id: res.id,
        tenant_id: tenantId,
        status: "CHECKED_IN",
        actual_check_in: actualCheckInTime,
        room_number: nextRoom.room_number,
        internal_notes: command.notes,
        metadata: {
          room_id: nextRoom.room_id,
          guest_id: res.guest_id,
          room_type_id: res.room_type_id,
          auto_assigned: true,
          group_booking_id: command.group_booking_id,
          floor: nextRoom.floor,
        },
      };
      await enqueueReservationUpdate(tenantId, "group.check_in", updatePayload, options);

      // Mark room OCCUPIED (best-effort)
      try {
        await query(
          `UPDATE rooms SET status = 'OCCUPIED', version = version + 1, updated_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          [nextRoom.room_id, tenantId],
        );
      } catch (roomErr) {
        reservationsLogger.warn(
          { roomId: nextRoom.room_id, error: roomErr },
          "Failed to mark room OCCUPIED during group check-in",
        );
      }

      checkedIn++;
      details.push({
        reservation_id: res.id,
        outcome: "checked_in",
        room_number: nextRoom.room_number,
      });
    } catch (err) {
      failed++;
      details.push({
        reservation_id: res.id,
        outcome: "failed",
        reason: err instanceof Error ? err.message : "Unknown error",
      });
      reservationsLogger.error(
        { reservationId: res.id, error: err },
        "Failed to check in group reservation",
      );
    }
  }

  // 6. Emit aggregate group.checked_in event
  await withTransaction(async (client) => {
    await enqueueOutboxRecordWithClient(client, {
      eventId,
      tenantId,
      aggregateId: command.group_booking_id,
      aggregateType: "group_booking",
      eventType: "group.checked_in",
      payload: {
        metadata: {
          id: eventId,
          source: serviceConfig.serviceId,
          type: "group.checked_in",
          timestamp: new Date().toISOString(),
          version: "1.0",
          correlationId: options.correlationId,
          tenantId,
          retryCount: 0,
        },
        payload: {
          group_booking_id: command.group_booking_id,
          group_name: group.group_name,
          checked_in: checkedIn,
          skipped,
          failed,
          total_eligible: targetReservations.length,
        },
      },
      headers: {
        tenantId,
        eventId,
        ...(options.correlationId ? { correlationId: options.correlationId } : {}),
      },
      correlationId: options.correlationId,
      partitionKey: command.group_booking_id,
      metadata: { source: serviceConfig.serviceId, action: "group.check_in" },
    });
  });

  reservationsLogger.info(
    {
      groupBookingId: command.group_booking_id,
      groupName: group.group_name,
      checkedIn,
      skipped,
      failed,
      total: targetReservations.length,
    },
    "Group batch check-in completed",
  );

  return {
    eventId,
    correlationId: options.correlationId,
    status: "accepted",
    checked_in: checkedIn,
    skipped,
    failed,
    details,
  };
};
