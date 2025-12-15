-- =====================================================
-- 100_rate_plan_fallback_audit.sql
-- Tracks automatic BAR/RACK fallback decisions for reservation pricing
-- Date: 2025-12-15
-- Notes: Enables deterministic auditing + replay tooling for pricing overrides
-- =====================================================

\c tartware \echo 'Creating rate_plan_fallback_audit table...'

CREATE TABLE IF NOT EXISTS rate_plan_fallback_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES room_types (id) ON DELETE CASCADE,
    reservation_id UUID,
    correlation_id UUID NOT NULL,
    requested_rate_code VARCHAR(50),
    applied_rate_code VARCHAR(50) NOT NULL,
    fallback_reason TEXT,
    actor VARCHAR(150) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE rate_plan_fallback_audit IS 'Audit log for automatic rate plan fallback enforcement (BAR/RACK).';
COMMENT ON COLUMN rate_plan_fallback_audit.requested_rate_code IS 'Original rate code supplied by partner/system.';
COMMENT ON COLUMN rate_plan_fallback_audit.applied_rate_code IS 'Fallback code applied (BAR/RACK).';
COMMENT ON COLUMN rate_plan_fallback_audit.metadata IS 'Contextual payload (stay dates, reason, actor).';

CREATE INDEX IF NOT EXISTS idx_fallback_tenant_created
    ON rate_plan_fallback_audit (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fallback_property_created
    ON rate_plan_fallback_audit (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fallback_correlation
    ON rate_plan_fallback_audit (correlation_id);

\echo 'rate_plan_fallback_audit table created.'
