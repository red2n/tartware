import { randomUUID } from "node:crypto";

import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "registration-card-service" });

type GuestRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
};

type ReservationDetailRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  guest_id: string;
  confirmation_code: string;
  check_in_date: string;
  check_out_date: string;
  room_number: string | null;
  room_type: string | null;
  rate_code: string | null;
  adults: number;
  children: number;
  number_of_nights: number;
};

type PropertyRow = {
  id: string;
  name: string;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  phone: string | null;
};

type RegistrationCardRow = {
  registration_id: string;
  registration_number: string;
  pdf_url: string | null;
};

const GUEST_LOOKUP_SQL = `
  SELECT
    g.id, g.first_name, g.last_name, g.email, g.phone,
    g.date_of_birth, g.nationality,
    g.address_line_1, g.city, g.state, g.country, g.postal_code
  FROM guests g
  WHERE g.id = $1
`;

const RESERVATION_DETAIL_SQL = `
  SELECT
    r.id, r.tenant_id, r.property_id, r.guest_id,
    r.confirmation_code, r.check_in_date, r.check_out_date,
    rm.room_number, rt.name AS room_type,
    r.rate_code, r.adults, r.children,
    (r.check_out_date::date - r.check_in_date::date) AS number_of_nights
  FROM reservations r
  LEFT JOIN rooms rm ON rm.id = r.room_id
  LEFT JOIN room_types rt ON rt.id = rm.room_type_id
  WHERE r.id = $1 AND r.tenant_id = $2
`;

const PROPERTY_LOOKUP_SQL = `
  SELECT
    p.id, p.name,
    p.address_line_1, p.city, p.state, p.country, p.postal_code,
    p.phone
  FROM properties p
  WHERE p.id = $1
`;

const INSERT_REGISTRATION_CARD_SQL = `
  INSERT INTO digital_registration_cards (
    registration_id, tenant_id, property_id, reservation_id, guest_id,
    mobile_checkin_id, registration_number, registration_date, registration_time,
    guest_full_name, guest_email, guest_phone, guest_date_of_birth, guest_nationality,
    home_address, home_city, home_state, home_country, home_postal_code,
    arrival_date, departure_date, number_of_nights, number_of_adults, number_of_children,
    room_number, room_type, rate_code,
    created_by
  )
  VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, CURRENT_DATE, CURRENT_TIME,
    $8, $9, $10, $11, $12,
    $13, $14, $15, $16, $17,
    $18, $19, $20, $21, $22,
    $23, $24, $25,
    $26
  )
  ON CONFLICT (registration_number) DO UPDATE
    SET updated_at = NOW()
  RETURNING registration_id, registration_number, pdf_url
`;

const GET_REGISTRATION_CARD_SQL = `
  SELECT
    registration_id, tenant_id, property_id, reservation_id, guest_id,
    registration_number, registration_date, registration_time,
    guest_full_name, guest_email, guest_phone, guest_date_of_birth, guest_nationality,
    home_address, home_city, home_state, home_country, home_postal_code,
    arrival_date, departure_date, number_of_nights, number_of_adults, number_of_children,
    room_number, room_type, rate_code,
    guest_signature_url, signature_captured_at,
    terms_accepted, privacy_accepted, marketing_consent,
    pdf_url, pdf_generated_at,
    verified, verified_at
  FROM digital_registration_cards
  WHERE reservation_id = $1 AND tenant_id = $2
  ORDER BY created_at DESC
  LIMIT 1
`;

export type GenerateCardInput = {
  reservationId: string;
  tenantId: string;
  mobileCheckinId?: string | null;
  initiatedBy?: string | null;
};

export type RegistrationCardData = {
  registrationId: string;
  registrationNumber: string;
  property: {
    name: string;
    address: string | null;
    phone: string | null;
  };
  guest: {
    fullName: string;
    email: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    address: string | null;
  };
  stay: {
    confirmationCode: string;
    arrivalDate: string;
    departureDate: string;
    numberOfNights: number;
    adults: number;
    children: number;
    roomNumber: string | null;
    roomType: string | null;
    rateCode: string | null;
  };
  html: string;
};

/**
 * Generate a registration card for a reservation.
 * Fetches guest + reservation + property data, renders HTML, stores in DB.
 */
export const generateRegistrationCard = async (
  input: GenerateCardInput,
): Promise<RegistrationCardData> => {
  // Fetch reservation
  const { rows: reservations } = await query<ReservationDetailRow>(RESERVATION_DETAIL_SQL, [
    input.reservationId,
    input.tenantId,
  ]);
  if (reservations.length === 0) {
    throw Object.assign(new Error("Reservation not found"), { statusCode: 404 });
  }
  const reservation = reservations[0]!;

  // Fetch guest
  const { rows: guests } = await query<GuestRow>(GUEST_LOOKUP_SQL, [reservation.guest_id]);
  if (guests.length === 0) {
    throw Object.assign(new Error("Guest not found"), { statusCode: 404 });
  }
  const guest = guests[0]!;

  // Fetch property
  const { rows: properties } = await query<PropertyRow>(PROPERTY_LOOKUP_SQL, [
    reservation.property_id,
  ]);
  const property = properties[0];

  const fullName = `${guest.first_name} ${guest.last_name}`;
  const guestAddress = [guest.address_line_1, guest.city, guest.state, guest.country]
    .filter(Boolean)
    .join(", ") || null;
  const propertyAddress = property
    ? [property.address_line_1, property.city, property.state, property.country]
        .filter(Boolean)
        .join(", ")
    : null;

  const registrationId = randomUUID();
  const registrationNumber = `RC-${Date.now()}-${registrationId.slice(0, 8).toUpperCase()}`;

  const html = renderRegistrationCardHtml({
    registrationNumber,
    propertyName: property?.name ?? "Unknown Property",
    propertyAddress,
    propertyPhone: property?.phone ?? null,
    guestName: fullName,
    guestEmail: guest.email,
    guestPhone: guest.phone,
    guestDob: guest.date_of_birth,
    guestNationality: guest.nationality,
    guestAddress,
    confirmationCode: reservation.confirmation_code,
    arrivalDate: reservation.check_in_date,
    departureDate: reservation.check_out_date,
    numberOfNights: reservation.number_of_nights,
    adults: reservation.adults,
    children: reservation.children,
    roomNumber: reservation.room_number,
    roomType: reservation.room_type,
    rateCode: reservation.rate_code,
  });

  // Store in DB
  await query<RegistrationCardRow>(INSERT_REGISTRATION_CARD_SQL, [
    registrationId,
    input.tenantId,
    reservation.property_id,
    input.reservationId,
    reservation.guest_id,
    input.mobileCheckinId ?? null,
    registrationNumber,
    fullName,
    guest.email,
    guest.phone,
    guest.date_of_birth,
    guest.nationality,
    guest.address_line_1,
    guest.city,
    guest.state,
    guest.country,
    guest.postal_code,
    reservation.check_in_date,
    reservation.check_out_date,
    reservation.number_of_nights,
    reservation.adults,
    reservation.children,
    reservation.room_number,
    reservation.room_type,
    reservation.rate_code,
    input.initiatedBy ?? null,
  ]);

  logger.info(
    { registrationId, reservationId: input.reservationId, registrationNumber },
    "registration card generated",
  );

  return {
    registrationId,
    registrationNumber,
    property: {
      name: property?.name ?? "Unknown Property",
      address: propertyAddress,
      phone: property?.phone ?? null,
    },
    guest: {
      fullName,
      email: guest.email,
      phone: guest.phone,
      dateOfBirth: guest.date_of_birth,
      nationality: guest.nationality,
      address: guestAddress,
    },
    stay: {
      confirmationCode: reservation.confirmation_code,
      arrivalDate: reservation.check_in_date,
      departureDate: reservation.check_out_date,
      numberOfNights: reservation.number_of_nights,
      adults: reservation.adults,
      children: reservation.children,
      roomNumber: reservation.room_number,
      roomType: reservation.room_type,
      rateCode: reservation.rate_code,
    },
    html,
  };
};

/**
 * Get the latest registration card for a reservation.
 */
export const getRegistrationCard = async (
  reservationId: string,
  tenantId: string,
): Promise<Record<string, unknown> | null> => {
  const { rows } = await query<Record<string, unknown>>(GET_REGISTRATION_CARD_SQL, [
    reservationId,
    tenantId,
  ]);
  return rows[0] ?? null;
};

// ─── HTML Template ──────────────────────────────────────

type CardTemplateData = {
  registrationNumber: string;
  propertyName: string;
  propertyAddress: string | null;
  propertyPhone: string | null;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestDob: string | null;
  guestNationality: string | null;
  guestAddress: string | null;
  confirmationCode: string;
  arrivalDate: string;
  departureDate: string;
  numberOfNights: number;
  adults: number;
  children: number;
  roomNumber: string | null;
  roomType: string | null;
  rateCode: string | null;
};

const escapeHtml = (str: string | null | undefined): string => {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

/**
 * Render a registration card as an HTML string.
 */
export const renderRegistrationCardHtml = (data: CardTemplateData): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Card - ${escapeHtml(data.registrationNumber)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 800px; margin: 0 auto; padding: 24px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 1.5em; margin-bottom: 4px; }
    .header .property-info { font-size: 0.9em; color: #666; }
    .reg-number { font-size: 0.85em; color: #999; margin-top: 8px; }
    .section { margin-bottom: 20px; }
    .section h2 { font-size: 1.1em; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 12px; color: #444; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .field { margin-bottom: 8px; }
    .field-label { font-size: 0.75em; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
    .field-value { font-size: 0.95em; padding: 4px 0; border-bottom: 1px dotted #ddd; min-height: 1.5em; }
    .signature-area { border: 1px solid #999; height: 80px; margin-top: 8px; display: flex; align-items: flex-end; padding: 8px; }
    .signature-label { font-size: 0.75em; color: #888; }
    .terms { font-size: 0.75em; color: #666; line-height: 1.4; margin-top: 16px; padding: 12px; border: 1px solid #eee; background: #fafafa; }
    .footer { text-align: center; margin-top: 24px; font-size: 0.8em; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(data.propertyName)}</h1>
    <div class="property-info">
      ${data.propertyAddress ? `<div>${escapeHtml(data.propertyAddress)}</div>` : ""}
      ${data.propertyPhone ? `<div>Tel: ${escapeHtml(data.propertyPhone)}</div>` : ""}
    </div>
    <div class="reg-number">Registration Card #${escapeHtml(data.registrationNumber)}</div>
  </div>

  <div class="section">
    <h2>Guest Information</h2>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Full Name</div>
        <div class="field-value">${escapeHtml(data.guestName)}</div>
      </div>
      <div class="field">
        <div class="field-label">Email</div>
        <div class="field-value">${escapeHtml(data.guestEmail)}</div>
      </div>
      <div class="field">
        <div class="field-label">Phone</div>
        <div class="field-value">${escapeHtml(data.guestPhone)}</div>
      </div>
      <div class="field">
        <div class="field-label">Date of Birth</div>
        <div class="field-value">${escapeHtml(data.guestDob)}</div>
      </div>
      <div class="field">
        <div class="field-label">Nationality</div>
        <div class="field-value">${escapeHtml(data.guestNationality)}</div>
      </div>
      <div class="field">
        <div class="field-label">Address</div>
        <div class="field-value">${escapeHtml(data.guestAddress)}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Stay Details</h2>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Confirmation Code</div>
        <div class="field-value">${escapeHtml(data.confirmationCode)}</div>
      </div>
      <div class="field">
        <div class="field-label">Room</div>
        <div class="field-value">${escapeHtml(data.roomNumber)} ${data.roomType ? `(${escapeHtml(data.roomType)})` : ""}</div>
      </div>
      <div class="field">
        <div class="field-label">Arrival</div>
        <div class="field-value">${escapeHtml(data.arrivalDate)}</div>
      </div>
      <div class="field">
        <div class="field-label">Departure</div>
        <div class="field-value">${escapeHtml(data.departureDate)}</div>
      </div>
      <div class="field">
        <div class="field-label">Nights</div>
        <div class="field-value">${data.numberOfNights}</div>
      </div>
      <div class="field">
        <div class="field-label">Guests</div>
        <div class="field-value">${data.adults} Adult(s)${data.children > 0 ? `, ${data.children} Child(ren)` : ""}</div>
      </div>
      ${data.rateCode ? `<div class="field"><div class="field-label">Rate Code</div><div class="field-value">${escapeHtml(data.rateCode)}</div></div>` : ""}
    </div>
  </div>

  <div class="section">
    <h2>Identification Document</h2>
    <div class="field-grid">
      <div class="field">
        <div class="field-label">Document Type</div>
        <div class="field-value"></div>
      </div>
      <div class="field">
        <div class="field-label">Document Number</div>
        <div class="field-value"></div>
      </div>
      <div class="field">
        <div class="field-label">Issuing Country</div>
        <div class="field-value"></div>
      </div>
      <div class="field">
        <div class="field-label">Expiry Date</div>
        <div class="field-value"></div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Guest Signature</h2>
    <div class="signature-area">
      <span class="signature-label">Sign here</span>
    </div>
  </div>

  <div class="terms">
    <strong>Terms &amp; Conditions:</strong> By signing this registration card, I confirm that the information provided is accurate.
    I agree to abide by the hotel&#39;s policies and terms of stay. I acknowledge responsibility for all charges incurred during my stay.
    Check-out time is as posted. Late check-out may incur additional charges.
  </div>

  <div class="footer">
    <p>Generated on ${new Date().toISOString().slice(0, 10)}</p>
  </div>
</body>
</html>`;
};
