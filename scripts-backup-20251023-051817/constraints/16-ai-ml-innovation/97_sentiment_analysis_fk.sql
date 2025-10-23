-- =============================================
-- Foreign Key Constraints for 97_sentiment_analysis
-- =============================================

ALTER TABLE sentiment_analysis ADD CONSTRAINT fk_sentiment_analysis_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sentiment_analysis ADD CONSTRAINT fk_sentiment_analysis_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE sentiment_analysis ADD CONSTRAINT fk_sentiment_analysis_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
ALTER TABLE sentiment_analysis ADD CONSTRAINT fk_sentiment_analysis_reservation_id FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE sentiment_analysis ADD CONSTRAINT fk_sentiment_analysis_feedback_id FOREIGN KEY (feedback_id) REFERENCES guest_feedback(id) ON DELETE CASCADE;
ALTER TABLE sentiment_analysis ADD CONSTRAINT fk_sentiment_analysis_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id);
ALTER TABLE sentiment_trends ADD CONSTRAINT fk_sentiment_trends_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE sentiment_trends ADD CONSTRAINT fk_sentiment_trends_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE sentiment_trends ADD CONSTRAINT fk_sentiment_trends_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE review_response_templates ADD CONSTRAINT fk_review_response_templates_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE review_response_templates ADD CONSTRAINT fk_review_response_templates_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE review_response_templates ADD CONSTRAINT fk_review_response_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE review_response_templates ADD CONSTRAINT fk_review_response_templates_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
