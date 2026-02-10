-- =====================================================
-- revenue_attribution.sql
-- Revenue Attribution Table
-- Industry Standard: Marketing attribution analytics
-- Pattern: Track revenue attribution to marketing channels and campaigns
-- Date: 2025-10-17
-- =====================================================
-- Purpose: Track revenue attribution to marketing channels and campaigns
-- Key Features:
--   - Multi-touch attribution
--   - Channel effectiveness
--   - Campaign ROI
--   - Marketing analytics
-- =====================================================

-- =====================================================
-- REVENUE_ATTRIBUTION TABLE
-- Tracks revenue attribution to marketing channels and campaigns
-- =====================================================

CREATE TABLE IF NOT EXISTS revenue_attribution (
    -- Primary Key
    attribution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Foreign Keys
    reservation_id UUID NOT NULL,
    guest_id UUID NOT NULL,

    -- Attribution Details
    touchpoint_sequence INTEGER NOT NULL,
    channel_type VARCHAR(100) NOT NULL,
    campaign_id UUID,
    attribution_weight DECIMAL(5,4) DEFAULT 1.0,
    attributed_revenue DECIMAL(12, 2) NOT NULL DEFAULT 0.00,

    -- Timestamps
    touchpoint_date TIMESTAMP NOT NULL,
    conversion_date TIMESTAMP,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

COMMENT ON TABLE revenue_attribution IS 'Tracks revenue attribution across marketing touchpoints';

COMMENT ON COLUMN revenue_attribution.attribution_id IS 'Unique identifier for the attribution record';
COMMENT ON COLUMN revenue_attribution.tenant_id IS 'Tenant owning this attribution record';
COMMENT ON COLUMN revenue_attribution.property_id IS 'Property where the revenue was generated';
COMMENT ON COLUMN revenue_attribution.reservation_id IS 'Reservation that produced the attributed revenue';
COMMENT ON COLUMN revenue_attribution.guest_id IS 'Guest associated with the revenue';
COMMENT ON COLUMN revenue_attribution.touchpoint_sequence IS 'Order of this touchpoint in the multi-touch attribution chain';
COMMENT ON COLUMN revenue_attribution.channel_type IS 'Marketing channel (e.g. organic, paid_search, email, OTA)';
COMMENT ON COLUMN revenue_attribution.campaign_id IS 'Marketing campaign that generated this touchpoint';
COMMENT ON COLUMN revenue_attribution.attribution_weight IS 'Fractional weight assigned to this touchpoint (0.0–1.0)';
COMMENT ON COLUMN revenue_attribution.attributed_revenue IS 'Dollar amount of revenue attributed to this touchpoint';
COMMENT ON COLUMN revenue_attribution.touchpoint_date IS 'When the marketing touchpoint occurred';
COMMENT ON COLUMN revenue_attribution.conversion_date IS 'When the guest converted to a booking';
COMMENT ON COLUMN revenue_attribution.version IS 'Optimistic locking version for concurrent update safety';

\echo 'revenue_attribution table created successfully!'
