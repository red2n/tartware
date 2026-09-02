/**
 * DEV DOC
 * Module: gdpr-export-repository.ts
 * Purpose: The six reads that make up a GDPR subject access export — every
 *          table holding personal data for one guest.
 * Ownership: guests-service
 *
 * Lifted verbatim out of `services/gdpr-export-service.ts`.
 */

import { query } from "../lib/db.js";

const SELECT_GUEST_PROFILE_SQL = `SELECT id, first_name, last_name, middle_name, title,
            date_of_birth, gender, nationality,
            email, phone, secondary_phone, address,
            id_type, id_number, passport_number, passport_expiry,
            company_name, company_tax_id,
            loyalty_tier, loyalty_points, vip_status,
            preferences, marketing_consent, communication_preferences,
            total_bookings, total_nights, total_revenue,
            last_stay_date, member_since, first_stay_date,
            is_blacklisted, blacklist_reason, notes,
            created_at, updated_at
     FROM public.guests
     WHERE tenant_id = $1::uuid AND id = $2::uuid
       AND COALESCE(is_deleted, false) = false`;

const SELECT_GUEST_RESERVATIONS_SQL = `SELECT id, property_id, room_type_id, room_id,
            check_in_date, check_out_date, status,
            number_of_adults, number_of_children, total_amount, currency,
            source AS booking_source, reservation_type, special_requests,
            created_at, updated_at
     FROM public.reservations
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
     ORDER BY created_at DESC`;

const SELECT_GUEST_PAYMENTS_SQL = `SELECT id, payment_reference, transaction_type, payment_method,
            amount, currency, status, processed_at,
            created_at
     FROM public.payments
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
     ORDER BY created_at DESC`;

const SELECT_GUEST_CONSENTS_SQL = `SELECT consent_type, consent_status, consent_date,
            ip_address, consent_source, withdrawal_date
     FROM public.gdpr_consent_logs
     -- The consent log keys on subject_id (a guest is one kind of data subject),
     -- not guest_id. Every other table in this export uses guest_id.
     WHERE tenant_id = $1::uuid AND subject_id = $2::uuid
     ORDER BY consent_date DESC`;

const SELECT_GUEST_LOYALTY_TRANSACTIONS_SQL = `SELECT transaction_id AS id, transaction_type, points, balance_after,
            reference_type, reference_id, description,
            expires_at, created_at
     FROM public.loyalty_point_transactions
     WHERE tenant_id = $1::uuid AND guest_id = $2::uuid
     ORDER BY created_at DESC`;

const SELECT_GUEST_NOTIFICATIONS_SQL = `SELECT notification_id AS id, category AS channel, title AS subject,
            is_read, read_at, created_at
     FROM public.in_app_notifications
     WHERE tenant_id = $1::uuid
       AND source_type = 'guest'
       AND source_id = $2::uuid
     ORDER BY created_at DESC`;

/**
 * The guest's own profile record.
 */
export const selectGuestProfile = (tenantId: string, guestId: string) =>
  query<Record<string, unknown>>(SELECT_GUEST_PROFILE_SQL, [tenantId, guestId]);

/**
 * Every reservation held by the guest.
 */
export const selectGuestReservations = (tenantId: string, guestId: string) =>
  query<Record<string, unknown>>(SELECT_GUEST_RESERVATIONS_SQL, [tenantId, guestId]);

/**
 * Payment history.
 */
export const selectGuestPayments = (tenantId: string, guestId: string) =>
  query<Record<string, unknown>>(SELECT_GUEST_PAYMENTS_SQL, [tenantId, guestId]);

/**
 * Consent decisions and when they were made.
 */
export const selectGuestConsents = (tenantId: string, guestId: string) =>
  query<Record<string, unknown>>(SELECT_GUEST_CONSENTS_SQL, [tenantId, guestId]);

/**
 * Loyalty point movements.
 */
export const selectGuestLoyaltyTransactions = (tenantId: string, guestId: string) =>
  query<Record<string, unknown>>(SELECT_GUEST_LOYALTY_TRANSACTIONS_SQL, [tenantId, guestId]);

/**
 * Notifications sent to the guest.
 */
export const selectGuestNotifications = (tenantId: string, guestId: string) =>
  query<Record<string, unknown>>(SELECT_GUEST_NOTIFICATIONS_SQL, [tenantId, guestId]);
