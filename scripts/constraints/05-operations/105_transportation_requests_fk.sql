-- =====================================================
-- Foreign Keys for transportation_requests table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for transportation_requests...'

-- Tenant reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

-- Property reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

-- Reservation reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON DELETE SET NULL;

-- Guest reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE CASCADE;

-- Vehicle reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id)
    ON DELETE SET NULL;

-- Driver reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_driver
    FOREIGN KEY (driver_id) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Folio reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_folio
    FOREIGN KEY (folio_id) REFERENCES folios(folio_id)
    ON DELETE SET NULL;

-- Package reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_package
    FOREIGN KEY (package_id) REFERENCES packages(package_id)
    ON DELETE SET NULL;

-- Dispatched by user reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_dispatched_by
    FOREIGN KEY (dispatched_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Completed by user reference
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_completed_by
    FOREIGN KEY (completed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Parent request reference (for recurring)
ALTER TABLE transportation_requests
    ADD CONSTRAINT fk_transport_requests_parent
    FOREIGN KEY (parent_request_id) REFERENCES transportation_requests(request_id)
    ON DELETE SET NULL;

\echo 'Foreign keys for transportation_requests created successfully!'
