/**
 * DEV DOC
 * Module: registration-card-repository.ts
 * Purpose: Digital registration cards.
 * Ownership: guests-service
 *
 * Statements moved verbatim out of `services/registration-card-service.ts`.
 */

export const PROPERTY_LOOKUP_SQL = `
  SELECT
    p.id, p.property_name,
    p.address->>'street' AS address_line_1,
    p.address->>'city' AS city,
    p.address->>'state' AS state,
    p.address->>'country' AS country,
    p.address->>'postalCode' AS postal_code,
    p.phone
  FROM properties p
  WHERE p.id = $1
`;
export const INSERT_REGISTRATION_CARD_SQL = `
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
export const GET_REGISTRATION_CARD_SQL = `
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
