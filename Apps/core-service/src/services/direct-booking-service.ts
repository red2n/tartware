/**
 * DEV DOC
 * Module: services/direct-booking-service.ts
 * Purpose: Guest-facing direct booking engine — availability search, rate quotes,
 *          and booking confirmation. Aggregates data from rooms, rates, and
 *          promotional code tables for a self-service booking flow.
 * Ownership: Core service
 * S30 — Direct Booking Engine
 */

import {
  type AvailabilityResult,
  AvailabilityResultSchema,
  type BookingConfirmation,
  BookingConfirmationSchema,
  type RateQuote,
  RateQuoteSchema,
} from "@tartware/schemas";

import { query } from "../lib/db.js";

// Re-export schemas for route consumers
export {
  AvailabilityResultSchema,
  type AvailabilityResult,
  RateQuoteSchema,
  type RateQuote,
  BookingConfirmationSchema,
  type BookingConfirmation,
};

// ---------------------------------------------------------------------------
// 1. Availability Search
// ---------------------------------------------------------------------------

export const searchAvailability = async (options: {
  tenantId: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  adults?: number;
  children?: number;
  roomTypeId?: string;
}): Promise<AvailabilityResult[]> => {
  const { tenantId, propertyId, checkIn, checkOut, adults, roomTypeId } = options;

  const result = await query<{
    room_type_id: string;
    room_type_name: string;
    description: string | null;
    max_occupancy: number;
    base_price: string | number;
    currency_code: string;
    available_count: string;
    amenities: unknown;
    images: unknown;
    dynamic_rate: string | null;
  }>(
    `WITH booked_rooms AS (
		   SELECT DISTINCT res.room_id
		   FROM public.reservations res
		   WHERE res.tenant_id = $1::uuid
		     AND res.property_id = $2::uuid
		     AND res.status IN ('CONFIRMED','CHECKED_IN','GUARANTEED','PENDING')
		     AND res.room_id IS NOT NULL
		     AND res.check_in_date < $4::date
		     AND res.check_out_date > $3::date
		 )
		 SELECT
		   rt.id            AS room_type_id,
		   rt.type_name     AS room_type_name,
		   rt.description,
		   rt.max_occupancy,
		   rt.base_price,
		   COALESCE(rt.currency_code, 'USD') AS currency_code,
		   COUNT(r.id)::int AS available_count,
		   rt.amenities,
		   rt.images,
		   (SELECT ra.dynamic_price::text
		    FROM public.room_availability ra
		    WHERE ra.room_type_id = rt.id
		      AND ra.tenant_id = $1::uuid
		      AND ra.property_id = $2::uuid
		      AND ra.availability_date = $3::date
		    LIMIT 1
		   ) AS dynamic_rate
		 FROM public.room_types rt
		 JOIN public.rooms r
		   ON r.room_type_id = rt.id
		   AND r.tenant_id = rt.tenant_id
		   AND r.property_id = $2::uuid
		   AND r.status = 'AVAILABLE'
		   AND COALESCE(r.is_blocked, false) = false
		   AND COALESCE(r.is_out_of_order, false) = false
		   AND COALESCE(r.is_deleted, false) = false
		   AND r.id NOT IN (SELECT room_id FROM booked_rooms WHERE room_id IS NOT NULL)
		 WHERE rt.tenant_id = $1::uuid
		   AND rt.property_id = $2::uuid
		   AND COALESCE(rt.is_deleted, false) = false
		   AND COALESCE(rt.is_active, true) = true
		   AND ($5::uuid IS NULL OR rt.id = $5::uuid)
		   AND ($6::int IS NULL OR rt.max_occupancy >= $6)
		 GROUP BY rt.id, rt.type_name, rt.description, rt.max_occupancy,
		          rt.base_price, rt.currency_code, rt.amenities, rt.images
		 HAVING COUNT(r.id) > 0
		 ORDER BY rt.base_price ASC`,
    [tenantId, propertyId, checkIn, checkOut, roomTypeId ?? null, adults ?? null],
  );

  return result.rows.map((row) => {
    const baseRate = Number(row.base_price);
    const dynamicRate = row.dynamic_rate ? Number(row.dynamic_rate) : null;
    return {
      room_type_id: row.room_type_id,
      room_type_name: row.room_type_name,
      description: row.description,
      max_occupancy: row.max_occupancy,
      base_rate: baseRate,
      currency: row.currency_code,
      available_count: Number(row.available_count),
      amenities: row.amenities,
      images: row.images,
      dynamic_rate: dynamicRate,
      best_rate: dynamicRate != null && dynamicRate < baseRate ? dynamicRate : baseRate,
    };
  });
};

// ---------------------------------------------------------------------------
// 2. Rate Quote
// ---------------------------------------------------------------------------

export const getRateQuote = async (options: {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  promoCode?: string;
  rateCode?: string;
}): Promise<RateQuote> => {
  const { tenantId, propertyId, roomTypeId, checkIn, checkOut, promoCode, rateCode } = options;

  // Fetch room type
  const { rows: rtRows } = await query<{
    type_name: string;
    base_price: string | number;
    currency_code: string;
  }>(
    `SELECT type_name, base_price, COALESCE(currency_code, 'USD') AS currency_code
		 FROM public.room_types
		 WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false
		 LIMIT 1`,
    [roomTypeId, tenantId],
  );
  if (!rtRows[0]) {
    throw new Error("Room type not found");
  }
  const roomType = rtRows[0];
  const baseRate = Number(roomType.base_price);

  // Fetch rate plan if rate code provided
  let ratePlanId: string | null = null;
  let ratePlanName: string | null = null;
  let planRate: number | null = null;
  let cancellationPolicy: string | null = null;

  if (rateCode) {
    const { rows: rpRows } = await query<{
      rate_plan_id: string;
      rate_plan_name: string;
      base_amount: string | number;
      cancellation_policy_description: string | null;
    }>(
      `SELECT rp.rate_plan_id, rp.rate_plan_name, rp.base_amount,
			        rp.cancellation_policy_description
			 FROM public.rate_plans rp
			 WHERE rp.rate_code = $1 AND rp.tenant_id = $2
			   AND rp.property_id = $3
			   AND rp.is_active = true
			   AND COALESCE(rp.is_deleted, false) = false
			 LIMIT 1`,
      [rateCode, tenantId, propertyId],
    );
    if (rpRows[0]) {
      ratePlanId = rpRows[0].rate_plan_id;
      ratePlanName = rpRows[0].rate_plan_name;
      planRate = Number(rpRows[0].base_amount);
      cancellationPolicy = rpRows[0].cancellation_policy_description;
    }
  }

  // Build nightly rates
  const nightlyRate = planRate ?? baseRate;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const nightlyRates: { date: string; amount: number }[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    // Check for dynamic pricing
    const dateStr = cursor.toISOString().slice(0, 10);
    const { rows: dynRows } = await query<{ dynamic_price: string | null }>(
      `SELECT dynamic_price::text
			 FROM public.room_availability
			 WHERE room_type_id = $1 AND tenant_id = $2 AND property_id = $3
			   AND availability_date = $4::date
			 LIMIT 1`,
      [roomTypeId, tenantId, propertyId, dateStr],
    );
    const dynRate = dynRows[0]?.dynamic_price ? Number(dynRows[0].dynamic_price) : null;
    const nightAmount = dynRate != null && dynRate > 0 ? dynRate : nightlyRate;
    nightlyRates.push({ date: dateStr, amount: nightAmount });
    cursor.setDate(cursor.getDate() + 1);
  }

  let totalBeforeTax = nightlyRates.reduce((sum, n) => sum + n.amount, 0);

  // Apply promo code discount
  let promoApplied = false;
  let promoDiscount: number | null = null;

  if (promoCode) {
    const { rows: promoRows } = await query<{
      promo_id: string;
      discount_type: string | null;
      discount_percent: string | null;
      discount_amount: string | null;
      free_nights_count: number | null;
      is_active: boolean;
      valid_from: string;
      valid_to: string;
      remaining_uses: number | null;
      has_usage_limit: boolean;
    }>(
      `SELECT promo_id, discount_type, discount_percent, discount_amount,
			        free_nights_count, is_active, valid_from, valid_to,
			        remaining_uses, has_usage_limit
			 FROM public.promotional_codes
			 WHERE promo_code = $1 AND tenant_id = $2
			   AND ($3::uuid IS NULL OR property_id = $3::uuid)
			 LIMIT 1`,
      [promoCode, tenantId, propertyId],
    );
    const promo = promoRows[0];
    if (promo?.is_active) {
      const now = new Date();
      if (
        now >= new Date(promo.valid_from) &&
        now <= new Date(promo.valid_to) &&
        (!promo.has_usage_limit || (promo.remaining_uses ?? 1) > 0)
      ) {
        if (promo.discount_type === "PERCENTAGE" && promo.discount_percent) {
          promoDiscount = totalBeforeTax * (Number(promo.discount_percent) / 100);
          promoApplied = true;
        } else if (promo.discount_type === "FIXED_AMOUNT" && promo.discount_amount) {
          promoDiscount = Number(promo.discount_amount);
          promoApplied = true;
        } else if (promo.discount_type === "FREE_NIGHTS" && promo.free_nights_count) {
          // Remove cheapest N nights
          const sorted = [...nightlyRates].sort((a, b) => a.amount - b.amount);
          promoDiscount = sorted
            .slice(0, promo.free_nights_count)
            .reduce((s, n) => s + n.amount, 0);
          promoApplied = true;
        }
      }
    }
  }

  if (promoApplied && promoDiscount) {
    totalBeforeTax = Math.max(0, totalBeforeTax - promoDiscount);
  }

  // Estimate tax at a standard percentage (property-specific tax config can
  // be looked up but for quote purposes we use a reasonable default)
  const taxRate = 0.12; // 12% estimated tax
  const taxEstimate = Math.round(totalBeforeTax * taxRate * 100) / 100;
  const totalAmount = Math.round((totalBeforeTax + taxEstimate) * 100) / 100;

  return {
    room_type_id: roomTypeId,
    room_type_name: roomType.type_name,
    rate_plan_id: ratePlanId,
    rate_plan_name: ratePlanName,
    nightly_rates: nightlyRates,
    total_before_tax: Math.round(totalBeforeTax * 100) / 100,
    tax_estimate: taxEstimate,
    total_amount: totalAmount,
    currency: roomType.currency_code,
    promo_applied: promoApplied,
    promo_discount: promoDiscount ? Math.round(promoDiscount * 100) / 100 : null,
    cancellation_policy: cancellationPolicy,
  };
};

// ---------------------------------------------------------------------------
// 3. Create Booking (direct / website)
// ---------------------------------------------------------------------------

export const createDirectBooking = async (options: {
  tenantId: string;
  propertyId: string;
  guestId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency?: string;
  rateCode?: string;
  promoCode?: string;
  notes?: string;
  eta?: string;
}): Promise<BookingConfirmation> => {
  const {
    tenantId,
    propertyId,
    guestId,
    roomTypeId,
    checkIn,
    checkOut,
    totalAmount,
    currency,
    rateCode,
    promoCode,
    notes,
    eta,
  } = options;

  // Verify room type exists
  const { rows: rtRows } = await query<{ type_name: string }>(
    `SELECT type_name FROM public.room_types
		 WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`,
    [roomTypeId, tenantId],
  );
  if (!rtRows[0]) {
    throw new Error("Room type not found");
  }

  // Verify guest exists
  const { rows: guestRows } = await query<{ id: string }>(
    `SELECT id FROM public.guests
		 WHERE id = $1 AND tenant_id = $2 AND COALESCE(is_deleted, false) = false LIMIT 1`,
    [guestId, tenantId],
  );
  if (!guestRows[0]) {
    throw new Error("Guest not found");
  }

  // Generate confirmation number: DB-YYYYMMDD-XXXX
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const confirmationNumber = `DB-${datePart}-${rand}`;

  // Insert reservation as CONFIRMED with source = WEBSITE
  const { rows: resRows } = await query<{
    id: string;
    created_at: string;
  }>(
    `INSERT INTO public.reservations (
		   tenant_id, property_id, guest_id, room_type_id,
		   check_in_date, check_out_date, booking_date,
		   total_amount, currency, room_rate,
		   status, source, reservation_type,
		   confirmation_number, rate_code, promo_code,
		   notes, eta,
		   created_by, updated_by
		 ) VALUES (
		   $1, $2, $3, $4,
		   $5::date, $6::date, NOW(),
		   $7, COALESCE($8, 'USD'), $7 / GREATEST(1, $6::date - $5::date),
		   'CONFIRMED', 'WEBSITE', 'TRANSIENT',
		   $9, $10, $11,
		   $12, $13,
		   'DIRECT_BOOKING_ENGINE', 'DIRECT_BOOKING_ENGINE'
		 )
		 ON CONFLICT DO NOTHING
		 RETURNING id, created_at::text`,
    [
      tenantId,
      propertyId,
      guestId,
      roomTypeId,
      checkIn,
      checkOut,
      totalAmount,
      currency ?? null,
      confirmationNumber,
      rateCode ?? null,
      promoCode ?? null,
      notes ?? null,
      eta ?? null,
    ],
  );

  if (!resRows[0]) {
    throw new Error("Failed to create reservation");
  }

  // Decrement promo code usage if applicable
  if (promoCode) {
    await query(
      `UPDATE public.promotional_codes
			 SET remaining_uses = GREATEST(0, COALESCE(remaining_uses, 0) - 1),
			     total_redemptions = COALESCE(total_redemptions, 0) + 1,
			     updated_at = NOW()
			 WHERE promo_code = $1 AND tenant_id = $2 AND has_usage_limit = true`,
      [promoCode, tenantId],
    );
  }

  return {
    reservation_id: resRows[0].id,
    confirmation_number: confirmationNumber,
    status: "CONFIRMED",
    guest_id: guestId,
    room_type: rtRows[0].type_name,
    check_in_date: checkIn,
    check_out_date: checkOut,
    total_amount: totalAmount,
    currency: currency ?? "USD",
    created_at: resRows[0].created_at,
  };
};
