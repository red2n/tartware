import { auditAsync } from "../../lib/audit-logger.js";
import { query, queryWithClient, withTransaction } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingGroupAddReservationCommandSchema,
  BillingGroupCheckoutCommandSchema,
  BillingGroupSetupCommandSchema,
} from "../../schemas/billing-commands.js";

import {
  asUuid,
  BillingCommandError,
  type CommandContext,
  resolveActorId,
  SYSTEM_ACTOR_ID,
} from "./common.js";

// ─── Setup group master billing ───────────────────────────────────────────────

/**
 * Bootstrap group billing: create MASTER folio + routing rules for all group reservations.
 *
 * Idempotent: ON CONFLICT DO NOTHING for both master folio and routing rules.
 * Fires automatically when a group booking is confirmed.
 */
export const setupGroupBilling = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingGroupSetupCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Validate group booking exists and load its reservations
  const { rows: groupRows } = await query<{ group_booking_id: string; group_name: string }>(
    `SELECT group_booking_id, group_name FROM group_bookings
      WHERE group_booking_id = $1::uuid AND tenant_id = $2::uuid`,
    [command.group_booking_id, tenantId],
  );
  const group = groupRows[0];
  if (!group) {
    throw new BillingCommandError(
      "GROUP_NOT_FOUND",
      `Group booking ${command.group_booking_id} not found.`,
    );
  }

  const { rows: reservationRows } = await query<{ id: string }>(
    `SELECT id FROM reservations
      WHERE group_booking_id = $1::uuid AND tenant_id = $2::uuid
        AND status NOT IN ('CANCELLED', 'NO_SHOW')`,
    [command.group_booking_id, tenantId],
  );

  const folioNumber = `MASTER-${command.group_booking_id.slice(0, 8).toUpperCase()}`;

  const { rows: folioRows } = await withTransaction(async (client) => {
    // Create master folio (idempotent)
    const created = await queryWithClient<{ folio_id: string }>(
      client,
      `INSERT INTO folios (
          tenant_id, property_id, folio_number, folio_type, folio_status,
          group_booking_id,
          notes, created_by, updated_by
        ) VALUES (
          $1::uuid, $2::uuid, $3, 'MASTER', 'OPEN',
          $4::uuid,
          $5, $6::uuid, $6::uuid
        )
        ON CONFLICT (tenant_id, folio_number) DO NOTHING
        RETURNING folio_id`,
      [
        tenantId,
        command.property_id,
        folioNumber,
        command.group_booking_id,
        command.notes ?? `Master folio for group ${group.group_name}`,
        actorId,
      ],
    );

    // Look up existing folio if insert was a no-op
    let masterFolioId = created.rows[0]?.folio_id;
    if (!masterFolioId) {
      const { rows: existing } = await queryWithClient<{ folio_id: string }>(
        client,
        `SELECT folio_id FROM folios WHERE tenant_id = $1::uuid AND folio_number = $2`,
        [tenantId, folioNumber],
      );
      masterFolioId = existing[0]?.folio_id;
    }

    if (!masterFolioId) {
      throw new BillingCommandError("MASTER_FOLIO_FAILED", "Could not create master folio.");
    }

    // Create routing rules for each reservation
    for (const res of reservationRows) {
      // Route room charges to master folio
      await queryWithClient(
        client,
        `INSERT INTO folio_routing_rules (
            tenant_id, property_id, reservation_id,
            charge_code_pattern, target_folio_id,
            routing_percent, priority, is_active,
            created_by, updated_by
          ) VALUES (
            $1::uuid, $2::uuid, $3::uuid,
            'ROOM%', $4::uuid,
            $5, 10, TRUE,
            $6::uuid, $6::uuid
          )
          ON CONFLICT (tenant_id, reservation_id, charge_code_pattern, target_folio_id) DO NOTHING`,
        [
          tenantId,
          command.property_id,
          res.id,
          masterFolioId,
          command.master_billing_percent,
          actorId,
        ],
      );

      // Route incidentals if requested
      if (command.route_incidentals_to_master) {
        await queryWithClient(
          client,
          `INSERT INTO folio_routing_rules (
              tenant_id, property_id, reservation_id,
              charge_code_pattern, target_folio_id,
              routing_percent, priority, is_active,
              created_by, updated_by
            ) VALUES (
              $1::uuid, $2::uuid, $3::uuid,
              '%', $4::uuid,
              100, 20, TRUE,
              $5::uuid, $5::uuid
            )
            ON CONFLICT (tenant_id, reservation_id, charge_code_pattern, target_folio_id) DO NOTHING`,
          [tenantId, command.property_id, res.id, masterFolioId, actorId],
        );
      }
    }

    return created;
  });

  const masterFolioId = folioRows[0]?.folio_id;
  appLogger.info(
    {
      masterFolioId,
      groupBookingId: command.group_booking_id,
      reservationCount: reservationRows.length,
    },
    "Group master billing setup complete",
  );
  auditAsync({
    tenantId,
    propertyId: command.property_id,
    userId: actorId,
    action: "GROUP_BILLING_SETUP",
    entityType: "folio",
    entityId: masterFolioId ?? command.group_booking_id,
    severity: "INFO",
    description: `Master folio ${folioNumber} created for group ${group.group_name}`,
    newValues: {
      group_booking_id: command.group_booking_id,
      reservation_count: reservationRows.length,
      master_billing_percent: command.master_billing_percent,
    },
  });
  return masterFolioId ?? folioNumber;
};

// ─── Group checkout ───────────────────────────────────────────────────────────

/**
 * Orchestrated group checkout.
 *
 * Steps:
 *  1. Check all individual folios are settled (zero balance) unless force=true.
 *  2. Retrieve master folio.
 *  3. Close all individual folios.
 *  4. Close master folio (sets status to CLOSED).
 */
export const checkoutGroup = async (payload: unknown, context: CommandContext): Promise<string> => {
  const command = BillingGroupCheckoutCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Load master folio
  const { rows: masterRows } = await query<{
    folio_id: string;
    folio_status: string;
    balance: string;
  }>(
    `SELECT folio_id, folio_status, COALESCE(balance, 0) AS balance
       FROM folios
      WHERE tenant_id = $1::uuid AND group_booking_id = $2::uuid
        AND folio_type = 'MASTER'`,
    [tenantId, command.group_booking_id],
  );

  const masterFolio = masterRows[0];
  if (!masterFolio) {
    throw new BillingCommandError(
      "MASTER_FOLIO_NOT_FOUND",
      `No master folio found for group ${command.group_booking_id}.`,
    );
  }

  // Load individual folios
  const { rows: indivFolios } = await query<{
    folio_id: string;
    balance: string;
    reservation_id: string | null;
  }>(
    `SELECT f.folio_id, COALESCE(f.balance, 0) AS balance, f.reservation_id
       FROM folios f
       JOIN reservations r ON r.id = f.reservation_id
      WHERE f.tenant_id = $1::uuid AND r.group_booking_id = $2::uuid
        AND f.folio_type != 'MASTER' AND f.folio_status = 'OPEN'
        AND COALESCE(f.is_deleted, false) = false`,
    [tenantId, command.group_booking_id],
  );

  // Guard: unsettled individual folios block checkout unless force=true
  if (!command.force) {
    const unsettled = indivFolios.filter((f) => Number(f.balance) !== 0);
    if (unsettled.length > 0) {
      throw new BillingCommandError(
        "UNSETTLED_FOLIOS",
        `${unsettled.length} individual folio(s) have non-zero balances. Use force=true to override.`,
      );
    }
  }

  await withTransaction(async (client) => {
    // Close individual folios
    for (const f of indivFolios) {
      await queryWithClient(
        client,
        `UPDATE folios SET folio_status = 'CLOSED', closed_at = NOW(), updated_at = NOW(), updated_by = $1::uuid
          WHERE folio_id = $2::uuid AND tenant_id = $3::uuid`,
        [actorId, f.folio_id, tenantId],
      );
    }

    // Close master folio
    await queryWithClient(
      client,
      `UPDATE folios SET folio_status = 'CLOSED', closed_at = NOW(), updated_at = NOW(), updated_by = $1::uuid
        WHERE folio_id = $2::uuid AND tenant_id = $3::uuid`,
      [actorId, masterFolio.folio_id, tenantId],
    );

    // Update group booking status
    await queryWithClient(
      client,
      `UPDATE group_bookings SET status = 'CHECKED_OUT', updated_at = NOW()
        WHERE group_booking_id = $1::uuid AND tenant_id = $2::uuid`,
      [command.group_booking_id, tenantId],
    );
  });

  appLogger.info(
    { masterFolioId: masterFolio.folio_id, groupBookingId: command.group_booking_id },
    "Group checkout complete",
  );
  return masterFolio.folio_id;
};

// ─── Add reservation to group billing ────────────────────────────────────────

/**
 * Add a late-added reservation to an existing group's billing setup.
 *
 * Creates routing rules for the new reservation pointing to the existing master folio.
 */
export const addReservationToGroup = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingGroupAddReservationCommandSchema.parse(payload);
  const actorId = asUuid(resolveActorId(context.initiatedBy)) ?? SYSTEM_ACTOR_ID;
  const { tenantId } = context;

  // Find master folio
  const { rows: masterRows } = await query<{ folio_id: string }>(
    `SELECT folio_id FROM folios
      WHERE tenant_id = $1::uuid AND group_booking_id = $2::uuid
        AND folio_type = 'MASTER' AND folio_status = 'OPEN'`,
    [tenantId, command.group_booking_id],
  );

  const masterFolioId = masterRows[0]?.folio_id;
  if (!masterFolioId) {
    throw new BillingCommandError(
      "MASTER_FOLIO_NOT_FOUND",
      `No open master folio found for group ${command.group_booking_id}.`,
    );
  }

  await query(
    `INSERT INTO folio_routing_rules (
        tenant_id, property_id, reservation_id,
        charge_code_pattern, target_folio_id,
        routing_percent, priority, is_active,
        created_by, updated_by
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid,
        'ROOM%', $4::uuid,
        100, 10, TRUE,
        $5::uuid, $5::uuid
      )
      ON CONFLICT (tenant_id, reservation_id, charge_code_pattern, target_folio_id) DO NOTHING`,
    [tenantId, command.property_id, command.reservation_id, masterFolioId, actorId],
  );

  appLogger.info(
    { reservationId: command.reservation_id, masterFolioId },
    "Reservation added to group billing",
  );
  return masterFolioId;
};
