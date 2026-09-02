-- =====================================================
-- 14_reservation_rooms_indexes.sql
-- Indexes for reservation_rooms table
-- Performance optimization for multi-room reservation reads
-- Date: 2026-08-27
-- =====================================================

\c tartware

\echo 'Creating indexes for reservation_rooms table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_reservation_rooms_reservation_id ON reservation_rooms(tenant_id, reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_rooms_tenant_id ON reservation_rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reservation_rooms_room_type_id ON reservation_rooms(tenant_id, property_id, room_type_id);

-- Assigned room lookups (room move, in-house grid) — sparse until assignment
CREATE INDEX IF NOT EXISTS idx_reservation_rooms_room_id ON reservation_rooms(tenant_id, room_id) WHERE room_id IS NOT NULL;

-- Per-room lifecycle sweeps (arrivals, in-house, departures)
CREATE INDEX IF NOT EXISTS idx_reservation_rooms_status ON reservation_rooms(tenant_id, property_id, status);

-- Occupant profile lookups (stay history by guest)
CREATE INDEX IF NOT EXISTS idx_reservation_rooms_guest_id ON reservation_rooms(tenant_id, guest_id) WHERE guest_id IS NOT NULL;

\echo '✓ Reservation_rooms indexes created successfully!'
