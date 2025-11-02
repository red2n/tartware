-- =====================================================
-- Foreign Keys for minibar_consumption table
-- =====================================================

\c tartware

\echo 'Creating foreign keys for minibar_consumption...'

-- Tenant reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

-- Property reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

-- Reservation reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON DELETE CASCADE;

-- Guest reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE SET NULL;

-- Room reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    ON DELETE CASCADE;

-- Minibar item reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_item
    FOREIGN KEY (item_id) REFERENCES minibar_items(item_id)
    ON DELETE RESTRICT;

-- Folio reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_folio
    FOREIGN KEY (folio_id) REFERENCES folios(folio_id)
    ON DELETE SET NULL;

-- Detected by user reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_detected_by
    FOREIGN KEY (detected_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Verified by user reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Adjusted by user reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_adjusted_by
    FOREIGN KEY (adjusted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Replenished by user reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_replenished_by
    FOREIGN KEY (replenished_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Age verified by user reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_age_verified_by
    FOREIGN KEY (age_verified_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

-- Package reference
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_package
    FOREIGN KEY (package_id) REFERENCES packages(package_id)
    ON DELETE SET NULL;

-- Original room reference (for room change tracking)
ALTER TABLE minibar_consumption
    ADD CONSTRAINT fk_minibar_consumption_original_room
    FOREIGN KEY (original_room_id) REFERENCES rooms(room_id)
    ON DELETE SET NULL;

\echo 'Foreign keys for minibar_consumption created successfully!'
