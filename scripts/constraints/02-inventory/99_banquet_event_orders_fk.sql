-- =====================================================
-- Foreign Keys for banquet_event_orders table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for banquet_event_orders...'

-- Tenant reference
ALTER TABLE banquet_event_orders
    ADD CONSTRAINT fk_beo_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

-- Property reference
ALTER TABLE banquet_event_orders
    ADD CONSTRAINT fk_beo_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

-- Event booking reference
ALTER TABLE banquet_event_orders
    ADD CONSTRAINT fk_beo_event_booking
    FOREIGN KEY (event_booking_id) REFERENCES event_bookings(event_id)
    ON DELETE CASCADE;

-- Meeting room reference
ALTER TABLE banquet_event_orders
    ADD CONSTRAINT fk_beo_meeting_room
    FOREIGN KEY (meeting_room_id) REFERENCES meeting_rooms(room_id)
    ON DELETE RESTRICT;

-- Previous version reference (self-referential)
ALTER TABLE banquet_event_orders
    ADD CONSTRAINT fk_beo_previous_version
    FOREIGN KEY (previous_beo_id) REFERENCES banquet_event_orders(beo_id)
    ON DELETE SET NULL;

-- Approval tracking (user references)
ALTER TABLE banquet_event_orders
    ADD CONSTRAINT fk_beo_chef_approved_by
    FOREIGN KEY (chef_approved_by) REFERENCES users(id)
    ON DELETE SET NULL;

ALTER TABLE banquet_event_orders
    ADD CONSTRAINT fk_beo_manager_approved_by
    FOREIGN KEY (manager_approved_by) REFERENCES users(id)
    ON DELETE SET NULL;

\echo 'Foreign keys for banquet_event_orders created successfully!'
