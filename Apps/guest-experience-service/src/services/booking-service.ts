import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { publishCommand } from "../kafka/producer.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "booking-service" });

// ─── PaymentGateway Interface ──────────────────────────────────────

export type AuthorizationResult = {
  authorizationId: string;
  status: "authorized" | "declined";
  amount: number;
  currency: string;
};

export type CaptureResult = {
  paymentId: string;
  status: "captured" | "failed";
  amount: number;
};

export type RefundResult = {
  refundId: string;
  status: "refunded" | "failed";
  amount: number;
};

/**
 * Payment gateway abstraction. Real implementations connect to Stripe, Adyen, etc.
 */
export interface PaymentGateway {
  /** Pre-authorize a payment amount. */
  authorize(amount: number, currency: string, token: string): Promise<AuthorizationResult>;

  /** Capture a previously authorized payment. */
  capture(authorizationId: string): Promise<CaptureResult>;

  /** Refund a captured payment (full or partial). */
  refund(paymentId: string, amount: number): Promise<RefundResult>;
}

// ─── Stub PaymentGateway (dev/test) ────────────────────────

/**
 * Development/test stub that logs payment operations.
 */
export class StubPaymentGateway implements PaymentGateway {
  async authorize(amount: number, currency: string, _token: string): Promise<AuthorizationResult> {
    const result: AuthorizationResult = {
      authorizationId: `auth_${randomUUID().slice(0, 12)}`,
      status: "authorized",
      amount,
      currency,
    };
    logger.info(result, "[StubPaymentGateway] payment authorized");
    return result;
  }

  async capture(authorizationId: string): Promise<CaptureResult> {
    const result: CaptureResult = {
      paymentId: `pay_${randomUUID().slice(0, 12)}`,
      status: "captured",
      amount: 0,
    };
    logger.info({ ...result, authorizationId }, "[StubPaymentGateway] payment captured");
    return result;
  }

  async refund(paymentId: string, amount: number): Promise<RefundResult> {
    const result: RefundResult = {
      refundId: `ref_${randomUUID().slice(0, 12)}`,
      status: "refunded",
      amount,
    };
    logger.info({ ...result, paymentId }, "[StubPaymentGateway] payment refunded");
    return result;
  }
}

// ─── Availability Search ──────────────────────────────────────

const AVAILABILITY_SEARCH_SQL = `
  SELECT
    rt.id AS room_type_id,
    rt.name AS room_type_name,
    rt.description,
    rt.max_occupancy,
    rt.base_rate,
    COUNT(r.id) AS available_count
  FROM room_types rt
  JOIN rooms r ON r.room_type_id = rt.id
    AND r.property_id = $2
    AND r.status = 'AVAILABLE'
    AND r.is_deleted = FALSE
    AND r.id NOT IN (
      SELECT res.room_id FROM reservations res
      WHERE res.property_id = $2
        AND res.status IN ('CONFIRMED', 'CHECKED_IN', 'GUARANTEED')
        AND res.check_in_date < $4
        AND res.check_out_date > $3
        AND res.room_id IS NOT NULL
    )
  WHERE rt.property_id = $2
    AND rt.tenant_id = $1
    AND rt.is_deleted = FALSE
  GROUP BY rt.id, rt.name, rt.description, rt.max_occupancy, rt.base_rate
  HAVING COUNT(r.id) > 0
  ORDER BY rt.base_rate ASC
`;

type AvailabilityRow = {
  room_type_id: string;
  room_type_name: string;
  description: string | null;
  max_occupancy: number;
  base_rate: string;
  available_count: string;
};

export type SearchAvailabilityInput = {
  tenantId: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  children?: number;
};

export type AvailableRoomType = {
  roomTypeId: string;
  roomTypeName: string;
  description: string | null;
  maxOccupancy: number;
  baseRate: number;
  availableCount: number;
};

/**
 * Search for available room types for given dates.
 */
export const searchAvailability = async (
  input: SearchAvailabilityInput,
): Promise<AvailableRoomType[]> => {
  const { rows } = await query<AvailabilityRow>(AVAILABILITY_SEARCH_SQL, [
    input.tenantId,
    input.propertyId,
    input.checkInDate,
    input.checkOutDate,
  ]);

  const minOccupancy = (input.adults ?? 1) + (input.children ?? 0);

  return rows
    .filter((row) => row.max_occupancy >= minOccupancy)
    .map((row) => ({
      roomTypeId: row.room_type_id,
      roomTypeName: row.room_type_name,
      description: row.description,
      maxOccupancy: row.max_occupancy,
      baseRate: Number(row.base_rate),
      availableCount: Number(row.available_count),
    }));
};

// ─── Booking Orchestration ──────────────────────────────────────

export type CreateBookingInput = {
  tenantId: string;
  propertyId: string;
  guestEmail: string;
  guestFirstName: string;
  guestLastName: string;
  guestPhone?: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children?: number;
  paymentToken?: string;
  specialRequests?: string;
  idempotencyKey?: string;
};

export type BookingResult = {
  reservationId: string;
  confirmationCode: string;
  status: string;
  guestId: string;
  paymentAuthorization?: AuthorizationResult;
};

/**
 * Orchestrate a direct booking:
 * 1. Find or create guest
 * 2. Submit reservation.create command via Kafka
 * 3. Optionally authorize payment deposit
 * 4. Emit confirmation notification
 *
 * Returns immediately after submitting commands (async processing).
 */
export const createBooking = async (
  input: CreateBookingInput,
  paymentGateway: PaymentGateway,
): Promise<BookingResult> => {
  // 1. Find or create guest
  const guestId = await findOrCreateGuest(input);

  // 2. Generate reservation IDs
  const reservationId = randomUUID();
  const confirmationCode = generateConfirmationCode();
  const commandId = randomUUID();

  // 3. Submit reservation.create command via Kafka
  await publishCommand({
    key: reservationId,
    value: JSON.stringify({
      metadata: {
        commandId,
        commandName: "reservation.create",
        tenantId: input.tenantId,
        targetService: "reservations-command-service",
        timestamp: new Date().toISOString(),
        idempotencyKey: input.idempotencyKey ?? commandId,
      },
      payload: {
        reservation_id: reservationId,
        tenant_id: input.tenantId,
        property_id: input.propertyId,
        guest_id: guestId,
        room_type_id: input.roomTypeId,
        check_in_date: input.checkInDate,
        check_out_date: input.checkOutDate,
        adults: input.adults,
        children: input.children ?? 0,
        confirmation_code: confirmationCode,
        source: "direct_booking",
        special_requests: input.specialRequests ?? null,
      },
    }),
    topic: config.commandCenter.topic,
  });

  // 4. Optionally authorize payment
  let paymentAuth: AuthorizationResult | undefined;
  if (input.paymentToken) {
    try {
      paymentAuth = await paymentGateway.authorize(0, "USD", input.paymentToken);
    } catch (error) {
      logger.warn(
        { err: error, reservationId },
        "payment authorization failed — booking continues without deposit",
      );
    }
  }

  // 5. Emit confirmation notification command
  await publishCommand({
    key: reservationId,
    value: JSON.stringify({
      metadata: {
        commandId: randomUUID(),
        commandName: "notification.send",
        tenantId: input.tenantId,
        targetService: "notification-service",
        timestamp: new Date().toISOString(),
      },
      payload: {
        tenant_id: input.tenantId,
        template_name: "BOOKING_CONFIRMED",
        channel: "email",
        recipient: {
          guest_id: guestId,
          email: input.guestEmail,
          name: `${input.guestFirstName} ${input.guestLastName}`,
        },
        context: {
          confirmation_code: confirmationCode,
          check_in_date: input.checkInDate,
          check_out_date: input.checkOutDate,
        },
      },
    }),
    topic: config.commandCenter.topic,
  });

  logger.info({ reservationId, confirmationCode, guestId }, "direct booking submitted");

  return {
    reservationId,
    confirmationCode,
    status: "PENDING",
    guestId,
    paymentAuthorization: paymentAuth,
  };
};

// ─── Booking Lookup ──────────────────────────────────────

const BOOKING_LOOKUP_SQL = `
  SELECT
    r.id, r.tenant_id, r.property_id, r.guest_id,
    r.confirmation_code, r.status,
    r.check_in_date, r.check_out_date,
    r.room_id, r.adults, r.children,
    g.first_name, g.last_name, g.email,
    p.name AS property_name
  FROM reservations r
  JOIN guests g ON g.id = r.guest_id
  JOIN properties p ON p.id = r.property_id
  WHERE r.confirmation_code = $1
`;

type BookingLookupRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  guest_id: string;
  confirmation_code: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  room_id: string | null;
  adults: number;
  children: number;
  first_name: string;
  last_name: string;
  email: string;
  property_name: string;
};

/**
 * Look up a booking by confirmation code (guest-facing, no JWT).
 */
export const lookupBooking = async (confirmationCode: string): Promise<BookingLookupRow | null> => {
  const { rows } = await query<BookingLookupRow>(BOOKING_LOOKUP_SQL, [confirmationCode]);
  return rows[0] ?? null;
};

// ─── Helpers ──────────────────────────────────────

const FIND_GUEST_SQL = `
  SELECT id FROM guests
  WHERE email = $1 AND tenant_id = $2
  LIMIT 1
`;

const INSERT_GUEST_SQL = `
  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone, source)
  VALUES ($1, $2, $3, $4, $5, $6, 'online_booking')
  ON CONFLICT (email, tenant_id) DO UPDATE SET updated_at = NOW()
  RETURNING id
`;

const findOrCreateGuest = async (input: {
  tenantId: string;
  guestEmail: string;
  guestFirstName: string;
  guestLastName: string;
  guestPhone?: string;
}): Promise<string> => {
  // Try to find existing guest
  const { rows: existing } = await query<{ id: string }>(FIND_GUEST_SQL, [
    input.guestEmail,
    input.tenantId,
  ]);
  if (existing.length > 0 && existing[0]) {
    return existing[0].id;
  }

  // Create new guest
  const guestId = randomUUID();
  const { rows } = await query<{ id: string }>(INSERT_GUEST_SQL, [
    guestId,
    input.tenantId,
    input.guestFirstName,
    input.guestLastName,
    input.guestEmail,
    input.guestPhone ?? null,
  ]);

  return rows[0]?.id ?? guestId;
};

const generateConfirmationCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    code += chars[byte % chars.length];
  }
  return code;
};
