-- =====================================================
-- 79_revenue_attribution_indexes.sql
-- Revenue Attribution Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating revenue_attribution indexes...'

-- =====================================================
-- BASIC INDEXES
-- =====================================================

-- Multi-tenancy indexes
CREATE INDEX idx_revenue_attribution_tenant ON revenue_attribution(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_attribution_property ON revenue_attribution(property_id) WHERE is_deleted = FALSE;

-- Foreign key indexes
CREATE INDEX idx_revenue_attribution_reservation ON revenue_attribution(reservation_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_revenue_attribution_campaign ON revenue_attribution(campaign_id) WHERE is_deleted = FALSE;

\echo 'Revenue Attribution indexes created successfully!'
