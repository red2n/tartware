import { randomUUID } from "node:crypto";
import { publishCommand } from "../kafka/producer.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "checkout-service" });

export class CheckoutServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CheckoutServiceError";
  }
}

/**
 * Look up a checked-in reservation by confirmation code for self-service checkout.
 */
export async function lookupCheckedInReservation(confirmationCode: string): Promise<{
  id: string;
  tenant_id: string;
  guest_id: string;
  property_id: string;
  room_number: string | null;
  check_out_date: string;
  status: string;
  folio_balance: number;
} | null> {
  const result = await query<{
    id: string;
    tenant_id: string;
    guest_id: string;
    property_id: string;
    room_number: string | null;
    check_out_date: string;
    status: string;
    folio_balance: string;
  }>(
    `SELECT r.id, r.tenant_id, r.guest_id, r.property_id, r.room_number,
            r.check_out_date::text,
            r.status,
            COALESCE(f.balance, 0) AS folio_balance
     FROM reservations r
     LEFT JOIN LATERAL (
       SELECT balance FROM folios
       WHERE reservation_id = r.id AND tenant_id = r.tenant_id
         AND COALESCE(is_deleted, false) = false
       ORDER BY created_at DESC LIMIT 1
     ) f ON true
     WHERE r.confirmation_code = $1
       AND r.status = 'CHECKED_IN'
       AND r.is_deleted = false
     LIMIT 1`,
    [confirmationCode],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    guest_id: row.guest_id,
    property_id: row.property_id,
    room_number: row.room_number,
    check_out_date: row.check_out_date,
    status: row.status,
    folio_balance: Number(row.folio_balance),
  };
}

/**
 * Initiate self-service checkout by publishing a reservation.check_out
 * command to the command center via Kafka.
 */
export async function initiateSelfServiceCheckout(params: {
  reservationId: string;
  tenantId: string;
  guestId: string;
  propertyId: string;
  express: boolean;
  notes?: string;
}): Promise<{ commandId: string; status: string }> {
  const commandId = randomUUID();

  const envelope = {
    metadata: {
      commandId,
      commandName: "reservation.check_out",
      tenantId: params.tenantId,
      targetService: "reservations-command-service",
      initiatedBy: params.guestId,
      requestId: commandId,
      timestamp: new Date().toISOString(),
    },
    payload: {
      reservation_id: params.reservationId,
      express: params.express,
      notes: params.notes ?? "Self-service checkout via guest experience portal",
      metadata: { self_service: true, guest_initiated: true },
    },
  };

  await publishCommand({
    key: params.reservationId,
    value: JSON.stringify(envelope),
    headers: {
      commandName: "reservation.check_out",
      tenantId: params.tenantId,
      targetService: "reservations-command-service",
    },
  });

  logger.info(
    {
      commandId,
      reservationId: params.reservationId,
      guestId: params.guestId,
    },
    "Self-service checkout command published",
  );

  return { commandId, status: "checkout_initiated" };
}
