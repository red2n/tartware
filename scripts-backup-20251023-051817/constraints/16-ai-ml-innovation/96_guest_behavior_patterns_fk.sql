-- =============================================
-- Foreign Key Constraints for 96_guest_behavior_patterns
-- =============================================

ALTER TABLE guest_behavior_patterns ADD CONSTRAINT fk_guest_behavior_patterns_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE guest_behavior_patterns ADD CONSTRAINT fk_guest_behavior_patterns_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE guest_behavior_patterns ADD CONSTRAINT fk_guest_behavior_patterns_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
ALTER TABLE guest_behavior_patterns ADD CONSTRAINT fk_guest_behavior_patterns_preferred_room_type_id FOREIGN KEY (preferred_room_type_id) REFERENCES room_types(id);
ALTER TABLE personalized_recommendations ADD CONSTRAINT fk_personalized_recommendations_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE personalized_recommendations ADD CONSTRAINT fk_personalized_recommendations_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE personalized_recommendations ADD CONSTRAINT fk_personalized_recommendations_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
ALTER TABLE personalized_recommendations ADD CONSTRAINT fk_personalized_recommendations_reservation_id FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
ALTER TABLE guest_interaction_events ADD CONSTRAINT fk_guest_interaction_events_tenant_id FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE guest_interaction_events ADD CONSTRAINT fk_guest_interaction_events_property_id FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE guest_interaction_events ADD CONSTRAINT fk_guest_interaction_events_guest_id FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
ALTER TABLE guest_interaction_events ADD CONSTRAINT fk_guest_interaction_events_reservation_id FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE;
