import { v4 as uuid } from "uuid";

import { query } from "../../lib/db.js";
import { reservationsLogger } from "../../logger.js";

import type {
  ReservationGenerateRegCardCommand,
} from "../../schemas/reservation-command.js";

import { ReservationCommandError } from "./common.js";

// ─── S27: Digital Registration Cards ─────────────────────────────────────────

/**
 * Generate a digital registration card for a reservation.
 * Snapshots guest data and reservation details into the
 * digital_registration_cards table for legal/compliance purposes.
 */
export const generateRegistrationCard = async (
  tenantId: string,
  command: ReservationGenerateRegCardCommand,
  _context?: { correlationId?: string },
): Promise<{ eventId: string; status: string }> => {
  // 1. Fetch reservation + guest data
  const { rows: resRows } = await query<Record<string, unknown>>(
    // guests.address is a single JSONB document, so the registration card's
    // structured address fields are projected out of it rather than stored as
    // parallel columns. reservations has no rate_code — it references a rate,
    // so the code is read from the joined rate.
    `SELECT r.id, r.guest_id, r.room_type_id, r.room_number,
            r.check_in_date, r.check_out_date, r.number_of_adults, r.number_of_children,
            ra.rate_code, r.status,
            g.first_name, g.last_name, g.email, g.phone, g.date_of_birth,
            g.nationality, g.id_type, g.id_number, g.id_issuing_country,
            g.id_issue_date, g.id_expiry_date,
            g.address->>'line1'       AS address_line1,
            g.address->>'city'        AS address_city,
            g.address->>'state'       AS address_state,
            g.address->>'country'     AS address_country,
            g.address->>'postal_code' AS address_postal_code,
            rt.type_name AS room_type_name
     FROM reservations r
     JOIN guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id
     LEFT JOIN room_types rt ON rt.id = r.room_type_id AND rt.tenant_id = r.tenant_id
     LEFT JOIN rates ra ON ra.id = r.rate_id AND ra.tenant_id = r.tenant_id
     WHERE r.id = $1 AND r.tenant_id = $2`,
    [command.reservation_id, tenantId],
  );
  const res = resRows[0];
  if (!res) {
    throw new ReservationCommandError(
      "RESERVATION_NOT_FOUND",
      `Reservation ${command.reservation_id} not found`,
    );
  }

  // 2. Generate registration number: REG-YYYYMMDD-XXXX
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { rows: countRows } = await query<{ cnt: string }>(
    `SELECT COUNT(registration_id)::int AS cnt FROM digital_registration_cards
     WHERE tenant_id = $1 AND property_id = $2 AND registration_date = CURRENT_DATE`,
    [tenantId, command.property_id],
  );
  const seq = (Number(countRows[0]?.cnt ?? 0) + 1).toString().padStart(4, "0");
  const registrationNumber = `REG-${today}-${seq}`;
  const registrationId = uuid();

  // 3. Compute nights
  const arrivalDate = new Date(res.check_in_date as string);
  const departureDate = new Date(res.check_out_date as string);
  const nights = Math.max(
    1,
    Math.round((departureDate.getTime() - arrivalDate.getTime()) / 86400000),
  );

  const guestFullName = `${res.first_name ?? ""} ${res.last_name ?? ""}`.trim();

  // 4. Insert registration card (idempotent: ON CONFLICT skip)
  await query(
    `INSERT INTO digital_registration_cards (
       registration_id, tenant_id, property_id, reservation_id, guest_id,
       registration_number, registration_date, registration_time,
       guest_full_name, guest_email, guest_phone, guest_date_of_birth, guest_nationality,
       id_type, id_number, id_issuing_country, id_issue_date, id_expiry_date,
       home_address, home_city, home_state, home_country, home_postal_code,
       arrival_date, departure_date, number_of_nights,
       number_of_adults, number_of_children,
       room_number, room_type, rate_code,
       companion_names, companion_count,
       vehicle_license_plate, vehicle_make, vehicle_model, vehicle_color,
       visit_purpose, company_name,
       emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
       terms_accepted, privacy_accepted, marketing_consent,
       special_notes,
       regulatory_compliance_status,
       created_at, created_by
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6, CURRENT_DATE, CURRENT_TIME,
       $7, $8, $9, $10, $11,
       $12, $13, $14, $15, $16,
       $17, $18, $19, $20, $21,
       $22, $23, $24,
       $25, $26,
       $27, $28, $29,
       $30, $31,
       $32, $33, $34, $35,
       $36, $37,
       $38, $39, $40,
       $41, $42, $43,
       $44,
       'pending',
       NOW(), $5
     )
     ON CONFLICT (registration_number) DO NOTHING`,
    [
      registrationId,
      tenantId,
      command.property_id,
      command.reservation_id,
      res.guest_id,
      registrationNumber,
      guestFullName,
      res.email,
      res.phone,
      res.date_of_birth,
      res.nationality,
      res.id_type,
      res.id_number,
      res.id_issuing_country,
      res.id_issue_date,
      res.id_expiry_date,
      res.address_line1,
      res.address_city,
      res.address_state,
      res.address_country,
      res.address_postal_code,
      res.check_in_date,
      res.check_out_date,
      nights,
      res.number_of_adults ?? 1,
      res.number_of_children ?? 0,
      res.room_number ?? null,
      res.room_type_name ?? null,
      res.rate_code ?? null,
      command.companion_names ?? null,
      command.companion_names?.length ?? 0,
      command.vehicle_license_plate ?? null,
      command.vehicle_make ?? null,
      command.vehicle_model ?? null,
      command.vehicle_color ?? null,
      command.visit_purpose ?? "leisure",
      command.company_name ?? null,
      command.emergency_contact_name ?? null,
      command.emergency_contact_phone ?? null,
      command.emergency_contact_relationship ?? null,
      command.terms_accepted,
      command.privacy_accepted,
      command.marketing_consent,
      command.special_notes ?? null,
    ],
  );

  reservationsLogger.info(
    { registrationId, registrationNumber, reservationId: command.reservation_id },
    "Digital registration card generated",
  );

  return { eventId: registrationId, status: "generated" };
};
