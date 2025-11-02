-- Foreign key constraints for rate_recommendations table

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_room_type
    FOREIGN KEY (room_type_id) REFERENCES room_types(id)
    ON DELETE CASCADE;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_rate_plan
    FOREIGN KEY (rate_plan_id) REFERENCES rates(id)
    ON DELETE SET NULL;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_reviewed_by
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_accepted_by
    FOREIGN KEY (accepted_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_rejected_by
    FOREIGN KEY (rejected_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_implemented_by
    FOREIGN KEY (implemented_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_feedback_by
    FOREIGN KEY (feedback_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_superseded_by
    FOREIGN KEY (superseded_by) REFERENCES rate_recommendations(recommendation_id)
    ON DELETE SET NULL;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE rate_recommendations
    ADD CONSTRAINT fk_rate_recommendations_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
