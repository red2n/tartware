-- =============================================
-- Indexes for 96_guest_behavior_patterns
-- =============================================

CREATE INDEX idx_guest_behavior_patterns_tenant ON guest_behavior_patterns(tenant_id);
CREATE INDEX idx_guest_behavior_patterns_property ON guest_behavior_patterns(property_id);
CREATE INDEX idx_guest_behavior_patterns_guest ON guest_behavior_patterns(guest_id);
CREATE INDEX idx_guest_behavior_patterns_segment ON guest_behavior_patterns(customer_segment, value_segment);
CREATE INDEX idx_guest_behavior_patterns_churn ON guest_behavior_patterns(churn_risk_level) WHERE churn_risk_score > 50;
CREATE INDEX idx_guest_behavior_patterns_ltv ON guest_behavior_patterns(total_lifetime_value DESC);
CREATE INDEX idx_guest_behavior_patterns_date ON guest_behavior_patterns(analysis_date DESC);
CREATE INDEX idx_personalized_recommendations_guest ON personalized_recommendations(guest_id);
CREATE INDEX idx_personalized_recommendations_reservation ON personalized_recommendations(reservation_id);
CREATE INDEX idx_personalized_recommendations_type ON personalized_recommendations(recommendation_type);
CREATE INDEX idx_personalized_recommendations_action ON personalized_recommendations(guest_action);
CREATE INDEX idx_personalized_recommendations_converted ON personalized_recommendations(converted) WHERE converted = TRUE;
CREATE INDEX idx_personalized_recommendations_pending ON personalized_recommendations(guest_action) WHERE guest_action = 'pending';
CREATE INDEX idx_personalized_recommendations_timing ON personalized_recommendations(delivery_timing, presented_to_guest);
CREATE INDEX idx_guest_interaction_events_guest ON guest_interaction_events(guest_id);
CREATE INDEX idx_guest_interaction_events_type ON guest_interaction_events(event_type);
CREATE INDEX idx_guest_interaction_events_timestamp ON guest_interaction_events(event_timestamp DESC);
CREATE INDEX idx_guest_interaction_events_session ON guest_interaction_events(session_id);
CREATE INDEX idx_guest_interaction_events_source ON guest_interaction_events(event_source);
