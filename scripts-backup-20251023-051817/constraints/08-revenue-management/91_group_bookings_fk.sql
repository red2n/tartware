-- =============================================
-- Foreign Key Constraints for 91_group_bookings
-- =============================================

ALTER TABLE group_bookings ADD CONSTRAINT fk_group_bookings_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE group_bookings ADD CONSTRAINT fk_group_bookings_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE group_bookings ADD CONSTRAINT fk_group_bookings_company_id FOREIGN KEY (company_id) REFERENCES companies(company_id);
ALTER TABLE group_bookings ADD CONSTRAINT fk_group_bookings_master_folio_id FOREIGN KEY (master_folio_id) REFERENCES folios(folio_id);
ALTER TABLE group_bookings ADD CONSTRAINT fk_group_bookings_account_manager_id FOREIGN KEY (account_manager_id) REFERENCES users(id);
ALTER TABLE group_bookings ADD CONSTRAINT fk_group_bookings_sales_manager_id FOREIGN KEY (sales_manager_id) REFERENCES users(id);
ALTER TABLE group_bookings ADD CONSTRAINT fk_group_bookings_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE group_bookings ADD CONSTRAINT fk_group_bookings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE group_bookings ADD CONSTRAINT fk_group_bookings_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id);
ALTER TABLE group_room_blocks ADD CONSTRAINT fk_group_room_blocks_group_booking_id FOREIGN KEY (group_booking_id) REFERENCES group_bookings(group_booking_id) ON DELETE CASCADE;
ALTER TABLE group_room_blocks ADD CONSTRAINT fk_group_room_blocks_room_type_id FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE RESTRICT;
ALTER TABLE group_room_blocks ADD CONSTRAINT fk_group_room_blocks_released_by FOREIGN KEY (released_by) REFERENCES users(id);
ALTER TABLE group_room_blocks ADD CONSTRAINT fk_group_room_blocks_created_by FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE group_room_blocks ADD CONSTRAINT fk_group_room_blocks_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);
