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
    override_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Association
    reservation_id UUID NOT NULL,
    room_type_id UUID,
    rate_plan_id UUID,

    -- Override Information
    override_code VARCHAR(50),
    override_type VARCHAR(30) NOT NULL
        CHECK (override_type IN ('DISCOUNT', 'PREMIUM', 'FIXED_RATE', 'COMPLIMENTARY', 'PRICE_MATCH', 'NEGOTIATED', 'RECOVERY', 'ERROR_CORRECTION')),

    -- Original Rate
    original_rate DECIMAL(10, 2) NOT NULL,
    original_rate_plan VARCHAR(100),
    original_total DECIMAL(12, 2),

    -- Override Rate
    override_rate DECIMAL(10, 2) NOT NULL,
    override_total DECIMAL(12, 2),

    -- Adjustment
    adjustment_amount DECIMAL(10, 2), -- Difference (positive or negative)
    adjustment_percentage DECIMAL(5, 2), -- % change
    is_increase BOOLEAN, -- TRUE if rate went up
    is_decrease BOOLEAN, -- TRUE if rate went down

    -- Dates Affected
    stay_date DATE, -- Specific date if single night
    start_date DATE, -- For multi-night overrides
    end_date DATE,
    number_of_nights INTEGER,

    -- Reason
    reason_category VARCHAR(50) NOT NULL
        CHECK (reason_category IN ('VIP', 'MANAGER_DISCRETION', 'SERVICE_RECOVERY', 'PRICE_MATCH', 'LOYALTY_REWARD', 'GROUP_RATE', 'LONG_STAY', 'LAST_MINUTE', 'EARLY_BOOKING', 'REPEAT_GUEST', 'ERROR_CORRECTION', 'NEGOTIATED', 'COMPLIMENTARY', 'OTHER')),
    reason_code VARCHAR(50),
    reason_description TEXT NOT NULL,

    -- Approval
    approval_required BOOLEAN DEFAULT TRUE,
    approval_threshold DECIMAL(10, 2), -- Amount requiring approval
    approval_level INTEGER, -- Manager level required

    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requested_by UUID NOT NULL,

    approved_at TIMESTAMP,
    approved_by UUID,
    approval_notes TEXT,

    rejected_at TIMESTAMP,
    rejected_by UUID,
    rejection_reason TEXT,

    -- Status
    override_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (override_status IN ('PENDING', 'APPROVED', 'APPLIED', 'REJECTED', 'CANCELLED', 'EXPIRED')),

    -- Application
    applied_at TIMESTAMP,
    applied_by UUID,
    is_applied BOOLEAN DEFAULT FALSE,

    -- Limits
    max_override_amount DECIMAL(10, 2), -- Maximum allowed override
    min_rate_allowed DECIMAL(10, 2), -- Cannot go below this

    -- Competitor Information (for price matching)
    competitor_name VARCHAR(200),
    competitor_rate DECIMAL(10, 2),
    competitor_url VARCHAR(500),
    price_match_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,

    -- Guest Information
    guest_id UUID,
    guest_tier VARCHAR(30), -- VIP level
    is_repeat_guest BOOLEAN DEFAULT FALSE,
    lifetime_value DECIMAL(12, 2),

    -- Market Context
    market_segment_id UUID,
    booking_source_id UUID,

    -- Restrictions
    is_commissionable BOOLEAN DEFAULT TRUE, -- Affects commissions
    is_refundable BOOLEAN DEFAULT TRUE,
    requires_prepayment BOOLEAN DEFAULT FALSE,

    -- Financial Impact
    revenue_impact DECIMAL(12, 2), -- Lost/gained revenue
    cost_center VARCHAR(50),
    authorization_code VARCHAR(50),

    -- Validity
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    is_expired BOOLEAN DEFAULT FALSE,

    -- Recurrence
    is_recurring BOOLEAN DEFAULT FALSE, -- Applies to all future stays
    applies_to_future_bookings BOOLEAN DEFAULT FALSE,

    -- Automation
    is_automatic BOOLEAN DEFAULT FALSE, -- System-generated
    rule_id UUID, -- If from automated rule

    -- Quality Checks
    requires_review BOOLEAN DEFAULT FALSE,
    reviewed_at TIMESTAMP,
    reviewed_by UUID,

    -- Compliance
    complies_with_policy BOOLEAN DEFAULT TRUE,
    policy_exception_notes TEXT,

    -- Communication
    guest_notified BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP,

    -- Metadata
    metadata JSONB,

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    CONSTRAINT uk_rate_overrides_code
        UNIQUE (tenant_id, property_id, override_code),

    -- Adjustment amount calculation
    CONSTRAINT chk_rate_overrides_adjustment
        CHECK (
            adjustment_amount IS NULL OR
            adjustment_amount = override_rate - original_rate
        ),

    -- Approved status requires approval info
    CONSTRAINT chk_rate_overrides_approval
        CHECK (
            override_status NOT IN ('APPROVED', 'APPLIED') OR
            (approved_at IS NOT NULL AND approved_by IS NOT NULL)
        ),

    -- Applied status requires application timestamp
    CONSTRAINT chk_rate_overrides_applied
        CHECK (
            is_applied = FALSE OR
            applied_at IS NOT NULL
        ),

    -- Date range validation
    CONSTRAINT chk_rate_overrides_dates
        CHECK (
            start_date IS NULL OR
            end_date IS NULL OR
            end_date >= start_date
        ),

    -- Percentage validation
    CONSTRAINT chk_rate_overrides_percentage
        CHECK (
            adjustment_percentage IS NULL OR
            adjustment_percentage >= -100
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
CREATE UNIQUE INDEX idx_uk_rate_overrides_code_active
    ON rate_overrides(tenant_id, property_id, override_code)
    WHERE deleted_at IS NULL AND override_code IS NOT NULL;

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
