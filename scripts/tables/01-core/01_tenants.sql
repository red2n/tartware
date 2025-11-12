-- =====================================================
-- tenants.sql
-- Tenants (Organizations) Table
-- Industry Standard: Root entity for multi-tenant architecture
-- Pattern: Oracle OPERA Cloud, Cloudbeds, Protel PMS, RMS Cloud
-- Date: 2025-10-15
-- =====================================================

\c tartware \echo 'Creating tenants table...'

-- =====================================================
-- TENANTS TABLE
-- Root entity for multi-tenant SaaS architecture
-- Each tenant represents an organization (hotel chain, franchise, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS tenants (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Stable identifier used across domains

-- Basic Information
name VARCHAR(200) NOT NULL, -- Legal/marketing name displayed throughout the UI
slug VARCHAR(200) UNIQUE NOT NULL, -- URL-safe identifier used for vanity subdomains

-- Classification
type tenant_type NOT NULL, -- Categorises tenant (CHAIN, FRANCHISE, etc.) for feature toggles
status tenant_status NOT NULL DEFAULT 'TRIAL', -- Subscription lifecycle flag for billing

-- Contact Information
email VARCHAR(255) NOT NULL, -- Primary administrative email for notifications
phone VARCHAR(20), -- Optional support phone number
website VARCHAR(500), -- Tenant-branded marketing site

-- Address
address_line1 VARCHAR(255), -- Street address (line 1)
address_line2 VARCHAR(255), -- Street address (line 2 / suite)
city VARCHAR(100), -- City for localisation and tax jurisdiction
state VARCHAR(100), -- State/region information
postal_code VARCHAR(20), -- Postal/ZIP code
country CHAR(2), -- ISO 3166-1 alpha-2 (US, CA, GB, etc.)

-- Business Information
tax_id VARCHAR(100), -- National tax identifier used on invoices
business_license VARCHAR(100), -- Hospitality licence or permit number
registration_number VARCHAR(100), -- Company registration or incorporation number

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
    }'::jsonb, -- Feature toggles and operational limits per tenant

-- Subscription Information (JSONB)
subscription JSONB NOT NULL DEFAULT '{
        "plan": "FREE",
        "startDate": null,
        "endDate": null,
        "trialEndDate": null,
        "billingCycle": "MONTHLY",
        "amount": 0,
        "currency": "USD"
    }'::jsonb, -- Billing plan metadata synced with invoicing

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Arbitrary extensibility hooks for integrations

-- Audit Fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Record creation timestamp
updated_at TIMESTAMP, -- Last update timestamp (managed by application triggers)
created_by VARCHAR(100), -- User that created the tenant
updated_by VARCHAR(100), -- User that last updated the tenant

-- Soft Delete (GDPR compliant)
is_deleted BOOLEAN DEFAULT FALSE, -- Flag indicating tenant has been soft-deleted
deleted_at TIMESTAMP, -- Timestamp of soft deletion
deleted_by VARCHAR(100), -- User who initiated soft deletion

-- Optimistic Locking
version BIGINT DEFAULT 0, -- Incremented on updates to prevent stale writes

-- Constraints
CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9-]+$'), -- Enforce slug character set
    CONSTRAINT tenants_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') -- Basic email structure validation
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
