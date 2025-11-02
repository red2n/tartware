-- =====================================================
-- Foreign Keys for meeting_rooms table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for meeting_rooms...'

-- Tenant reference
ALTER TABLE meeting_rooms
    ADD CONSTRAINT fk_meeting_rooms_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

-- Property reference
ALTER TABLE meeting_rooms
    ADD CONSTRAINT fk_meeting_rooms_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

\echo 'Foreign keys for meeting_rooms created successfully!'
