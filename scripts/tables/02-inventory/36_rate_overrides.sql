-- =====================================================
-- 36_rate_overrides.sql
-- Manual Rate Adjustments & Overrides
--
-- Purpose: Track manual rate changes and special pricing
-- Industry Standard: OPERA (RATE_OVERRIDE), Cloudbeds (rate_adjustments),
--                    Protel (PREISANPASSUNG), RMS (rate_exception)
--
-- Use Cases:
-- - Manager discretionary discounts
-- - VIP pricing
-- - Service recovery pricing
-- - Price matching
-- - Special circumstances pricing
--
-- Provides audit trail for pricing exceptions
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS rate_overrides CASCADE;

CREATE TABLE rate_overrides (
    -- Primary Key
    override_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique override identifier

-- Multi-tenancy
tenant_id UUID NOT NULL, -- FK tenants.id
property_id UUID NOT NULL, -- FK properties.id

-- Association
reservation_id UUID NOT NULL, -- FK reservations.id
room_type_id UUID, -- Optional FK room_types.id for room-type-specific overrides
rate_plan_id UUID, -- Optional FK rates.id to record original plan

-- Override Information
override_code VARCHAR(50), -- Human-readable reference code
override_type VARCHAR(30) NOT NULL -- Category describing override intent
CHECK (
    override_type IN (
        'DISCOUNT',
        'PREMIUM',
        'FIXED_RATE',
        'COMPLIMENTARY',
        'PRICE_MATCH',
        'NEGOTIATED',
        'RECOVERY',
        'ERROR_CORRECTION'
    )
),

-- Original Rate
original_rate DECIMAL(10, 2) NOT NULL, -- Original nightly rate before override
original_rate_plan VARCHAR(100), -- Name/code of original rate plan
original_total DECIMAL(12, 2), -- Original total for stay period

-- Override Rate
override_rate DECIMAL(10, 2) NOT NULL, -- Adjusted nightly rate
override_total DECIMAL(12, 2), -- Adjusted total for stay period

-- Adjustment
adjustment_amount DECIMAL(10, 2), -- Difference (positive = increase, negative = decrease)
adjustment_percentage DECIMAL(5, 2), -- Percentage change applied
is_increase BOOLEAN, -- TRUE when override raises the rate
is_decrease BOOLEAN, -- TRUE when override lowers the rate

-- Dates Affected
stay_date DATE, -- Single night affected (optional)
start_date DATE, -- Start date for multi-night overrides
end_date DATE, -- End date for multi-night overrides
number_of_nights INTEGER, -- Count of nights covered by override

-- Reason
reason_category VARCHAR(50) NOT NULL -- Categorical reason for audit/reporting
CHECK (
    reason_category IN (
        'VIP',
        'MANAGER_DISCRETION',
        'SERVICE_RECOVERY',
        'PRICE_MATCH',
        'LOYALTY_REWARD',
        'GROUP_RATE',
        'LONG_STAY',
        'LAST_MINUTE',
        'EARLY_BOOKING',
        'REPEAT_GUEST',
        'ERROR_CORRECTION',
        'NEGOTIATED',
        'COMPLIMENTARY',
        'OTHER'
    )
),
reason_code VARCHAR(50), -- Fine-grained lookup code
reason_description TEXT NOT NULL, -- Free-text explanation

-- Approval
approval_required BOOLEAN DEFAULT TRUE, -- Flag indicating managerial approval needed
approval_threshold DECIMAL(10, 2), -- Financial threshold triggering approval
approval_level INTEGER, -- Required approval tier/role
requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Time override was requested
requested_by UUID NOT NULL, -- User initiating request
approved_at TIMESTAMP, -- Approval timestamp
approved_by UUID, -- Approver identifier
approval_notes TEXT, -- Comments from approver
rejected_at TIMESTAMP, -- Rejection timestamp
rejected_by UUID, -- Rejecting manager
rejection_reason TEXT, -- Explanation for rejection

-- Status
override_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' -- Workflow state
CHECK (
    override_status IN (
        'PENDING',
        'APPROVED',
        'APPLIED',
        'REJECTED',
        'CANCELLED',
        'EXPIRED'
    )
),

-- Application
applied_at TIMESTAMP, -- Timestamp when override impacted pricing
applied_by UUID, -- User/system that applied the override
is_applied BOOLEAN DEFAULT FALSE, -- Boolean convenience flag

-- Limits
max_override_amount DECIMAL(10, 2), -- Safety limit for override amount
min_rate_allowed DECIMAL(10, 2), -- Floor price guardrail

-- Competitor Information (for price matching)
competitor_name VARCHAR(200), -- Competitor referenced
competitor_rate DECIMAL(10, 2), -- Competitor quoted price
competitor_url VARCHAR(500), -- Proof link/screenshot
price_match_verified BOOLEAN DEFAULT FALSE, -- Indicates validation performed
verified_by UUID, -- User who verified price match

-- Guest Information
guest_id UUID, -- FK guests.id (if applicable)
guest_tier VARCHAR(30), -- Loyalty tier or VIP level
is_repeat_guest BOOLEAN DEFAULT FALSE, -- Repeat guest indicator
lifetime_value DECIMAL(12, 2), -- Guest lifetime revenue for context

-- Market Context
market_segment_id UUID, -- FK market segment (for analytics)
booking_source_id UUID, -- FK booking source/channel

-- Restrictions
is_commissionable BOOLEAN DEFAULT TRUE, -- Whether commission should be paid
is_refundable BOOLEAN DEFAULT TRUE, -- Override can be refunded
requires_prepayment BOOLEAN DEFAULT FALSE, -- Forces prepayment collection

-- Financial Impact
revenue_impact DECIMAL(12, 2), -- Net revenue change from override
cost_center VARCHAR(50), -- Financial reporting allocation
authorization_code VARCHAR(50), -- Approval/authorization reference

-- Validity
valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When override becomes effective
valid_until TIMESTAMP, -- When override expires automatically
is_expired BOOLEAN DEFAULT FALSE, -- Quick check flag

-- Recurrence
is_recurring BOOLEAN DEFAULT FALSE, -- Applies to future stays automatically
applies_to_future_bookings BOOLEAN DEFAULT FALSE, -- Should affect not-yet-booked stays

-- Automation
is_automatic BOOLEAN DEFAULT FALSE, -- System-generated override flag
rule_id UUID, -- FK to automation rule when applicable

-- Quality Checks
requires_review BOOLEAN DEFAULT FALSE, -- Flag for QA review queue
reviewed_at TIMESTAMP, -- QA review timestamp
reviewed_by UUID, -- Reviewer identifier

-- Compliance
complies_with_policy BOOLEAN DEFAULT TRUE, -- Indicates policy compliance
policy_exception_notes TEXT, -- Details for exceptions

-- Communication
guest_notified BOOLEAN DEFAULT FALSE, -- Whether guest was informed
notification_sent_at TIMESTAMP, -- Notification timestamp

-- Metadata
metadata JSONB, -- Extension payload for downstream systems

-- Notes
notes TEXT, -- Visible notes
internal_notes TEXT, -- Internal-only notes

-- Soft delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP, -- Soft delete timestamp
deleted_by UUID, -- User who deleted

-- Audit trail
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Record creation timestamp
created_by UUID, -- Creator identifier
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
updated_by UUID, -- Modifier identifier

-- Constraints
CONSTRAINT uk_rate_overrides_code UNIQUE (
    tenant_id,
    property_id,
    override_code
), -- Unique override code per property

-- Adjustment amount calculation
CONSTRAINT chk_rate_overrides_adjustment CHECK (
    adjustment_amount IS NULL
    OR -- If adjustment amount is provided
    adjustment_amount = override_rate - original_rate -- Ensure correct calculation
),

-- Approved status requires approval info
CONSTRAINT chk_rate_overrides_approval CHECK (
    override_status NOT IN ('APPROVED', 'APPLIED')
    OR (
        approved_at IS NOT NULL
        AND approved_by IS NOT NULL
    ) -- Approval info required for approved status
),

-- Applied status requires application timestamp
CONSTRAINT chk_rate_overrides_applied CHECK (
    is_applied = FALSE
    OR -- If marked as applied
    applied_at IS NOT NULL -- Application timestamp required when applied
),

-- Date range validation
CONSTRAINT chk_rate_overrides_dates CHECK (
    start_date IS NULL
    OR -- If start date is provided
    end_date IS NULL
    OR -- If end date is provided
    end_date >= start_date -- Ensure end date is not before start date
),

-- Percentage validation
CONSTRAINT chk_rate_overrides_percentage
        CHECK (
            adjustment_percentage IS NULL OR -- If adjustment percentage is provided
            adjustment_percentage >= -100 -- Ensure percentage is not less than -100%
        )
);

-- Add table comment
COMMENT ON TABLE rate_overrides IS 'Manual rate adjustments and pricing exceptions. Tracks discounts, premiums, VIP pricing, and service recovery with approval workflow.';

-- Add column comments
COMMENT ON COLUMN rate_overrides.override_type IS 'DISCOUNT, PREMIUM, FIXED_RATE, COMPLIMENTARY, PRICE_MATCH, NEGOTIATED, RECOVERY, ERROR_CORRECTION';

COMMENT ON COLUMN rate_overrides.reason_category IS 'VIP, MANAGER_DISCRETION, SERVICE_RECOVERY, PRICE_MATCH, LOYALTY_REWARD, GROUP_RATE, etc.';

COMMENT ON COLUMN rate_overrides.adjustment_amount IS 'Difference: override_rate - original_rate (positive = increase, negative = decrease)';

COMMENT ON COLUMN rate_overrides.adjustment_percentage IS 'Percentage change in rate';

COMMENT ON COLUMN rate_overrides.approval_threshold IS 'If override amount exceeds this, approval required';

COMMENT ON COLUMN rate_overrides.competitor_rate IS 'Competitor price for price matching';

COMMENT ON COLUMN rate_overrides.revenue_impact IS 'Financial impact: negative = lost revenue, positive = gained revenue';

COMMENT ON COLUMN rate_overrides.is_recurring IS 'If TRUE, applies to all future bookings for this guest';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_rate_overrides_tenant ON rate_overrides(tenant_id, property_id, requested_at DESC);
-- CREATE INDEX idx_rate_overrides_reservation ON rate_overrides(reservation_id, stay_date);
-- CREATE INDEX idx_rate_overrides_status ON rate_overrides(property_id, override_status, requested_at DESC);
-- Create partial unique index for active override codes
CREATE UNIQUE INDEX idx_uk_rate_overrides_code_active ON rate_overrides (
    tenant_id,
    property_id,
    override_code
)
WHERE
    deleted_at IS NULL
    AND override_code IS NOT NULL;

-- CREATE INDEX idx_rate_overrides_approval ON rate_overrides(property_id, approval_required) WHERE approval_required = TRUE AND override_status = 'PENDING';
-- CREATE INDEX idx_rate_overrides_reason ON rate_overrides(reason_category, requested_at DESC);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON rate_overrides TO tartware_app;

-- Success message
\echo '✓ Table created: rate_overrides (36/37)'
\echo '  - Manual rate adjustments'
\echo '  - Approval workflow'
\echo '  - Price matching'
\echo ''
