-- =====================================================
-- properties.sql
-- Properties Table
-- Industry Standard: Individual hotels/resorts/properties
-- Pattern: Oracle OPERA Cloud Property, Cloudbeds Property
-- Date: 2025-10-15
-- =====================================================

\c tartware \echo 'Creating properties table...'

-- =====================================================
-- PROPERTIES TABLE
-- Individual hotels, resorts, or properties within a tenant
-- Each property operates semi-independently
-- =====================================================

CREATE TABLE IF NOT EXISTS properties (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Property identity shared across modules

-- Multi-Tenancy
tenant_id UUID NOT NULL, -- FK tenants.id

-- Basic Information
property_name VARCHAR(255) NOT NULL, -- Marketing/display name of the property
property_code VARCHAR(50) UNIQUE NOT NULL, -- Short code used in reports, integrations

-- Location
address JSONB NOT NULL DEFAULT '{
        "street": "",
        "city": "",
        "state": "",
        "postalCode": "",
        "country": "",
        "latitude": null,
        "longitude": null
    }'::jsonb, -- Structured address including geolocation

-- Contact Information
phone VARCHAR(20), -- Primary front desk phone
email VARCHAR(255), -- Property contact email
website VARCHAR(500), -- Property marketing website

-- Property Details
property_type VARCHAR(50) DEFAULT 'hotel', -- Category for reporting (hotel, resort, etc.)
star_rating DECIMAL(2, 1) CHECK (
    star_rating >= 0
    AND star_rating <= 5
), -- Industry star rating
total_rooms INTEGER NOT NULL DEFAULT 0, -- Inventory count used for occupancy metrics

-- Business Information
tax_id VARCHAR(100), -- Property-specific tax identifier
license_number VARCHAR(100), -- Hospitality licence / registration
currency VARCHAR(3) DEFAULT 'USD', -- Default transaction currency (ISO 4217)
timezone VARCHAR(100) DEFAULT 'UTC', -- Operational timezone (Olson format)

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
    }'::jsonb, -- Operational defaults (check-in/out, policies)

-- Integration Settings
integrations JSONB DEFAULT '{
        "pms": {},
        "channelManager": {},
        "paymentGateway": {},
        "accounting": {}
    }'::jsonb, -- External system credentials/settings

-- Status
is_active BOOLEAN NOT NULL DEFAULT true, -- Enables property-level activation toggles

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Extensible key/value storage for add-ons

-- Audit Fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP, -- Last update timestamp
created_by VARCHAR(100), -- Creator identifier
updated_by VARCHAR(100), -- Modifier identifier

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP, -- Soft delete timestamp
deleted_by VARCHAR(100), -- Soft delete actor

-- Optimistic Locking
version BIGINT DEFAULT 0, -- Version counter for concurrency

-- Constraints
CONSTRAINT properties_code_format CHECK (property_code ~ '^[A-Z0-9_-]+$'), -- Restrict code format
    CONSTRAINT properties_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'), -- Email validation
    CONSTRAINT properties_total_rooms_check CHECK (total_rooms >= 0) -- Prevent negative inventory
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
