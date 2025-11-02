-- Foreign Key Constraints for social_media_mentions table

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_responded_by
    FOREIGN KEY (responded_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_escalated_to
    FOREIGN KEY (escalated_to) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_campaign
    FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(campaign_id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_parent
    FOREIGN KEY (parent_mention_id) REFERENCES social_media_mentions(mention_id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE social_media_mentions
    ADD CONSTRAINT fk_social_media_mentions_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(id)
    ON DELETE SET NULL;
