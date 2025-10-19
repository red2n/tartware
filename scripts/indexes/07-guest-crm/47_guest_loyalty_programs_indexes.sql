-- =====================================================
-- 47_guest_loyalty_programs_indexes.sql
-- Guest Loyalty Programs Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating guest_loyalty_programs indexes...'

CREATE INDEX idx_guest_loyalty_programs_tenant ON guest_loyalty_programs(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_property ON guest_loyalty_programs(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_guest ON guest_loyalty_programs(guest_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_membership ON guest_loyalty_programs(membership_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_tier ON guest_loyalty_programs(program_tier) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_status ON guest_loyalty_programs(membership_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_active ON guest_loyalty_programs(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_points ON guest_loyalty_programs(points_balance) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_expiry ON guest_loyalty_programs(points_expiry_date) WHERE points_expiry_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_tier_expiry ON guest_loyalty_programs(tier_expiry_date) WHERE tier_expiry_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_enrollment ON guest_loyalty_programs(enrollment_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_last_activity ON guest_loyalty_programs(last_activity_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_benefits ON guest_loyalty_programs USING gin(benefits) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_preferences ON guest_loyalty_programs USING gin(preferences) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_metadata ON guest_loyalty_programs USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_tags ON guest_loyalty_programs USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_guest_loyalty_programs_tenant_tier ON guest_loyalty_programs(tenant_id, program_tier) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_guest_active ON guest_loyalty_programs(guest_id, is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_guest_loyalty_programs_property_tier ON guest_loyalty_programs(property_id, program_tier, points_balance DESC) WHERE is_deleted = FALSE;

\echo 'Guest Loyalty Programs indexes created successfully!'
