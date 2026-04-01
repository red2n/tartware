import { randomUUID } from "node:crypto";
import type {
  AuthorizationResult,
  AvailabilityResponse,
  AvailableRoomType,
  BookingLookupResult,
  BookingResult,
  CaptureResult,
  CreateBookingInput,
  RefundResult,
  SearchAvailabilityInput,
} from "@tartware/schemas";

import { config } from "../config.js";
import { publishCommand } from "../kafka/producer.js";
import { query } from "../lib/db.js";
import { internalGet } from "../lib/internal-api.js";
import { appLogger } from "../lib/logger.js";

export type { AuthorizationResult, CaptureResult, RefundResult };

const logger = appLogger.child({ module: "booking-service" });

// ─── PaymentGateway Interface ──────────────────────────────────────

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
  async authorize(amount: number, currency: string, token: string): Promise<AuthorizationResult> {
    const result: AuthorizationResult = {
      authorizationId: `auth_${randomUUID().slice(0, 12)}`,
      status: "authorized",
      amount,
      currency,
    };
    logger.info(
      { ...result, tokenProvided: token.trim().length > 0 },
      "[StubPaymentGateway] payment authorized",
    );
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

/**
 * Search for available room types for given dates.
 * Delegates to rooms-service and aggregates individual rooms by room type.
 */
export const searchAvailability = async (
  input: SearchAvailabilityInput,
): Promise<AvailableRoomType[]> => {
  const totalOccupancy = (input.adults ?? 1) + (input.children ?? 0);

  const response = await internalGet<AvailabilityResponse>(
    config.internalServices.roomsServiceUrl,
    "/v1/rooms/availability",
    {
      tenant_id: input.tenantId,
      property_id: input.propertyId,
      check_in_date: input.checkInDate,
      check_out_date: input.checkOutDate,
      adults: totalOccupancy,
      limit: 200,
    },
  );

  // Aggregate individual rooms by room type
  const typeMap = new Map<string, AvailableRoomType>();

  for (const room of response.available_rooms) {
    const existing = typeMap.get(room.room_type_id);
    if (existing) {
      existing.availableCount++;
      if (room.base_rate < existing.baseRate) {
        existing.baseRate = room.base_rate;
      }
    } else {
      typeMap.set(room.room_type_id, {
        roomTypeId: room.room_type_id,
        roomTypeName: room.room_type_name,
        description: null,
        maxOccupancy: room.max_occupancy,
        baseRate: room.base_rate,
        currency: room.currency,
        amenities: room.features,
        availableCount: 1,
      });
    }
  }

  return Array.from(typeMap.values()).sort((a, b) => a.baseRate - b.baseRate);
};

// ─── Booking Orchestration ──────────────────────────────────────

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

  // 2. Verify availability and look up rate for total_amount
  const availableTypes = await searchAvailability({
    tenantId: input.tenantId,
    propertyId: input.propertyId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    adults: input.adults,
    children: input.children,
  });
  const selectedType = availableTypes.find((r) => r.roomTypeId === input.roomTypeId);
  if (!selectedType) {
    throw new Error(`Room type ${input.roomTypeId} is not available for the selected dates`);
  }
  const nights = Math.max(
    1,
    Math.ceil(
      (new Date(input.checkOutDate).getTime() - new Date(input.checkInDate).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const totalAmount = selectedType.baseRate * nights;

  // 3. Generate reservation IDs
  const reservationId = randomUUID();
  // Must match the format used by reservation-event-handler.ts
  const confirmationCode = `TW-${reservationId.slice(0, 8).toUpperCase()}`;
  const commandId = randomUUID();

  // 4. Submit reservation.create command via Kafka
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
        source: "WEBSITE",
        total_amount: totalAmount,
        currency: selectedType.currency,
        special_requests: input.specialRequests ?? null,
      },
    }),
    topic: config.commandCenter.topic,
  });

  // 5. Optionally authorize payment
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

  // 6. Emit confirmation notification command
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
        guest_id: guestId,
        property_id: input.propertyId,
        template_code: "BOOKING_CONFIRMED",
        reservation_id: reservationId,
        recipient_name: `${input.guestFirstName} ${input.guestLastName}`,
        recipient_email: input.guestEmail,
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
    r.confirmation_number, r.status,
    r.check_in_date, r.check_out_date,
    r.room_number, r.number_of_adults, r.number_of_children,
    g.first_name, g.last_name, g.email,
    p.property_name
  FROM reservations r
  JOIN guests g ON g.id = r.guest_id
  JOIN properties p ON p.id = r.property_id
  WHERE r.confirmation_number = $1
`;

/**
 * Look up a booking by confirmation code (guest-facing, no JWT).
 * Retries with short delays to handle async Kafka processing lag.
 */
export const lookupBooking = async (
  confirmationCode: string,
): Promise<BookingLookupResult | null> => {
  const maxAttempts = 5;
  const delayMs = 500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { rows } = await query<BookingLookupResult>(BOOKING_LOOKUP_SQL, [confirmationCode]);
    if (rows[0]) return rows[0];
    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
};

// ─── Helpers ──────────────────────────────────────

const INSERT_GUEST_SQL = `
  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (tenant_id, email) WHERE deleted_at IS NULL DO UPDATE SET updated_at = NOW(), version = guests.version + 1
  RETURNING id
`;

const findOrCreateGuest = async (input: {
  tenantId: string;
  guestEmail: string;
  guestFirstName: string;
  guestLastName: string;
  guestPhone?: string;
}): Promise<string> => {
  // Look up existing guest via guests-service
  try {
    const guests = await internalGet<Array<{ id: string }>>(
      config.internalServices.guestsServiceUrl,
      "/v1/guests",
      {
        tenant_id: input.tenantId,
        email: input.guestEmail,
        limit: 1,
      },
    );
    if (guests.length > 0 && guests[0]) {
      return guests[0].id;
    }
  } catch (error) {
    logger.warn({ err: error }, "guest lookup via guests-service failed, falling back to DB");
  }

  // Create new guest (no sync create endpoint in guests-service)
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
