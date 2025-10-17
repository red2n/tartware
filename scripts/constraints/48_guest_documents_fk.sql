-- Foreign key constraints for guest_documents table

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
    ON DELETE CASCADE;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_property
    FOREIGN KEY (property_id) REFERENCES properties(property_id)
    ON DELETE CASCADE;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_guest
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id)
    ON DELETE CASCADE;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_reservation
    FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id)
    ON DELETE SET NULL;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_verified_by
    FOREIGN KEY (verified_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_last_viewed_by
    FOREIGN KEY (last_viewed_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_previous_version
    FOREIGN KEY (previous_version_id) REFERENCES guest_documents(document_id)
    ON DELETE SET NULL;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_created_by
    FOREIGN KEY (created_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_updated_by
    FOREIGN KEY (updated_by) REFERENCES users(user_id)
    ON DELETE SET NULL;

ALTER TABLE guest_documents
    ADD CONSTRAINT fk_guest_documents_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES users(user_id)
    ON DELETE SET NULL;
