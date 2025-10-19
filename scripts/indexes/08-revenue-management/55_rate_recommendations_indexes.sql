-- =====================================================
-- 55_rate_recommendations_indexes.sql
-- Rate Recommendations Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating rate_recommendations indexes...'

CREATE INDEX idx_rate_recommendations_tenant ON rate_recommendations(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_property ON rate_recommendations(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_date ON rate_recommendations(recommendation_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_room_type ON rate_recommendations(room_type_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_rate_plan ON rate_recommendations(rate_plan_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_action ON rate_recommendations(recommendation_action) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_status ON rate_recommendations(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_pending ON rate_recommendations(status) WHERE status = 'pending' AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_urgency ON rate_recommendations(urgency) WHERE urgency IN ('high', 'critical') AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_confidence ON rate_recommendations(confidence_score DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_accepted ON rate_recommendations(accepted) WHERE accepted = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_implemented ON rate_recommendations(implemented) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_expired ON rate_recommendations(is_expired) WHERE is_expired = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_valid_until ON rate_recommendations(valid_until) WHERE is_expired = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_auto_apply ON rate_recommendations(auto_apply_eligible, auto_applied) WHERE auto_apply_eligible = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_model ON rate_recommendations(model_version, model_algorithm) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_effectiveness ON rate_recommendations(was_recommendation_effective, effectiveness_score) WHERE was_recommendation_effective IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_contributing_factors ON rate_recommendations USING gin(contributing_factors) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_metadata ON rate_recommendations USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_tags ON rate_recommendations USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_rate_recommendations_property_date ON rate_recommendations(property_id, recommendation_date, status) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_property_pending ON rate_recommendations(property_id, status, urgency DESC, confidence_score DESC) WHERE status = 'pending' AND is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_room_date ON rate_recommendations(room_type_id, recommendation_date, status) WHERE is_deleted = FALSE;
CREATE INDEX idx_rate_recommendations_property_room_date ON rate_recommendations(property_id, room_type_id, recommendation_date) WHERE is_deleted = FALSE;

\echo 'Rate Recommendations indexes created successfully!'
