-- =====================================================
-- 78_guest_journey_tracking_indexes.sql
-- Guest Journey Tracking Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating guest_journey_tracking indexes...'

-- =====================================================
-- BASIC INDEXES
-- =====================================================

-- Multi-tenancy indexes
CREATE INDEX idx_guest_journey_tracking_tenant ON guest_journey_tracking(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_property ON guest_journey_tracking(property_id) WHERE is_deleted = FALSE;

-- Foreign key indexes
CREATE INDEX idx_guest_journey_tracking_guest ON guest_journey_tracking(guest_id) WHERE is_deleted = FALSE;

-- Journey tracking indexes
CREATE INDEX idx_guest_journey_tracking_type ON guest_journey_tracking(journey_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_status ON guest_journey_tracking(journey_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_converted ON guest_journey_tracking(converted) WHERE is_deleted = FALSE;

-- =====================================================
-- JSONB GIN INDEXES
-- =====================================================

CREATE INDEX idx_guest_journey_tracking_touchpoints ON guest_journey_tracking USING gin(touchpoints) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_journey_tracking_metadata ON guest_journey_tracking USING gin(metadata) WHERE is_deleted = FALSE;

\echo 'Guest Journey Tracking indexes created successfully!'
