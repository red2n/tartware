-- =====================================================
-- 05_guests_indexes.sql
-- Indexes for guests table
-- Performance optimization for guest lookups
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for guests table...'

-- Foreign key index
CREATE INDEX IF NOT EXISTS idx_guests_tenant_id ON guests(tenant_id) WHERE deleted_at IS NULL;

-- Email lookup (critical for guest search)
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email) WHERE deleted_at IS NULL;

-- Name search (for autocomplete)
CREATE INDEX IF NOT EXISTS idx_guests_first_name ON guests(first_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guests_last_name ON guests(last_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guests_full_name ON guests(first_name, last_name) WHERE deleted_at IS NULL;

-- Full-text search on names
CREATE INDEX IF NOT EXISTS idx_guests_name_trgm ON guests USING gin((first_name || ' ' || last_name) gin_trgm_ops) WHERE deleted_at IS NULL;

-- Phone lookup
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone) WHERE deleted_at IS NULL;

-- Identification
CREATE INDEX IF NOT EXISTS idx_guests_id_number ON guests(id_number) WHERE id_number IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guests_passport ON guests(passport_number) WHERE passport_number IS NOT NULL AND deleted_at IS NULL;

-- Loyalty program
CREATE INDEX IF NOT EXISTS idx_guests_loyalty_tier ON guests(loyalty_tier) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guests_loyalty_points ON guests(loyalty_points DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guests_vip_status ON guests(vip_status) WHERE vip_status = true AND deleted_at IS NULL;

-- Blacklist (important for security)
CREATE INDEX IF NOT EXISTS idx_guests_blacklisted ON guests(is_blacklisted) WHERE is_blacklisted = true AND deleted_at IS NULL;

-- Guest history (for reporting)
CREATE INDEX IF NOT EXISTS idx_guests_total_bookings ON guests(total_bookings DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guests_total_revenue ON guests(total_revenue DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_guests_last_stay ON guests(last_stay_date DESC) WHERE deleted_at IS NULL;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_guests_address_gin ON guests USING GIN(address);
CREATE INDEX IF NOT EXISTS idx_guests_preferences_gin ON guests USING GIN(preferences);
CREATE INDEX IF NOT EXISTS idx_guests_communication_gin ON guests USING GIN(communication_preferences);

-- Composite index for tenant guest lookup
CREATE INDEX IF NOT EXISTS idx_guests_tenant_email ON guests(tenant_id, email) WHERE deleted_at IS NULL;

-- Date of birth (for birthday campaigns)
CREATE INDEX IF NOT EXISTS idx_guests_date_of_birth ON guests(date_of_birth) WHERE deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_guests_created_at ON guests(created_at);
CREATE INDEX IF NOT EXISTS idx_guests_updated_at ON guests(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_guests_deleted_at ON guests(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Guests indexes created successfully!'
