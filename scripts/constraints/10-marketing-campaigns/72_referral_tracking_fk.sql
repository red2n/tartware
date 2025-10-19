-- Foreign Key Constraints for referral_tracking table

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_referee
    FOREIGN KEY (referee_id) REFERENCES guests(guest_id)
    ON DELETE SET NULL;

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON DELETE SET NULL;

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_campaign
    FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(campaign_id)
    ON DELETE SET NULL;

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_parent
    FOREIGN KEY (parent_referral_id) REFERENCES referral_tracking(referral_id)
    ON DELETE SET NULL;

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE referral_tracking
    ADD CONSTRAINT fk_referral_tracking_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
