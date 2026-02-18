-- =====================================================
-- 08_reason_codes.sql
-- Configurable Reason Codes
-- Industry Standard: OPERA Cloud (REASON_CODES), Protel (GRUND_CODES),
--                    Mews (REASON_CLASSIFICATION)
-- Pattern: Universal lookup table for multi-purpose reason tracking
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- REASON_CODES TABLE
-- Configurable reason codes for operational actions
-- Used across room moves, rate overrides, deposit overrides,
-- cancellations, comp authorizations, and more
-- =====================================================

CREATE TABLE IF NOT EXISTS reason_codes (
    -- Primary Key
    reason_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Unique reason code identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                -- FK tenants.id
    property_id UUID,                                       -- NULL = tenant-wide default

    -- Reason Identification
    reason_code VARCHAR(50) NOT NULL,                       -- Short code (e.g., 'RM_UPGRADE', 'RO_MGR_DISC')
    reason_name VARCHAR(200) NOT NULL,                      -- Display name (e.g., 'Room Upgrade Request')
    reason_description TEXT,                                 -- Detailed description for staff guidance

    -- Classification
    reason_category VARCHAR(50) NOT NULL CHECK (
        reason_category IN (
            'ROOM_MOVE',            -- Room move/swap reasons
            'RATE_OVERRIDE',        -- Rate override reasons
            'DEPOSIT_OVERRIDE',     -- Deposit policy override reasons
            'CANCELLATION',         -- Cancellation reasons
            'COMP',                 -- Complimentary stay reasons
            'REFUND',               -- Refund reasons
            'WALK',                 -- Walk (relocation) reasons
            'OVERBOOKING',          -- Overbooking reasons
            'EARLY_DEPARTURE',      -- Early departure reasons
            'LATE_CHECKOUT',        -- Late checkout reasons
            'MAINTENANCE',          -- Maintenance-related reasons
            'COMPLAINT',            -- Guest complaint reasons
            'WRITE_OFF',            -- AR write-off reasons
            'OTHER'                 -- Uncategorized
        )
    ),                                                      -- Category grouping for filtering

    -- Authorization
    requires_approval BOOLEAN DEFAULT FALSE,                -- Whether using this reason requires manager approval
    approval_level VARCHAR(20) DEFAULT 'NONE' CHECK (
        approval_level IN ('NONE', 'SUPERVISOR', 'MANAGER', 'DIRECTOR', 'GM')
    ),                                                      -- Minimum role to approve

    -- Financial Impact
    has_financial_impact BOOLEAN DEFAULT FALSE,             -- Whether this reason triggers financial adjustments
    default_adjustment_percent DECIMAL(5, 2),               -- Default percentage adjustment (e.g., -10.00 for 10% discount)
    max_adjustment_amount DECIMAL(10, 2),                   -- Maximum dollar amount allowed under this reason

    -- Usage
    display_order INTEGER DEFAULT 0,                        -- Sort priority in UI dropdowns
    is_active BOOLEAN DEFAULT TRUE,                         -- Enable/disable without deleting
    usage_count INTEGER DEFAULT 0,                          -- Track how often this reason is used

    -- Notes
    internal_notes TEXT,                                    -- Staff-only notes about when to use this code

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                     -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
    updated_at TIMESTAMP,                                   -- Last update timestamp
    created_by UUID,                                        -- Creator identifier
    updated_by UUID,                                        -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                       -- Soft delete flag
    deleted_at TIMESTAMP,                                   -- Deletion timestamp
    deleted_by UUID,                                        -- Deleter identifier

    -- Constraints
    CONSTRAINT reason_codes_unique UNIQUE (tenant_id, property_id, reason_code, reason_category)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE reason_codes IS 'Configurable reason codes for operational actions across room moves, rate overrides, deposit overrides, cancellations, comps, and more';
COMMENT ON COLUMN reason_codes.reason_id IS 'Unique reason code identifier (UUID)';
COMMENT ON COLUMN reason_codes.reason_code IS 'Short code used in dropdowns and reports (e.g., RM_UPGRADE)';
COMMENT ON COLUMN reason_codes.reason_name IS 'Human-readable display name';
COMMENT ON COLUMN reason_codes.reason_category IS 'Category grouping: ROOM_MOVE, RATE_OVERRIDE, DEPOSIT_OVERRIDE, CANCELLATION, COMP, etc.';
COMMENT ON COLUMN reason_codes.requires_approval IS 'TRUE if selecting this reason triggers an approval workflow';
COMMENT ON COLUMN reason_codes.approval_level IS 'Minimum role required to approve: NONE, SUPERVISOR, MANAGER, DIRECTOR, GM';
COMMENT ON COLUMN reason_codes.has_financial_impact IS 'TRUE if this reason triggers financial adjustments on the folio';
COMMENT ON COLUMN reason_codes.default_adjustment_percent IS 'Default percentage adjustment when this reason is applied';
COMMENT ON COLUMN reason_codes.usage_count IS 'Running count of how many times this reason has been selected';

-- =====================================================
-- SEED DATA: Standard reason codes
-- =====================================================

INSERT INTO reason_codes (tenant_id, reason_code, reason_name, reason_category, requires_approval, approval_level, has_financial_impact, display_order)
VALUES
    -- Room Move Reasons
    ('00000000-0000-0000-0000-000000000000', 'RM_UPGRADE',     'Complimentary Upgrade',        'ROOM_MOVE', FALSE, 'NONE',      FALSE, 1),
    ('00000000-0000-0000-0000-000000000000', 'RM_DOWNGRADE',   'Guest Requested Downgrade',    'ROOM_MOVE', FALSE, 'NONE',      TRUE,  2),
    ('00000000-0000-0000-0000-000000000000', 'RM_MAINT',       'Maintenance Issue',            'ROOM_MOVE', FALSE, 'NONE',      FALSE, 3),
    ('00000000-0000-0000-0000-000000000000', 'RM_NOISE',       'Noise Complaint',              'ROOM_MOVE', FALSE, 'NONE',      FALSE, 4),
    ('00000000-0000-0000-0000-000000000000', 'RM_VIEW',        'View Preference',              'ROOM_MOVE', FALSE, 'NONE',      FALSE, 5),
    ('00000000-0000-0000-0000-000000000000', 'RM_ADA',         'Accessibility Requirement',    'ROOM_MOVE', FALSE, 'NONE',      FALSE, 6),
    ('00000000-0000-0000-0000-000000000000', 'RM_VIP',         'VIP Accommodation',            'ROOM_MOVE', TRUE,  'MANAGER',   FALSE, 7),

    -- Rate Override Reasons
    ('00000000-0000-0000-0000-000000000000', 'RO_MGR_DISC',    'Manager Discount',             'RATE_OVERRIDE', TRUE,  'MANAGER',   TRUE, 1),
    ('00000000-0000-0000-0000-000000000000', 'RO_LOYALTY',     'Loyalty Member Rate',          'RATE_OVERRIDE', FALSE, 'NONE',      TRUE, 2),
    ('00000000-0000-0000-0000-000000000000', 'RO_NEGOTIATE',   'Negotiated Rate',              'RATE_OVERRIDE', TRUE,  'SUPERVISOR', TRUE, 3),
    ('00000000-0000-0000-0000-000000000000', 'RO_MATCH',       'Rate Match (Competitor)',       'RATE_OVERRIDE', TRUE,  'MANAGER',   TRUE, 4),
    ('00000000-0000-0000-0000-000000000000', 'RO_EXTENDED',    'Extended Stay Discount',       'RATE_OVERRIDE', FALSE, 'NONE',      TRUE, 5),
    ('00000000-0000-0000-0000-000000000000', 'RO_RECOVERY',    'Service Recovery',             'RATE_OVERRIDE', TRUE,  'MANAGER',   TRUE, 6),

    -- Deposit Override Reasons
    ('00000000-0000-0000-0000-000000000000', 'DO_CORP',        'Corporate Account (no deposit)', 'DEPOSIT_OVERRIDE', FALSE, 'NONE',      TRUE, 1),
    ('00000000-0000-0000-0000-000000000000', 'DO_VIP',         'VIP Guest Waiver',               'DEPOSIT_OVERRIDE', TRUE,  'MANAGER',   TRUE, 2),
    ('00000000-0000-0000-0000-000000000000', 'DO_REPEAT',      'Repeat Guest Waiver',            'DEPOSIT_OVERRIDE', FALSE, 'SUPERVISOR', TRUE, 3),
    ('00000000-0000-0000-0000-000000000000', 'DO_GROUP',       'Group Booking Terms',            'DEPOSIT_OVERRIDE', FALSE, 'NONE',      TRUE, 4),

    -- Cancellation Reasons
    ('00000000-0000-0000-0000-000000000000', 'CX_PERSONAL',    'Personal Reasons',             'CANCELLATION', FALSE, 'NONE', FALSE, 1),
    ('00000000-0000-0000-0000-000000000000', 'CX_TRAVEL',      'Travel Plans Changed',         'CANCELLATION', FALSE, 'NONE', FALSE, 2),
    ('00000000-0000-0000-0000-000000000000', 'CX_PRICE',       'Found Better Price',           'CANCELLATION', FALSE, 'NONE', FALSE, 3),
    ('00000000-0000-0000-0000-000000000000', 'CX_WEATHER',     'Weather/Natural Disaster',     'CANCELLATION', FALSE, 'NONE', FALSE, 4),
    ('00000000-0000-0000-0000-000000000000', 'CX_MEDICAL',     'Medical Emergency',            'CANCELLATION', FALSE, 'NONE', FALSE, 5),
    ('00000000-0000-0000-0000-000000000000', 'CX_DUPLICATE',   'Duplicate Booking',            'CANCELLATION', FALSE, 'NONE', FALSE, 6)
ON CONFLICT DO NOTHING;

\echo 'reason_codes table created successfully!'
