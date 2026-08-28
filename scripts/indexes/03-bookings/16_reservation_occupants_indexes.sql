-- =====================================================
-- 16_reservation_occupants_indexes.sql
-- Indexes for reservation_occupants table
-- Performance optimization for registration card and share lookups
-- Date: 2026-08-27
-- =====================================================

\c tartware

\echo 'Creating indexes for reservation_occupants table...'

-- Stay reads: everyone on one booking
CREATE INDEX IF NOT EXISTS idx_reservation_occupants_reservation_id ON reservation_occupants(tenant_id, reservation_id);

-- Room reads: who is in this room (registration card, share list)
CREATE INDEX IF NOT EXISTS idx_reservation_occupants_room ON reservation_occupants(reservation_room_id);

-- Profile reads: every stay a guest appeared on, booker or not
CREATE INDEX IF NOT EXISTS idx_reservation_occupants_guest_id ON reservation_occupants(tenant_id, guest_id) WHERE guest_id IS NOT NULL;

\echo '✓ Reservation_occupants indexes created successfully!'
