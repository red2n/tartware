-- =====================================================
-- guests.sql
-- Guests Table
-- Industry Standard: Customer/Guest profiles
-- Pattern: Oracle OPERA Cloud Guest Profile, Cloudbeds Guest
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating guests table...'

-- =====================================================
-- GUESTS TABLE
-- Customer profiles across all tenants
-- Centralized guest management with tenant isolation
-- =====================================================

CREATE TABLE IF NOT EXISTS guests (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,

    -- Personal Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    title VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20),
    nationality VARCHAR(3),

    -- Contact Information
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    secondary_phone VARCHAR(20),

    -- Address
    address JSONB DEFAULT '{
        "street": "",
        "city": "",
        "state": "",
        "postalCode": "",
        "country": ""
    }'::jsonb,

    -- Identification
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    passport_number VARCHAR(50),
    passport_expiry DATE,

    -- Company Information (for corporate guests)
    company_name VARCHAR(255),
    company_tax_id VARCHAR(100),

    -- Loyalty Program
    loyalty_tier VARCHAR(50),
    loyalty_points INTEGER DEFAULT 0,
    vip_status BOOLEAN DEFAULT false,

    -- Preferences (JSONB)
    preferences JSONB DEFAULT '{
        "roomType": null,
        "bedType": null,
        "floor": null,
        "smoking": false,
        "specialRequests": [],
        "dietaryRestrictions": [],
        "language": "en"
    }'::jsonb,

    -- Communication Preferences
    marketing_consent BOOLEAN DEFAULT false,
    communication_preferences JSONB DEFAULT '{
        "email": true,
        "sms": false,
        "phone": true,
        "post": false
    }'::jsonb,

    -- Guest History
    total_bookings INTEGER DEFAULT 0,
    total_nights INTEGER DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0.00,
    last_stay_date DATE,

    -- Status
    is_blacklisted BOOLEAN DEFAULT false,
    blacklist_reason TEXT,

    -- Notes
    notes TEXT,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT guests_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT guests_loyalty_points_check CHECK (loyalty_points >= 0),
    CONSTRAINT guests_total_bookings_check CHECK (total_bookings >= 0),
    CONSTRAINT guests_total_nights_check CHECK (total_nights >= 0),
    CONSTRAINT guests_total_revenue_check CHECK (total_revenue >= 0)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE guests IS 'Guest/customer profiles with loyalty and preferences';
COMMENT ON COLUMN guests.id IS 'Unique guest identifier (UUID)';
COMMENT ON COLUMN guests.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN guests.email IS 'Primary email address';
COMMENT ON COLUMN guests.nationality IS 'ISO 3166-1 alpha-3 country code';
COMMENT ON COLUMN guests.loyalty_tier IS 'Loyalty program tier (e.g., Silver, Gold, Platinum)';
COMMENT ON COLUMN guests.loyalty_points IS 'Accumulated loyalty points';
COMMENT ON COLUMN guests.vip_status IS 'VIP guest flag';
COMMENT ON COLUMN guests.preferences IS 'Guest preferences (JSONB)';
COMMENT ON COLUMN guests.total_bookings IS 'Total number of bookings made';
COMMENT ON COLUMN guests.total_nights IS 'Total nights stayed';
COMMENT ON COLUMN guests.total_revenue IS 'Total revenue generated';
COMMENT ON COLUMN guests.is_blacklisted IS 'Blacklist flag';
COMMENT ON COLUMN guests.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Guests table created successfully!'
