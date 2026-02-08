-- =====================================================
-- 10_reservations_indexes.sql
-- Indexes for reservations table
-- Performance optimization for booking queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for reservations table...'

-- Foreign key indexes (critical for joins)
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_id ON reservations(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_property_id ON reservations(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_guest_id ON reservations(guest_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_room_type_id ON reservations(room_type_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_rate_id ON reservations(rate_id) WHERE deleted_at IS NULL;

-- Confirmation number lookup (critical for guest queries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_confirmation ON reservations(confirmation_number) WHERE deleted_at IS NULL;

-- Date range queries (most common queries)
CREATE INDEX IF NOT EXISTS idx_reservations_check_in ON reservations(check_in_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_check_out ON reservations(check_out_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(check_in_date, check_out_date) WHERE deleted_at IS NULL;

-- Booking date (for reporting)
CREATE INDEX IF NOT EXISTS idx_reservations_booking_date ON reservations(booking_date);

-- Room assignment
CREATE INDEX IF NOT EXISTS idx_reservations_room_number ON reservations(room_number) WHERE room_number IS NOT NULL AND deleted_at IS NULL;

-- Status queries (critical for operational views)
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_property_status ON reservations(property_id, status, deleted_at) WHERE deleted_at IS NULL;

-- Composite index for arrivals (today's check-ins)
CREATE INDEX IF NOT EXISTS idx_reservations_arrivals ON reservations(property_id, check_in_date, status)
    WHERE deleted_at IS NULL AND status IN ('CONFIRMED', 'PENDING');

-- Composite index for departures (today's check-outs)
CREATE INDEX IF NOT EXISTS idx_reservations_departures ON reservations(property_id, check_out_date, status)
    WHERE deleted_at IS NULL AND status = 'CHECKED_IN';

-- In-house guests (currently checked in)
CREATE INDEX IF NOT EXISTS idx_reservations_in_house ON reservations(property_id, status, check_in_date, check_out_date)
    WHERE deleted_at IS NULL AND status = 'CHECKED_IN';

-- Reservation type segmentation
CREATE INDEX IF NOT EXISTS idx_reservations_type ON reservations(tenant_id, property_id, reservation_type)
    WHERE is_deleted = false;

-- Source and channel
CREATE INDEX IF NOT EXISTS idx_reservations_source ON reservations(source) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_channel_ref ON reservations(channel_reference) WHERE channel_reference IS NOT NULL AND deleted_at IS NULL;

-- Guest details (for search)
CREATE INDEX IF NOT EXISTS idx_reservations_guest_name ON reservations(guest_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_guest_email ON reservations(guest_email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_guest_phone ON reservations(guest_phone) WHERE deleted_at IS NULL;

-- Full-text search on guest name
CREATE INDEX IF NOT EXISTS idx_reservations_guest_name_trgm ON reservations USING gin(guest_name gin_trgm_ops) WHERE deleted_at IS NULL;

-- Financial queries
CREATE INDEX IF NOT EXISTS idx_reservations_total_amount ON reservations(total_amount) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_balance_due ON reservations(balance_due) WHERE balance_due > 0 AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_paid_amount ON reservations(paid_amount) WHERE deleted_at IS NULL;

-- No-show tracking
CREATE INDEX IF NOT EXISTS idx_reservations_no_show ON reservations(is_no_show) WHERE is_no_show = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_no_show_date ON reservations(no_show_date) WHERE no_show_date IS NOT NULL;

-- Cancellation tracking
CREATE INDEX IF NOT EXISTS idx_reservations_cancellation_date ON reservations(cancellation_date) WHERE cancellation_date IS NOT NULL;

-- Promo code tracking
CREATE INDEX IF NOT EXISTS idx_reservations_promo_code ON reservations(promo_code) WHERE promo_code IS NOT NULL AND deleted_at IS NULL;

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_reservations_metadata_gin ON reservations USING GIN(metadata);

-- Composite for property + date range + status (critical for dashboard)
CREATE INDEX IF NOT EXISTS idx_reservations_dashboard ON reservations(property_id, check_in_date, check_out_date, status, deleted_at)
    WHERE deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations(created_at);
CREATE INDEX IF NOT EXISTS idx_reservations_updated_at ON reservations(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_reservations_deleted_at ON reservations(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Reservations indexes created successfully!'
