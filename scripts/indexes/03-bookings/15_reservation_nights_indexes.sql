-- =====================================================
-- 15_reservation_nights_indexes.sql
-- Indexes for reservation_nights table
-- Performance optimization for per-night rate and occupancy reads
-- Date: 2026-08-27
-- =====================================================

\c tartware

\echo 'Creating indexes for reservation_nights table...'

-- Stay reads: every night of one booking, in order
CREATE INDEX IF NOT EXISTS idx_reservation_nights_reservation_id ON reservation_nights(tenant_id, reservation_id, stay_date);

-- Room reads: the rate grid of one room
CREATE INDEX IF NOT EXISTS idx_reservation_nights_room ON reservation_nights(reservation_room_id, stay_date);

-- Date sweeps: night audit posting, on-the-books, occupancy for one date
CREATE INDEX IF NOT EXISTS idx_reservation_nights_stay_date ON reservation_nights(tenant_id, property_id, stay_date);

-- Rate production analysis
CREATE INDEX IF NOT EXISTS idx_reservation_nights_rate_id ON reservation_nights(tenant_id, rate_id, stay_date) WHERE rate_id IS NOT NULL;

\echo '✓ Reservation_nights indexes created successfully!'
