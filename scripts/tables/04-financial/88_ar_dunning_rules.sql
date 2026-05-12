-- =====================================================
-- 88_ar_dunning_rules.sql
-- AR Dunning Rules Configuration Table
-- Industry Standard: USALI 12th Edition §11.4
-- Pattern: Reference data — per-tenant escalation config
-- Date: 2025-01-01
-- =====================================================

-- =====================================================
-- AR_DUNNING_RULES TABLE
-- Configurable dunning escalation path per tenant/property.
-- Each row defines the action taken when an AR account enters
-- a specific aging bucket.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ar_dunning_rules (
    rule_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Unique rule identifier
    tenant_id           UUID NOT NULL REFERENCES public.tenants(id),  -- Tenant scope
    property_id         UUID,                                         -- NULL = applies to all properties

    -- Bucket threshold
    bucket_name         VARCHAR(10) NOT NULL,                         -- CURRENT | 30 | 60 | 90 | 90+
    min_days_overdue    INTEGER NOT NULL DEFAULT 0,                   -- Minimum days past due to trigger
    max_days_overdue    INTEGER,                                      -- Upper bound (NULL = unbounded)

    -- Action configuration
    action_type         VARCHAR(30) NOT NULL                          -- EMAIL | STATEMENT | FORMAL_NOTICE | COLLECTIONS
        CHECK (action_type IN ('EMAIL', 'STATEMENT', 'FORMAL_NOTICE', 'COLLECTIONS')),
    template_code       VARCHAR(50) NOT NULL,                         -- Notification template code
    delay_days          INTEGER NOT NULL DEFAULT 0,                   -- Days to wait after entering bucket before firing
    max_attempts        INTEGER NOT NULL DEFAULT 3,                   -- Max dunning attempts per bucket

    -- Thresholds
    min_amount          NUMERIC(15, 2) NOT NULL DEFAULT 0.00,        -- Skip dunning if outstanding < this
    escalation_order    INTEGER NOT NULL DEFAULT 1,                   -- Ordering within same bucket (lower = earlier)

    -- Status
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,                -- Enable/disable without deleting

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID,
    updated_by          UUID
);

-- Unique: one rule per tenant/property/bucket/action.
-- Two partial indexes are used to correctly handle NULL property_id (PostgreSQL treats NULLs as distinct in normal UNIQUE constraints).
CREATE UNIQUE INDEX IF NOT EXISTS uq_dunning_rules_property_bucket
    ON public.ar_dunning_rules (tenant_id, property_id, bucket_name, action_type)
    WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dunning_rules_tenant_default_bucket
    ON public.ar_dunning_rules (tenant_id, bucket_name, action_type)
    WHERE property_id IS NULL;

COMMENT ON TABLE ar_dunning_rules IS 'Configurable dunning escalation rules per aging bucket. Drives automated collection reminders via notification service.';
COMMENT ON COLUMN ar_dunning_rules.bucket_name IS 'Aging bucket identifier: CURRENT, 30, 60, 90, or 90+. Maps to days-past-due ranges.';
COMMENT ON COLUMN ar_dunning_rules.action_type IS 'Dunning action: EMAIL (reminder), STATEMENT (formal), FORMAL_NOTICE (legal demand), COLLECTIONS (handoff).';
COMMENT ON COLUMN ar_dunning_rules.template_code IS 'Notification template code used by notification-service for outbound communication.';
COMMENT ON COLUMN ar_dunning_rules.delay_days IS 'Grace period in days after entering the bucket before the dunning action fires.';
COMMENT ON COLUMN ar_dunning_rules.min_amount IS 'Minimum outstanding amount to trigger this rule. Prevents dunning for trivial balances.';
COMMENT ON COLUMN ar_dunning_rules.escalation_order IS 'Order of execution within the same bucket (1 = first). Enables multi-step escalation per bucket.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ar_dunning_rules_tenant
    ON public.ar_dunning_rules (tenant_id, is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_ar_dunning_rules_bucket
    ON public.ar_dunning_rules (tenant_id, bucket_name, escalation_order)
    WHERE is_active = TRUE;

-- Default dunning rules are seeded per-tenant during onboarding.
-- No system-wide defaults inserted here since tenant_id is NOT NULL.

\echo 'ar_dunning_rules table created successfully!'
