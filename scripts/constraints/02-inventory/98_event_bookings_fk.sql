-- =====================================================
-- Foreign Keys for event_bookings table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for event_bookings...'

-- Tenant reference
ALTER TABLE event_bookings
    ADD CONSTRAINT fk_event_bookings_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    ON DELETE CASCADE;

-- Property reference
ALTER TABLE event_bookings
    ADD CONSTRAINT fk_event_bookings_property
    FOREIGN KEY (property_id) REFERENCES properties(id)
    ON DELETE CASCADE;

-- Meeting room reference
ALTER TABLE event_bookings
    ADD CONSTRAINT fk_event_bookings_meeting_room
    FOREIGN KEY (meeting_room_id) REFERENCES meeting_rooms(room_id)
    ON DELETE RESTRICT;

-- Guest reference
ALTER TABLE event_bookings
    ADD CONSTRAINT fk_event_bookings_guest
    FOREIGN KEY (guest_id) REFERENCES guests(id)
    ON DELETE SET NULL;

-- Reservation reference
ALTER TABLE event_bookings
    ADD CONSTRAINT fk_event_bookings_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(id)
    ON DELETE SET NULL;

-- Company reference
ALTER TABLE event_bookings
    ADD CONSTRAINT fk_event_bookings_company
    FOREIGN KEY (company_id) REFERENCES companies(company_id)
    ON DELETE SET NULL;

-- Group booking reference
ALTER TABLE event_bookings
    ADD CONSTRAINT fk_event_bookings_group_booking
    FOREIGN KEY (group_booking_id) REFERENCES group_bookings(group_booking_id)
    ON DELETE SET NULL;

-- Folio reference
ALTER TABLE event_bookings
    ADD CONSTRAINT fk_event_bookings_folio
    FOREIGN KEY (folio_id) REFERENCES folios(folio_id)
    ON DELETE SET NULL;

-- Recurring event parent reference
ALTER TABLE event_bookings
    ADD CONSTRAINT fk_event_bookings_parent_event
    FOREIGN KEY (parent_event_id) REFERENCES event_bookings(event_id)
    ON DELETE SET NULL;

\echo 'Foreign keys for event_bookings created successfully!'
