-- =====================================================
-- guests.sql
-- Guests Table
-- Industry Standard: Customer/Guest profiles
-- Pattern: Oracle OPERA Cloud Guest Profile, Cloudbeds Guest
-- Date: 2025-10-15
-- =====================================================

\c tartware \echo 'Creating guests table...'

-- =====================================================
-- GUESTS TABLE
-- Customer profiles across all tenants
-- Centralized guest management with tenant isolation
-- =====================================================

CREATE TABLE IF NOT EXISTS guests (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Guest profile identifier

-- Multi-Tenancy
tenant_id UUID NOT NULL, -- FK tenants.id

-- Personal Information
first_name VARCHAR(100) NOT NULL, -- Given name
last_name VARCHAR(100) NOT NULL, -- Surname
middle_name VARCHAR(100), -- Optional middle name
title VARCHAR(20), -- Honorific (Mr, Ms, Dr)
date_of_birth DATE, -- Used for age-based offers/compliance
gender VARCHAR(20), -- Optional gender identification
nationality VARCHAR(3), -- ISO 3166-1 alpha-3 country code

-- Contact Information
email VARCHAR(255) NOT NULL, -- Primary contact email
phone VARCHAR(20), -- Preferred contact number
secondary_phone VARCHAR(20), -- Alternate phone

-- Address
address JSONB DEFAULT '{
        "street": "",
        "city": "",
        "state": "",
        "postalCode": "",
        "country": ""
    }'::jsonb, -- Mailing address snapshot

-- Identification
id_type VARCHAR(50), -- Document type (passport, national ID)
id_number VARCHAR(100), -- Document identifier
passport_number VARCHAR(50), -- Passport number for international guests
passport_expiry DATE, -- Passport expiration date

-- Company Information (for corporate guests)
company_name VARCHAR(255), -- Company affiliation for corporate rates
company_tax_id VARCHAR(100), -- Corporate tax ID for invoicing

-- Loyalty Program
loyalty_tier VARCHAR(50), -- Loyalty tier name
loyalty_points INTEGER DEFAULT 0, -- Accumulated points
vip_status BOOLEAN DEFAULT false, -- VIP flag

-- Preferences (JSONB)
preferences JSONB DEFAULT '{
        "roomType": null,
        "bedType": null,
        "floor": null,
        "smoking": false,
        "specialRequests": [],
        "dietaryRestrictions": [],
        "language": "en"
    }'::jsonb, -- Stay preferences and customisations

-- Communication Preferences
marketing_consent BOOLEAN DEFAULT false, -- GDPR consent flag
communication_preferences JSONB DEFAULT '{
        "email": true,
        "sms": false,
        "phone": true,
        "post": false
    }'::jsonb, -- Channel-specific opt-ins

-- Guest History
total_bookings INTEGER DEFAULT 0, -- Historical bookings count
total_nights INTEGER DEFAULT 0, -- Total nights stayed
total_revenue DECIMAL(15, 2) DEFAULT 0.00, -- Lifetime spend
last_stay_date DATE, -- Date of most recent checkout

-- Status
is_blacklisted BOOLEAN DEFAULT false, -- Denotes guests denied future service
blacklist_reason TEXT, -- Reason for blacklist

-- Notes
notes TEXT, -- Internal notes regarding guest

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Additional key/value extensions

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
CONSTRAINT guests_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'), -- Email validation
    CONSTRAINT guests_loyalty_points_check CHECK (loyalty_points >= 0), -- Prevent negative points
    CONSTRAINT guests_total_bookings_check CHECK (total_bookings >= 0), -- Ensure non-negative counts
    CONSTRAINT guests_total_nights_check CHECK (total_nights >= 0), -- Ensure non-negative nights
    CONSTRAINT guests_total_revenue_check CHECK (total_revenue >= 0) -- Lifetime revenue cannot be negative
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
