-- =====================================================
-- 81_ab_test_results_indexes.sql
-- Ab Test Results Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating ab_test_results indexes...'

CREATE INDEX idx_ab_test_results_tenant ON ab_test_results(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ab_test_results_property ON ab_test_results(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ab_test_results_category ON ab_test_results(test_category) WHERE is_deleted = FALSE;
CREATE INDEX idx_ab_test_results_status ON ab_test_results(test_status) WHERE is_deleted = FALSE;

\echo 'Ab Test Results indexes created successfully!'
