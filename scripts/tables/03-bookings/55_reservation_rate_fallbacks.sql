-- =====================================================
-- reservation_rate_fallbacks.sql
-- Audit table for rate plan fallback decisions
-- Captures when requested rate codes are swapped to BAR/RACK
-- =====================================================

\c tartware \echo 'Creating reservation_rate_fallbacks table...'

CREATE TABLE IF NOT EXISTS reservation_rate_fallbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    property_id UUID NOT NULL,
    requested_rate_code VARCHAR(50),
    applied_rate_code VARCHAR(50) NOT NULL,
    reason VARCHAR(200),
    actor VARCHAR(150) NOT NULL,
    correlation_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE reservation_rate_fallbacks IS 'Audit log for reservation rate fallback/override decisions';
COMMENT ON COLUMN reservation_rate_fallbacks.requested_rate_code IS 'Rate code originally requested by external source';
COMMENT ON COLUMN reservation_rate_fallbacks.applied_rate_code IS 'Rate code ultimately applied (BAR/RACK/etc.)';
COMMENT ON COLUMN reservation_rate_fallbacks.reason IS 'Free-form explanation for why fallback occurred';
COMMENT ON COLUMN reservation_rate_fallbacks.actor IS 'Service or user that performed the fallback decision';

CREATE INDEX IF NOT EXISTS idx_rate_fallbacks_reservation
    ON reservation_rate_fallbacks (reservation_id);
CREATE INDEX IF NOT EXISTS idx_rate_fallbacks_tenant
    ON reservation_rate_fallbacks (tenant_id, created_at DESC);
