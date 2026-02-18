-- =====================================================
-- 72_comp_accounting.sql
-- Complimentary Accounting Module
-- Industry Standard: OPERA Cloud (COMP_ACCOUNTING),
--                    LMS (COMP_TRACKING), Konami (COMP_ENGINE)
-- Pattern: Casino/resort comp authorization and tracking
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- COMP_AUTHORIZERS TABLE
-- Staff members authorized to issue comps, with limits
-- =====================================================

CREATE TABLE IF NOT EXISTS comp_authorizers (
    -- Primary Key
    authorizer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique authorizer identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                    -- FK tenants.id
    property_id UUID NOT NULL,                                  -- FK properties.id

    -- Authorizer Information
    user_id UUID NOT NULL,                                      -- FK users.id
    department VARCHAR(100) NOT NULL,                            -- Department (e.g., 'FRONT_OFFICE', 'F&B', 'CASINO', 'SALES')
    authorization_level VARCHAR(20) NOT NULL CHECK (
        authorization_level IN ('BASIC', 'STANDARD', 'SENIOR', 'EXECUTIVE', 'UNLIMITED')
    ),                                                          -- Authorization tier

    -- Limits
    daily_comp_limit DECIMAL(10, 2) NOT NULL,                  -- Maximum comp value per day
    single_comp_limit DECIMAL(10, 2) NOT NULL,                 -- Maximum value per single comp
    monthly_comp_limit DECIMAL(10, 2),                         -- Monthly ceiling
    annual_comp_limit DECIMAL(10, 2),                          -- Annual ceiling

    -- Allowed Categories
    allowed_categories TEXT[] DEFAULT ARRAY[
        'ROOM', 'FOOD', 'BEVERAGE', 'SPA', 'PARKING', 'GOLF', 'OTHER'
    ],                                                         -- Which comp categories this authorizer can approve

    -- Usage Tracking
    comps_issued_today_count INTEGER DEFAULT 0,                -- Running daily count
    comps_issued_today_amount DECIMAL(10, 2) DEFAULT 0,        -- Running daily total
    comps_issued_mtd_amount DECIMAL(10, 2) DEFAULT 0,          -- Month-to-date total
    comps_issued_ytd_amount DECIMAL(10, 2) DEFAULT 0,          -- Year-to-date total
    last_comp_date DATE,                                        -- Last comp issued date

    -- Delegation
    can_delegate BOOLEAN DEFAULT FALSE,                        -- Can delegate authority to others
    delegated_by UUID,                                          -- If this authorizer was delegated

    -- Status
    is_active BOOLEAN DEFAULT TRUE,                            -- Active/inactive
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,          -- Authorization start
    effective_to DATE,                                          -- Authorization end (NULL = indefinite)

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                        -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- Creation timestamp
    updated_at TIMESTAMP,                                      -- Last update timestamp
    created_by UUID,                                           -- Creator identifier
    updated_by UUID,                                           -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                          -- Soft delete flag
    deleted_at TIMESTAMP,                                      -- Deletion timestamp
    deleted_by UUID,                                           -- Deleter identifier

    -- Constraints
    CONSTRAINT comp_auth_user_unique UNIQUE (tenant_id, property_id, user_id),
    CONSTRAINT comp_auth_limit_check CHECK (single_comp_limit <= daily_comp_limit),
    CONSTRAINT comp_auth_daily_check CHECK (daily_comp_limit > 0)
);

-- =====================================================
-- COMP_TRANSACTIONS TABLE
-- Individual comp issuances linked to guest folios
-- =====================================================

CREATE TABLE IF NOT EXISTS comp_transactions (
    -- Primary Key
    comp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Unique comp transaction identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                    -- FK tenants.id
    property_id UUID NOT NULL,                                  -- FK properties.id

    -- Comp Details
    comp_number VARCHAR(50) NOT NULL,                           -- Human-readable comp number (e.g., 'COMP-2026-0001')
    comp_category VARCHAR(50) NOT NULL CHECK (
        comp_category IN (
            'ROOM',         -- Complimentary room night
            'FOOD',         -- Complimentary food
            'BEVERAGE',     -- Complimentary beverages
            'SPA',          -- Spa treatment comp
            'PARKING',      -- Parking comp
            'GOLF',         -- Golf green fees comp
            'ENTERTAINMENT',-- Show/event tickets
            'AMENITY',      -- In-room amenity
            'TRANSPORTATION',-- Airport transfer, etc.
            'OTHER'         -- Other comp type
        )
    ),                                                          -- Comp classification

    -- Linked Entities
    guest_id UUID NOT NULL,                                     -- FK guests.id
    reservation_id UUID,                                        -- FK reservations.id (if room-related)
    folio_id UUID,                                              -- FK folios.id (where offset posts)
    charge_posting_id UUID,                                     -- FK charge_postings.id (original charge being comped)

    -- Authorization
    authorizer_id UUID NOT NULL,                                -- FK comp_authorizers.authorizer_id
    reason_code VARCHAR(50),                                    -- FK reason_codes.reason_code (category='COMP')
    authorization_code VARCHAR(50),                             -- Auth code for verification
    authorization_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- When authorized

    -- Financial
    original_amount DECIMAL(10, 2) NOT NULL,                   -- Original charge amount
    comp_amount DECIMAL(10, 2) NOT NULL,                       -- Amount being comped
    tax_amount DECIMAL(10, 2) DEFAULT 0,                       -- Tax on comp (may still be taxable)
    comp_offset_account VARCHAR(50),                            -- GL offset account for comp expense
    currency_code CHAR(3) DEFAULT 'USD',                       -- Currency

    -- Status
    comp_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
        comp_status IN ('PENDING', 'APPROVED', 'POSTED', 'VOIDED', 'REVERSED')
    ),                                                          -- Comp lifecycle status
    posted_at TIMESTAMP,                                        -- When posted to folio
    voided_at TIMESTAMP,                                        -- When voided
    void_reason TEXT,                                           -- Reason for voiding

    -- Guest Context
    guest_tier VARCHAR(50),                                     -- Loyalty tier at time of comp
    guest_lifetime_value DECIMAL(12, 2),                        -- LTV at time of comp

    -- Notes
    comp_description TEXT,                                      -- Description of what was comped
    internal_notes TEXT,                                        -- Staff-only notes

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                        -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- Creation timestamp
    updated_at TIMESTAMP,                                      -- Last update timestamp
    created_by UUID,                                           -- Creator identifier
    updated_by UUID,                                           -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                          -- Soft delete flag
    deleted_at TIMESTAMP,                                      -- Deletion timestamp
    deleted_by UUID,                                           -- Deleter identifier

    -- Optimistic Locking
    version BIGINT DEFAULT 0,                                  -- Row version for concurrency

    -- Constraints
    CONSTRAINT comp_number_unique UNIQUE (tenant_id, property_id, comp_number),
    CONSTRAINT comp_amount_check CHECK (comp_amount > 0),
    CONSTRAINT comp_amount_not_exceed CHECK (comp_amount <= original_amount)
);

-- =====================================================
-- COMP_PROPERTY_CONFIG TABLE
-- Per-property comp accounting configuration
-- =====================================================

CREATE TABLE IF NOT EXISTS comp_property_config (
    -- Primary Key
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),     -- Unique config identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                    -- FK tenants.id
    property_id UUID NOT NULL,                                  -- FK properties.id

    -- Enable/Disable
    comp_accounting_enabled BOOLEAN DEFAULT FALSE,             -- Master toggle for comp accounting

    -- Tax Configuration
    comp_tax_exempt BOOLEAN DEFAULT FALSE,                     -- Are comps exempt from tax
    comp_tax_rate DECIMAL(5, 2),                                -- Special tax rate for comps (if different)

    -- Default GL Accounts
    default_comp_offset_account VARCHAR(50),                    -- Default GL offset for comp postings
    room_comp_account VARCHAR(50),                              -- GL for room comps
    fb_comp_account VARCHAR(50),                                -- GL for F&B comps
    spa_comp_account VARCHAR(50),                               -- GL for spa comps
    other_comp_account VARCHAR(50),                             -- GL for other comps

    -- Approval Rules
    require_reason_code BOOLEAN DEFAULT TRUE,                  -- Force reason code selection
    require_authorization_code BOOLEAN DEFAULT FALSE,          -- Require manual auth code entry
    auto_post_below_amount DECIMAL(10, 2),                     -- Auto-post comps below this amount

    -- Reporting
    daily_comp_report_enabled BOOLEAN DEFAULT TRUE,            -- Generate daily comp report
    daily_comp_report_recipients TEXT[],                         -- Email recipients for daily report
    comp_budget_monthly DECIMAL(12, 2),                         -- Monthly comp budget
    comp_budget_alert_percent DECIMAL(5, 2) DEFAULT 80.0,      -- Alert when budget reaches this %

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                        -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- Creation timestamp
    updated_at TIMESTAMP,                                      -- Last update timestamp
    created_by UUID,                                           -- Creator identifier
    updated_by UUID,                                           -- Modifier identifier

    -- Constraints
    CONSTRAINT comp_config_unique UNIQUE (tenant_id, property_id)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE comp_authorizers IS 'Staff members authorized to issue complementary charges with daily/monthly/annual limits';
COMMENT ON COLUMN comp_authorizers.authorizer_id IS 'Unique authorizer identifier (UUID)';
COMMENT ON COLUMN comp_authorizers.authorization_level IS 'Tier: BASIC, STANDARD, SENIOR, EXECUTIVE, UNLIMITED';
COMMENT ON COLUMN comp_authorizers.daily_comp_limit IS 'Maximum total comp value this authorizer can issue per day';
COMMENT ON COLUMN comp_authorizers.single_comp_limit IS 'Maximum value for a single comp transaction';
COMMENT ON COLUMN comp_authorizers.allowed_categories IS 'Array of comp categories this authorizer can approve';

COMMENT ON TABLE comp_transactions IS 'Individual complementary charge transactions linked to guest folios and authorizers';
COMMENT ON COLUMN comp_transactions.comp_id IS 'Unique comp transaction identifier (UUID)';
COMMENT ON COLUMN comp_transactions.comp_number IS 'Human-readable comp number (e.g., COMP-2026-0001)';
COMMENT ON COLUMN comp_transactions.comp_category IS 'Type of comp: ROOM, FOOD, BEVERAGE, SPA, etc.';
COMMENT ON COLUMN comp_transactions.comp_status IS 'Lifecycle: PENDING, APPROVED, POSTED, VOIDED, REVERSED';
COMMENT ON COLUMN comp_transactions.comp_offset_account IS 'GL account where the comp expense is posted';
COMMENT ON COLUMN comp_transactions.authorization_code IS 'Verification code for the comp authorization';

COMMENT ON TABLE comp_property_config IS 'Per-property configuration for comp accounting including GL accounts, tax rules, and budget thresholds';
COMMENT ON COLUMN comp_property_config.comp_accounting_enabled IS 'Master toggle to enable/disable comp accounting for this property';
COMMENT ON COLUMN comp_property_config.auto_post_below_amount IS 'Comps below this amount are auto-posted without approval queue';
COMMENT ON COLUMN comp_property_config.comp_budget_monthly IS 'Monthly comp budget for alerting and reporting';

\echo 'comp_authorizers, comp_transactions, and comp_property_config tables created successfully!'
