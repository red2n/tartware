-- =====================================================
-- 08_rates_indexes.sql
-- Indexes for rates table
-- Performance optimization for rate plan queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for rates table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_rates_tenant_id ON rates(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rates_property_id ON rates(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rates_room_type_id ON rates(room_type_id) WHERE deleted_at IS NULL;

-- Rate code lookup
CREATE INDEX IF NOT EXISTS idx_rates_code ON rates(rate_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rates_property_code ON rates(property_id, rate_code) WHERE deleted_at IS NULL;

-- Rate name search
CREATE INDEX IF NOT EXISTS idx_rates_name ON rates(rate_name) WHERE deleted_at IS NULL;

-- Strategy and status
CREATE INDEX IF NOT EXISTS idx_rates_strategy ON rates(strategy) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rates_status ON rates(status) WHERE deleted_at IS NULL;

-- Date range queries (critical for rate lookup)
CREATE INDEX IF NOT EXISTS idx_rates_valid_from ON rates(valid_from);
CREATE INDEX IF NOT EXISTS idx_rates_valid_until ON rates(valid_until);
CREATE INDEX IF NOT EXISTS idx_rates_date_range ON rates(valid_from, valid_until) WHERE deleted_at IS NULL AND status = 'ACTIVE';

-- Composite index for rate search (most common query)
CREATE INDEX IF NOT EXISTS idx_rates_property_type_dates ON rates(property_id, room_type_id, valid_from, valid_until, status)
    WHERE deleted_at IS NULL;

-- Pricing
CREATE INDEX IF NOT EXISTS idx_rates_base_rate ON rates(base_rate) WHERE deleted_at IS NULL;

-- Booking window
CREATE INDEX IF NOT EXISTS idx_rates_advance_booking ON rates(advance_booking_days_min, advance_booking_days_max) WHERE deleted_at IS NULL;

-- Stay restrictions
CREATE INDEX IF NOT EXISTS idx_rates_length_of_stay ON rates(min_length_of_stay, max_length_of_stay) WHERE deleted_at IS NULL;

-- Closure flags
CREATE INDEX IF NOT EXISTS idx_rates_closed_to_arrival ON rates(closed_to_arrival) WHERE closed_to_arrival = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rates_closed_to_departure ON rates(closed_to_departure) WHERE closed_to_departure = true AND deleted_at IS NULL;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_rates_cancellation_gin ON rates USING GIN(cancellation_policy);
CREATE INDEX IF NOT EXISTS idx_rates_modifiers_gin ON rates USING GIN(modifiers);
CREATE INDEX IF NOT EXISTS idx_rates_channels_gin ON rates USING GIN(channels);
CREATE INDEX IF NOT EXISTS idx_rates_segments_gin ON rates USING GIN(customer_segments);

-- Display order
CREATE INDEX IF NOT EXISTS idx_rates_display_order ON rates(display_order) WHERE deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_rates_created_at ON rates(created_at);
CREATE INDEX IF NOT EXISTS idx_rates_updated_at ON rates(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_rates_deleted_at ON rates(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Rates indexes created successfully!'
