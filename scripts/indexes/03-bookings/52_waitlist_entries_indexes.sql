-- =====================================================
-- 52_waitlist_entries_indexes.sql
-- Indexes for Reservation Waitlist Entries
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating waitlist_entries indexes...'

CREATE INDEX idx_waitlist_entries_tenant
    ON waitlist_entries(tenant_id, property_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_waitlist_entries_reservation
    ON waitlist_entries(reservation_id)
    WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_waitlist_entries_guest_status
    ON waitlist_entries(guest_id, waitlist_status)
    WHERE guest_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_waitlist_entries_arrival_departure
    ON waitlist_entries(arrival_date, departure_date, waitlist_status)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_waitlist_entries_room_type
    ON waitlist_entries(requested_room_type_id, waitlist_status)
    WHERE requested_room_type_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_waitlist_entries_priority
    ON waitlist_entries(priority_score DESC, vip_flag, waitlist_status)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_waitlist_entries_offer_status
    ON waitlist_entries(waitlist_status, offer_response, offer_expiration_at)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_waitlist_entries_last_notified
    ON waitlist_entries(last_notified_at)
    WHERE last_notified_at IS NOT NULL AND is_deleted = FALSE;

\echo 'waitlist_entries indexes created.'
