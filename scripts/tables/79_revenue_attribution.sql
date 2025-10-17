-- =====================================================
-- Revenue Attribution Table
-- =====================================================

CREATE TABLE IF NOT EXISTS revenue_attribution (
    attribution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    reservation_id UUID NOT NULL,
    revenue_amount DECIMAL(12,2) NOT NULL,

    attribution_model VARCHAR(100) CHECK (attribution_model IN ('first_touch', 'last_touch', 'linear', 'time_decay', 'position_based')),

    touchpoints JSONB,
    attribution_weights JSONB,

    primary_channel VARCHAR(100),
    primary_campaign_id UUID,

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

CREATE INDEX idx_revenue_attribution_tenant ON revenue_attribution(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_attribution_property ON revenue_attribution(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_attribution_reservation ON revenue_attribution(reservation_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_attribution_campaign ON revenue_attribution(primary_campaign_id) WHERE is_deleted = FALSE;

COMMENT ON TABLE revenue_attribution IS 'Tracks revenue attribution across marketing touchpoints';
