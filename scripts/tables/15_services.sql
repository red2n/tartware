-- =====================================================
-- services.sql
-- Services Table
-- Industry Standard: Hotel services catalog
-- Pattern: Oracle OPERA Services, POS Integration
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating services table...'

-- =====================================================
-- SERVICES TABLE
-- Hotel services (spa, laundry, restaurant, etc.)
-- Product/service catalog
-- =====================================================

CREATE TABLE IF NOT EXISTS services (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Service Information
    service_name VARCHAR(255) NOT NULL,
    service_code VARCHAR(50) NOT NULL,

    -- Category
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),

    -- Description
    description TEXT,
    short_description VARCHAR(500),

    -- Pricing
    price DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    pricing_unit VARCHAR(50) DEFAULT 'per_unit',

    -- Tax
    is_taxable BOOLEAN DEFAULT true,
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    tax_category VARCHAR(100),

    -- Availability
    is_available BOOLEAN DEFAULT true,
    available_days JSONB DEFAULT '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]'::jsonb,
    available_times JSONB DEFAULT '{
        "start": "00:00",
        "end": "23:59"
    }'::jsonb,

    -- Booking
    requires_booking BOOLEAN DEFAULT false,
    advance_booking_hours INTEGER DEFAULT 0,
    max_capacity INTEGER,

    -- Duration (for time-based services)
    duration_minutes INTEGER,

    -- Commission (for revenue sharing)
    commission_rate DECIMAL(5,2) DEFAULT 0.00,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Display
    display_order INTEGER DEFAULT 0,
    image_url VARCHAR(500),

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT services_code_unique UNIQUE (property_id, service_code),
    CONSTRAINT services_code_format CHECK (service_code ~ '^[A-Z0-9_-]+$'),
    CONSTRAINT services_price_check CHECK (price >= 0),
    CONSTRAINT services_capacity_check CHECK (max_capacity IS NULL OR max_capacity > 0)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE services IS 'Hotel services catalog (spa, laundry, F&B, etc.)';
COMMENT ON COLUMN services.id IS 'Unique service identifier (UUID)';
COMMENT ON COLUMN services.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN services.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN services.service_name IS 'Display name (e.g., Spa Massage, Laundry Service)';
COMMENT ON COLUMN services.service_code IS 'Unique code within property (e.g., SPA-001)';
COMMENT ON COLUMN services.category IS 'Category: spa, laundry, restaurant, bar, minibar, parking, etc.';
COMMENT ON COLUMN services.price IS 'Service price';
COMMENT ON COLUMN services.pricing_unit IS 'Unit: per_unit, per_hour, per_person, per_kg, etc.';
COMMENT ON COLUMN services.is_taxable IS 'Whether service is subject to tax';
COMMENT ON COLUMN services.available_days IS 'Days service is available (JSONB array)';
COMMENT ON COLUMN services.available_times IS 'Operating hours (JSONB)';
COMMENT ON COLUMN services.requires_booking IS 'Requires advance reservation';
COMMENT ON COLUMN services.duration_minutes IS 'Service duration (for time-based services)';
COMMENT ON COLUMN services.commission_rate IS 'Commission percentage (for third-party services)';
COMMENT ON COLUMN services.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Services table created successfully!'
