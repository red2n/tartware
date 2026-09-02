/**
 * DEV DOC
 * Module: booking-repository.ts
 * Purpose: Guest-facing booking reads.
 * Ownership: guests-service
 *
 * Statements moved verbatim out of `services/booking-service.ts`.
 */

export const BOOKING_LOOKUP_SQL = `
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
export const INSERT_GUEST_SQL = `
  INSERT INTO guests (id, tenant_id, first_name, last_name, email, phone)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (tenant_id, email) WHERE deleted_at IS NULL DO UPDATE SET updated_at = NOW(), version = guests.version + 1
  RETURNING id
`;
