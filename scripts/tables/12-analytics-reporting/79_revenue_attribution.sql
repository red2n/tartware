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


COMMENT ON TABLE revenue_attribution IS 'Tracks revenue attribution across marketing touchpoints';
