-- Foreign key constraints for revenue_goals table

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_action_plan_owner
    FOREIGN KEY (action_plan_owner) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_responsible_user
    FOREIGN KEY (responsible_user_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_revised_by
    FOREIGN KEY (revised_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_original_goal
    FOREIGN KEY (original_goal_id) REFERENCES revenue_goals(goal_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE revenue_goals
    ADD CONSTRAINT fk_revenue_goals_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
