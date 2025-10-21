-- =============================================
-- Indexes for 97_sentiment_analysis
-- =============================================

CREATE INDEX idx_sentiment_analysis_tenant ON sentiment_analysis(tenant_id);
CREATE INDEX idx_sentiment_analysis_property ON sentiment_analysis(property_id);
CREATE INDEX idx_sentiment_analysis_guest ON sentiment_analysis(guest_id);
CREATE INDEX idx_sentiment_analysis_reservation ON sentiment_analysis(reservation_id);
CREATE INDEX idx_sentiment_analysis_sentiment ON sentiment_analysis(overall_sentiment);
CREATE INDEX idx_sentiment_analysis_score ON sentiment_analysis(sentiment_score DESC);
CREATE INDEX idx_sentiment_analysis_urgency ON sentiment_analysis(urgency_level) WHERE requires_immediate_action = TRUE;
CREATE INDEX idx_sentiment_analysis_source ON sentiment_analysis(source_type, source_platform);
CREATE INDEX idx_sentiment_analysis_date ON sentiment_analysis(review_date DESC);
CREATE INDEX idx_sentiment_analysis_nps ON sentiment_analysis(nps_category);
CREATE INDEX idx_sentiment_analysis_unresolved ON sentiment_analysis(issue_resolved) WHERE requires_response = TRUE AND issue_resolved = FALSE;
CREATE INDEX idx_sentiment_trends_property ON sentiment_trends(property_id);
CREATE INDEX idx_sentiment_trends_period ON sentiment_trends(period_start_date, period_end_date);
CREATE INDEX idx_sentiment_trends_score ON sentiment_trends(average_sentiment_score DESC);
CREATE INDEX idx_review_response_templates_tenant ON review_response_templates(tenant_id) WHERE is_active = TRUE;
CREATE INDEX idx_review_response_templates_sentiment ON review_response_templates(sentiment_type);
