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
            'REVERSAL',             -- Undoing a lifecycle event: check-in, check-out, cancellation
            'NIGHT_AUDIT',          -- Overriding a night-audit precondition (skip_preconditions)
            'BLACKLIST',            -- Booking a guest the property has blacklisted
            'CREDIT_LIMIT',         -- Taking a balance past a configured credit limit
            'CHECK_IN_OVERRIDE',    -- Forcing check-in past its deposit or lifecycle gate
            'CHECK_OUT_OVERRIDE',   -- Checking out over an unsettled folio (balance goes to AR)
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
COMMENT ON COLUMN reason_codes.reason_category IS 'Category grouping: ROOM_MOVE, RATE_OVERRIDE, DEPOSIT_OVERRIDE, CANCELLATION, COMP, NIGHT_AUDIT, BLACKLIST, CREDIT_LIMIT, CHECK_IN_OVERRIDE, CHECK_OUT_OVERRIDE, etc.';
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

-- =====================================================
-- SEED DATA: Override reason codes the handlers resolve
-- =====================================================
--
-- These are seeded here, under the all-zero system tenant, for the same reason
-- the block above is: `resolveReasonCode` resolves property → tenant → system
-- defaults, and the system level is the only one a tenant nobody has configured
-- can see. They spent a release under the demo tenant in
-- scripts/data/defaults/default_seed.json instead, where no other tenant could
-- resolve them — so a night audit could not state why it skipped a
-- precondition, and a blacklisted guest could not be booked under any code, on
-- every property except the sample one. Reference data the handlers require
-- ships with the schema.

INSERT INTO reason_codes (tenant_id, reason_code, reason_name, reason_description, reason_category, requires_approval, approval_level, has_financial_impact, display_order)
VALUES
    -- Reversal Reasons
    ('00000000-0000-0000-0000-000000000000', 'KEYED_IN_ERROR', 'Keyed in error', 'Operator selected the wrong reservation or pressed the wrong action.', 'REVERSAL', FALSE, 'NONE', FALSE, 1),
    ('00000000-0000-0000-0000-000000000000', 'GUEST_DID_NOT_ARRIVE', 'Guest did not arrive', 'Check-in was recorded but the guest never took occupancy.', 'REVERSAL', FALSE, 'NONE', FALSE, 2),
    ('00000000-0000-0000-0000-000000000000', 'ROOM_UNSUITABLE', 'Room unsuitable', 'Guest refused the room at arrival; check-in undone pending reassignment.', 'REVERSAL', FALSE, 'NONE', FALSE, 3),
    ('00000000-0000-0000-0000-000000000000', 'SYSTEM_ERROR', 'System or interface error', 'Status was set by a failed integration or duplicate message.', 'REVERSAL', FALSE, 'NONE', FALSE, 4),
    ('00000000-0000-0000-0000-000000000000', 'EARLY_DEPARTURE_REVERSED', 'Departure recorded in error', 'Guest is still in house; check-out undone and folio reopened.', 'REVERSAL', TRUE, 'NONE', TRUE, 5),
    ('00000000-0000-0000-0000-000000000000', 'CANCELLED_IN_ERROR', 'Cancelled in error', 'Cancellation was not authorised by the guest; booking reinstated.', 'REVERSAL', TRUE, 'NONE', TRUE, 6),
    ('00000000-0000-0000-0000-000000000000', 'GUEST_REQUEST', 'Guest requested reversal', 'Guest asked for the change after the fact.', 'REVERSAL', TRUE, 'NONE', TRUE, 7),

    -- Night Audit Reasons
    ('00000000-0000-0000-0000-000000000000', 'NA_ARRIVALS_PENDING', 'Arrivals unresolved at roll', 'Audit run with arrivals still due in; they are carried to the next business date.', 'NIGHT_AUDIT', TRUE, 'NONE', TRUE, 1),
    ('00000000-0000-0000-0000-000000000000', 'NA_DEPARTURES_PENDING', 'Departures unresolved at roll', 'Audit run with in-house guests past their departure date.', 'NIGHT_AUDIT', TRUE, 'NONE', TRUE, 2),
    ('00000000-0000-0000-0000-000000000000', 'NA_FOLIOS_UNBALANCED', 'Folios unbalanced at roll', 'Audit run over open folios that do not balance; variance is carried forward.', 'NIGHT_AUDIT', TRUE, 'NONE', TRUE, 3),
    ('00000000-0000-0000-0000-000000000000', 'NA_SYSTEM_RECOVERY', 'System recovery', 'Audit re-run after an outage or failed run; preconditions already assessed.', 'NIGHT_AUDIT', TRUE, 'NONE', FALSE, 4),

    -- Blacklist Reasons
    ('00000000-0000-0000-0000-000000000000', 'BL_GM_CLEARED', 'Blacklist cleared by the GM', 'The general manager has personally authorised this booking despite the listing.', 'BLACKLIST', TRUE, 'GM', FALSE, 1),
    ('00000000-0000-0000-0000-000000000000', 'BL_LISTING_DISPUTED', 'Listing disputed, under review', 'The guest contests the listing and it is being reviewed; the booking is taken meanwhile.', 'BLACKLIST', TRUE, 'MANAGER', FALSE, 2),
    ('00000000-0000-0000-0000-000000000000', 'BL_WRONG_PROFILE', 'Listing belongs to another profile', 'A duplicate or mismatched guest profile carries the listing; merge is pending.', 'BLACKLIST', TRUE, 'MANAGER', FALSE, 3),

    -- Credit Limit Reasons
    ('00000000-0000-0000-0000-000000000000', 'CL_COMPANY_GUARANTEED', 'Guaranteed by the company account', 'The balance is guaranteed by a corporate account in good standing.', 'CREDIT_LIMIT', TRUE, 'MANAGER', TRUE, 1),
    ('00000000-0000-0000-0000-000000000000', 'CL_LIMIT_UNDER_REVIEW', 'Limit under review', 'A credit review is in progress and the configured limit is known to be stale.', 'CREDIT_LIMIT', TRUE, 'MANAGER', TRUE, 2),
    ('00000000-0000-0000-0000-000000000000', 'CL_DIRECTOR_AUTHORIZED', 'Authorised by the director of finance', 'Exposure beyond the configured limit accepted on the finance director''s authority.', 'CREDIT_LIMIT', TRUE, 'DIRECTOR', TRUE, 3),

    -- Write-Off Reasons
    ('00000000-0000-0000-0000-000000000000', 'WO_BAD_DEBT', 'Uncollectable bad debt', 'Collection attempts are exhausted and the balance is written off to bad debt expense.', 'WRITE_OFF', TRUE, 'DIRECTOR', TRUE, 1),
    ('00000000-0000-0000-0000-000000000000', 'WO_SMALL_BALANCE', 'Small balance below the collection floor', 'The residual costs more to pursue than it is worth; cleared to keep the ledger honest.', 'WRITE_OFF', TRUE, 'MANAGER', TRUE, 2),
    ('00000000-0000-0000-0000-000000000000', 'WO_DISPUTE_SETTLED', 'Settled dispute', 'The guest or company disputed the charge and a settlement was agreed below the balance.', 'WRITE_OFF', TRUE, 'MANAGER', TRUE, 3),
    ('00000000-0000-0000-0000-000000000000', 'WO_GOODWILL', 'Goodwill', 'Balance forgiven to keep a relationship the property values more than the amount.', 'WRITE_OFF', TRUE, 'DIRECTOR', TRUE, 4),
    ('00000000-0000-0000-0000-000000000000', 'WO_INSOLVENCY', 'Debtor insolvent', 'The debtor has entered administration or bankruptcy and the claim will not be met.', 'WRITE_OFF', TRUE, 'GM', TRUE, 5),
    ('00000000-0000-0000-0000-000000000000', 'WO_BILLING_ERROR', 'Billing error', 'The balance should never have been raised; written off rather than pursued.', 'WRITE_OFF', TRUE, 'MANAGER', TRUE, 6),

    -- Check-in overrides. A forced reservation.check_in bypasses two declared
    -- gates -- reservation_status_check and deposit_required_check -- and the
    -- payload carries one code, so the category is per command, not per gate.
    ('00000000-0000-0000-0000-000000000000', 'CI_CORP_ACCOUNT',   'Corporate account',      'The stay is guaranteed by a corporate account in good standing.',            'CHECK_IN_OVERRIDE',  FALSE, 'NONE',       FALSE, 1),
    ('00000000-0000-0000-0000-000000000000', 'CI_PAYMENT_PENDING','Payment not yet posted', 'Payment was taken but has not settled against the deposit schedule.',       'CHECK_IN_OVERRIDE',  FALSE, 'SUPERVISOR', FALSE, 2),
    ('00000000-0000-0000-0000-000000000000', 'CI_GUEST_ARRIVED',  'Guest arrived late',     'The guest arrived after a no-show was recorded; the booking is reinstated.', 'CHECK_IN_OVERRIDE',  FALSE, 'SUPERVISOR', FALSE, 3),
    ('00000000-0000-0000-0000-000000000000', 'CI_DEPOSIT_WAIVED', 'Deposit waived',         'The front office manager waived the deposit for this arrival.',             'CHECK_IN_OVERRIDE',  TRUE,  'MANAGER',    TRUE,  4),
    ('00000000-0000-0000-0000-000000000000', 'CI_VIP',            'VIP arrival',            'Arrival cleared by management despite the outstanding requirement.',        'CHECK_IN_OVERRIDE',  TRUE,  'DIRECTOR',   TRUE,  5),

    -- Check-out overrides. Forcing check-out leaves the folio unsettled and
    -- transfers the balance to city-ledger AR, so it is a credit decision.
    ('00000000-0000-0000-0000-000000000000', 'CO_TO_CITY_LEDGER', 'Billed to company',      'The balance is billed to an approved company account.',                     'CHECK_OUT_OVERRIDE', FALSE, 'NONE',       TRUE,  1),
    ('00000000-0000-0000-0000-000000000000', 'CO_LATE_DEPARTURE', 'Departed before settle', 'The guest departed before the folio could be settled at the desk.',         'CHECK_OUT_OVERRIDE', FALSE, 'SUPERVISOR', TRUE,  2),
    ('00000000-0000-0000-0000-000000000000', 'CO_DISPUTE_OPEN',   'Charge disputed',        'A charge is disputed and the balance is held pending review.',              'CHECK_OUT_OVERRIDE', TRUE,  'MANAGER',    TRUE,  3),
    ('00000000-0000-0000-0000-000000000000', 'CO_GOODWILL',       'Carried as goodwill',    'Management carried the balance rather than pursue it at departure.',        'CHECK_OUT_OVERRIDE', TRUE,  'DIRECTOR',   TRUE,  4)
ON CONFLICT DO NOTHING;

\echo 'reason_codes table created successfully!'
