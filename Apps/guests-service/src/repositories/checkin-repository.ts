/**
 * DEV DOC
 * Module: checkin-repository.ts
 * Purpose: Check-in reads and writes.
 * Ownership: guests-service
 *
 * Statements moved verbatim out of `services/checkin-service.ts`.
 */

export const RESERVATION_BY_CONFIRMATION_SQL = `
  SELECT
    r.id,
    r.tenant_id,
    r.property_id,
    r.guest_id,
    r.confirmation_number,
    r.status,
    r.check_in_date,
    r.check_out_date,
    r.room_number,
    g.first_name AS guest_first_name,
    g.last_name AS guest_last_name
  FROM reservations r
  LEFT JOIN guests g ON g.id = r.guest_id AND g.tenant_id = r.tenant_id AND g.is_deleted = false
  WHERE r.confirmation_number = $1
`;
export const INSERT_MOBILE_CHECKIN_SQL = `
  INSERT INTO mobile_check_ins (
    mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
    checkin_status, access_method, device_type, app_version,
    checkin_started_at, created_by
  )
  VALUES ($1, $2, $3, $4, $5, 'in_progress', $6, $7, $8, NOW(), $9)
  ON CONFLICT (mobile_checkin_id) DO NOTHING
  RETURNING mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
            checkin_status, access_method, checkin_started_at, checkin_completed_at,
            room_id, digital_key_type, digital_key_id
`;
export const GET_CHECKIN_SQL = `
  SELECT
    mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
    checkin_status, access_method, checkin_started_at, checkin_completed_at,
    room_id, digital_key_type, digital_key_id
  FROM mobile_check_ins
  WHERE mobile_checkin_id = $1
`;
export const COMPLETE_CHECKIN_SQL = `
  UPDATE mobile_check_ins
  SET checkin_status = 'completed',
      checkin_completed_at = NOW(),
      identity_verification_method = $2,
      id_document_verified = $3,
      registration_card_signed = $4,
      payment_method_verified = $5,
      terms_accepted = $6,
      room_id = $7,
      digital_key_type = $8,
      updated_at = NOW()
  WHERE mobile_checkin_id = $1
    AND checkin_status IN ('in_progress', 'identity_verification', 'payment_verification', 'room_assignment')
  RETURNING mobile_checkin_id, tenant_id, property_id, reservation_id, guest_id,
            checkin_status, access_method, checkin_started_at, checkin_completed_at,
            room_id, digital_key_type, digital_key_id
`;
