-- =====================================================
-- 15_services_indexes.sql
-- Indexes for services table
-- Performance optimization for service catalog queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for services table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_services_tenant_id ON services(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_property_id ON services(property_id) WHERE deleted_at IS NULL;

-- Service code lookup
CREATE INDEX IF NOT EXISTS idx_services_code ON services(service_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_property_code ON services(property_id, service_code) WHERE deleted_at IS NULL;

-- Service name search
CREATE INDEX IF NOT EXISTS idx_services_name ON services(service_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_name_trgm ON services USING gin(service_name gin_trgm_ops) WHERE deleted_at IS NULL;

-- Category filtering
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_subcategory ON services(subcategory) WHERE subcategory IS NOT NULL AND deleted_at IS NULL;

-- Composite for property services by category
CREATE INDEX IF NOT EXISTS idx_services_property_category ON services(property_id, category, is_active, deleted_at)
    WHERE deleted_at IS NULL;

-- Pricing
CREATE INDEX IF NOT EXISTS idx_services_price ON services(price) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_currency ON services(currency) WHERE deleted_at IS NULL;

-- Availability queries
CREATE INDEX IF NOT EXISTS idx_services_is_available ON services(is_available) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_services_requires_booking ON services(requires_booking) WHERE requires_booking = true AND deleted_at IS NULL;

-- Status
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active) WHERE deleted_at IS NULL;

-- Display order
CREATE INDEX IF NOT EXISTS idx_services_display_order ON services(display_order) WHERE deleted_at IS NULL;

-- Tax configuration
CREATE INDEX IF NOT EXISTS idx_services_is_taxable ON services(is_taxable) WHERE deleted_at IS NULL;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_services_available_days_gin ON services USING GIN(available_days);
CREATE INDEX IF NOT EXISTS idx_services_available_times_gin ON services USING GIN(available_times);
CREATE INDEX IF NOT EXISTS idx_services_metadata_gin ON services USING GIN(metadata);

-- Composite for active bookable services
CREATE INDEX IF NOT EXISTS idx_services_bookable ON services(property_id, category, requires_booking, is_available, deleted_at)
    WHERE requires_booking = true AND is_available = true AND deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at);
CREATE INDEX IF NOT EXISTS idx_services_updated_at ON services(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_services_deleted_at ON services(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Services indexes created successfully!'
