-- =====================================================
-- properties.sql
-- Properties Table
-- Industry Standard: Individual hotels/resorts/properties
-- Pattern: Oracle OPERA Cloud Property, Cloudbeds Property
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating properties table...'

-- =====================================================
-- PROPERTIES TABLE
-- Individual hotels, resorts, or properties within a tenant
-- Each property operates semi-independently
-- =====================================================

CREATE TABLE IF NOT EXISTS properties (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,

    -- Basic Information
    property_name VARCHAR(255) NOT NULL,
    property_code VARCHAR(50) UNIQUE NOT NULL,

    -- Location
    address JSONB NOT NULL DEFAULT '{
        "street": "",
        "city": "",
        "state": "",
        "postalCode": "",
        "country": "",
        "latitude": null,
        "longitude": null
    }'::jsonb,

    -- Contact Information
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(500),

    -- Property Details
    property_type VARCHAR(50) DEFAULT 'hotel',
    star_rating DECIMAL(2,1) CHECK (star_rating >= 0 AND star_rating <= 5),
    total_rooms INTEGER NOT NULL DEFAULT 0,

    -- Business Information
    tax_id VARCHAR(100),
    license_number VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'USD',
    timezone VARCHAR(100) DEFAULT 'UTC',

    -- Configuration (JSONB)
    config JSONB DEFAULT '{
        "checkInTime": "15:00",
        "checkOutTime": "11:00",
        "cancellationPolicy": {
            "hours": 24,
            "penalty": 0
        },
        "paymentMethods": ["cash", "card", "bank_transfer"],
        "amenities": [],
        "policies": {}
    }'::jsonb,

    -- Integration Settings
    integrations JSONB DEFAULT '{
        "pms": {},
        "channelManager": {},
        "paymentGateway": {},
        "accounting": {}
    }'::jsonb,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

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
    CONSTRAINT properties_code_format CHECK (property_code ~ '^[A-Z0-9_-]+$'),
    CONSTRAINT properties_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT properties_total_rooms_check CHECK (total_rooms >= 0)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE properties IS 'Individual hotels/resorts/properties within a tenant';
COMMENT ON COLUMN properties.id IS 'Unique property identifier (UUID)';
COMMENT ON COLUMN properties.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN properties.property_name IS 'Display name of the property';
COMMENT ON COLUMN properties.property_code IS 'Unique property code (e.g., HTL001)';
COMMENT ON COLUMN properties.address IS 'Full address with coordinates (JSONB)';
COMMENT ON COLUMN properties.property_type IS 'Type: hotel, resort, hostel, motel, apartment, villa';
COMMENT ON COLUMN properties.star_rating IS 'Star rating (0.0 to 5.0)';
COMMENT ON COLUMN properties.total_rooms IS 'Total number of rooms in property';
COMMENT ON COLUMN properties.config IS 'Property configuration (check-in/out times, policies, amenities)';
COMMENT ON COLUMN properties.integrations IS 'Third-party integration settings (JSONB)';
COMMENT ON COLUMN properties.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Properties table created successfully!'
