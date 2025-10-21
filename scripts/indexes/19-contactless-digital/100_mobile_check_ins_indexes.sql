-- =============================================
-- Indexes for 100_mobile_check_ins
-- =============================================

CREATE INDEX idx_mobile_check_ins_reservation ON mobile_check_ins(reservation_id);
CREATE INDEX idx_mobile_check_ins_guest ON mobile_check_ins(guest_id);
CREATE INDEX idx_mobile_check_ins_status ON mobile_check_ins(checkin_status);
CREATE INDEX idx_mobile_check_ins_property ON mobile_check_ins(property_id);
CREATE INDEX idx_mobile_check_ins_started ON mobile_check_ins(checkin_started_at DESC);
CREATE INDEX idx_mobile_check_ins_completed ON mobile_check_ins(checkin_completed_at DESC);
CREATE INDEX idx_mobile_check_ins_requires_assistance ON mobile_check_ins(requires_staff_assistance) WHERE requires_staff_assistance = TRUE;
CREATE INDEX idx_digital_registration_cards_reservation ON digital_registration_cards(reservation_id);
CREATE INDEX idx_digital_registration_cards_guest ON digital_registration_cards(guest_id);
CREATE INDEX idx_digital_registration_cards_number ON digital_registration_cards(registration_number);
CREATE INDEX idx_digital_registration_cards_date ON digital_registration_cards(registration_date DESC);
CREATE INDEX idx_digital_registration_cards_unverified ON digital_registration_cards(verified) WHERE verified = FALSE;
CREATE INDEX idx_contactless_requests_guest ON contactless_requests(guest_id);
CREATE INDEX idx_contactless_requests_reservation ON contactless_requests(reservation_id);
CREATE INDEX idx_contactless_requests_room ON contactless_requests(room_id);
CREATE INDEX idx_contactless_requests_status ON contactless_requests(status);
CREATE INDEX idx_contactless_requests_type ON contactless_requests(request_type);
CREATE INDEX idx_contactless_requests_urgency ON contactless_requests(urgency) WHERE status IN ('pending', 'assigned', 'in_progress');
CREATE INDEX idx_contactless_requests_assigned ON contactless_requests(assigned_to) WHERE status IN ('assigned', 'in_progress');
CREATE INDEX idx_contactless_requests_timestamp ON contactless_requests(requested_at DESC);
