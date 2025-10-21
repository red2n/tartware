-- =============================================
-- Foreign Key Constraints for 100_mobile_check_ins
-- =============================================

ALTER TABLE mobile_check_ins ADD CONSTRAINT fk_mobile_check_ins_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE mobile_check_ins ADD CONSTRAINT fk_mobile_check_ins_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE mobile_check_ins ADD CONSTRAINT fk_mobile_check_ins_reservation_id FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE mobile_check_ins ADD CONSTRAINT fk_mobile_check_ins_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
ALTER TABLE mobile_check_ins ADD CONSTRAINT fk_mobile_check_ins_id_verified_by FOREIGN KEY (id_verified_by) REFERENCES users(id);
ALTER TABLE mobile_check_ins ADD CONSTRAINT fk_mobile_check_ins_room_id FOREIGN KEY (room_id) REFERENCES rooms(id);
ALTER TABLE mobile_check_ins ADD CONSTRAINT fk_mobile_check_ins_staff_assisted_by FOREIGN KEY (staff_assisted_by) REFERENCES users(id);
ALTER TABLE digital_registration_cards ADD CONSTRAINT fk_digital_registration_cards_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE digital_registration_cards ADD CONSTRAINT fk_digital_registration_cards_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE digital_registration_cards ADD CONSTRAINT fk_digital_registration_cards_reservation_id FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE digital_registration_cards ADD CONSTRAINT fk_digital_registration_cards_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
ALTER TABLE digital_registration_cards ADD CONSTRAINT fk_digital_registration_cards_mobile_checkin_id FOREIGN KEY (mobile_checkin_id) REFERENCES mobile_check_ins(mobile_checkin_id) ON DELETE CASCADE;
ALTER TABLE digital_registration_cards ADD CONSTRAINT fk_digital_registration_cards_verified_by FOREIGN KEY (verified_by) REFERENCES users(id);
ALTER TABLE contactless_requests ADD CONSTRAINT fk_contactless_requests_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE contactless_requests ADD CONSTRAINT fk_contactless_requests_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE contactless_requests ADD CONSTRAINT fk_contactless_requests_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
ALTER TABLE contactless_requests ADD CONSTRAINT fk_contactless_requests_reservation_id FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE contactless_requests ADD CONSTRAINT fk_contactless_requests_room_id FOREIGN KEY (room_id) REFERENCES rooms(id);
ALTER TABLE contactless_requests ADD CONSTRAINT fk_contactless_requests_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id);
ALTER TABLE contactless_requests ADD CONSTRAINT fk_contactless_requests_acknowledged_by FOREIGN KEY (acknowledged_by) REFERENCES users(id);
