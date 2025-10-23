-- =====================================================
-- tenants.sql
-- Tenants (Organizations) Table
-- Industry Standard: Root entity for multi-tenant architecture
-- Pattern: Oracle OPERA Cloud, Cloudbeds, Protel PMS, RMS Cloud
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating tenants table...'

-- =====================================================
-- TENANTS TABLE
-- Root entity for multi-tenant SaaS architecture
-- Each tenant represents an organization (hotel chain, franchise, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS tenants (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Information
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,

    -- Classification
    type tenant_type NOT NULL,
    status tenant_status NOT NULL DEFAULT 'TRIAL',

    -- Contact Information
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    website VARCHAR(500),

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country CHAR(2), -- ISO 3166-1 alpha-2 (US, CA, GB, etc.)

    -- Business Information
    tax_id VARCHAR(100),
    business_license VARCHAR(100),
    registration_number VARCHAR(100),

    -- Configuration (JSONB for flexibility)
    config JSONB NOT NULL DEFAULT '{
        "brandingEnabled": true,
        "enableMultiProperty": true,
        "enableChannelManager": false,
        "enableAdvancedReporting": false,
        "enablePaymentProcessing": true,
        "enableLoyaltyProgram": false,
        "maxProperties": 5,
        "maxUsers": 10,
        "defaultCurrency": "USD",
        "defaultLanguage": "en",
        "defaultTimezone": "UTC",
        "features": ["reservations", "payments", "housekeeping"]
    }'::jsonb,

    -- Subscription Information (JSONB)
    subscription JSONB NOT NULL DEFAULT '{
        "plan": "FREE",
        "startDate": null,
        "endDate": null,
        "trialEndDate": null,
        "billingCycle": "MONTHLY",
        "amount": 0,
        "currency": "USD"
    }'::jsonb,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete (GDPR compliant)
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT tenants_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE tenants IS 'Multi-tenant organizations (hotel chains, franchises, independent properties)';
COMMENT ON COLUMN tenants.id IS 'Unique tenant identifier (UUID)';
COMMENT ON COLUMN tenants.name IS 'Tenant organization name (e.g., "Marriott International")';
COMMENT ON COLUMN tenants.slug IS 'URL-friendly unique identifier (e.g., "marriott-international")';
COMMENT ON COLUMN tenants.type IS 'Organization type: CHAIN, FRANCHISE, INDEPENDENT, MANAGEMENT_COMPANY';
COMMENT ON COLUMN tenants.status IS 'Subscription status: TRIAL, ACTIVE, SUSPENDED, INACTIVE, CANCELLED';
COMMENT ON COLUMN tenants.config IS 'Tenant configuration settings (JSONB for flexibility)';
COMMENT ON COLUMN tenants.subscription IS 'Subscription and billing information (JSONB)';
COMMENT ON COLUMN tenants.metadata IS 'Custom metadata fields (JSONB)';
COMMENT ON COLUMN tenants.deleted_at IS 'Soft delete timestamp (NULL = active)';
COMMENT ON COLUMN tenants.version IS 'Optimistic locking version (prevents concurrent update conflicts)';

\echo 'Tenants table created successfully!'
