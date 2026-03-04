-- =====================================================
-- communication_templates.sql
-- Communication Templates Table
-- Industry Standard: CRM message templates
-- Pattern: Pre-built message templates for automated and manual guest communications
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- COMMUNICATION_TEMPLATES TABLE
-- Pre-built message templates for guest communications
-- =====================================================

CREATE TABLE IF NOT EXISTS communication_templates (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID, -- NULL means template applies to all properties

    -- Template Identification
    template_name VARCHAR(200) NOT NULL,
    template_code VARCHAR(100) NOT NULL, -- 'PRE_ARRIVAL', 'CHECK_IN_INSTRUCTIONS', 'THANK_YOU', etc.

    -- Template Classification
    communication_type VARCHAR(50) NOT NULL, -- 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH_NOTIFICATION'
    category VARCHAR(50), -- 'BOOKING', 'ARRIVAL', 'STAY', 'DEPARTURE', 'MARKETING', 'OPERATIONAL'

    -- Template Content
    subject VARCHAR(500),
    body TEXT NOT NULL,
    html_body TEXT, -- HTML version for emails
    language_code VARCHAR(10) DEFAULT 'en',
    variables JSONB, -- Available template variables

    -- Status & Automation
    is_active BOOLEAN DEFAULT true,
    is_automated BOOLEAN DEFAULT false, -- Auto-send based on trigger

    -- Automation Configuration
    trigger_event VARCHAR(100), -- 'BOOKING_CONFIRMED', 'CHECK_IN_MINUS_24H', 'CHECK_OUT', etc.
    trigger_offset_hours INTEGER, -- Hours before/after trigger event
    send_priority INTEGER DEFAULT 0,

    -- Sender Configuration
    from_name VARCHAR(200),
    from_email VARCHAR(255),
    from_phone VARCHAR(50),
    reply_to_email VARCHAR(255),
    cc_emails VARCHAR(500),
    bcc_emails VARCHAR(500),

    -- Attachments & Metadata
    attachments JSONB, -- Default attachments
    metadata JSONB,

    -- Usage Tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Audit Fields
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID, -- User who performed the soft delete

    CONSTRAINT uq_comm_template_code UNIQUE (tenant_id, property_id, template_code, language_code)
);

-- Add comments
COMMENT ON TABLE communication_templates IS 'Pre-built message templates for automated and manual guest communications';
COMMENT ON COLUMN communication_templates.template_code IS 'Unique identifier code for template';
COMMENT ON COLUMN communication_templates.variables IS 'Available template variables like {{guest_name}}, {{check_in_date}}';
COMMENT ON COLUMN communication_templates.is_automated IS 'If true, sends automatically based on trigger';
COMMENT ON COLUMN communication_templates.trigger_event IS 'Event that triggers auto-send';
COMMENT ON COLUMN communication_templates.trigger_offset_hours IS 'Hours before (-) or after (+) trigger event';

-- =====================================================
-- SEED DEFAULT TEMPLATES
-- Standard PMS communication templates covering the full guest journey:
-- booking, pre-arrival, check-in, stay, check-out, financial, and group operations.
-- Uses ON CONFLICT to allow safe re-runs.
-- =====================================================

INSERT INTO communication_templates (
    tenant_id, template_name, template_code, communication_type, category,
    subject, body, language_code, is_active, is_automated, trigger_event, variables
)
SELECT * FROM (VALUES
    -- Booking Lifecycle
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Booking Confirmation', 'BOOKING_CONFIRMED', 'EMAIL', 'BOOKING',
     'Booking Confirmation - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nThank you for your reservation. Your booking {{confirmation_number}} is confirmed.\n\nCheck-in: {{check_in_date}}\nCheck-out: {{check_out_date}}\nRoom Type: {{room_type}}\nTotal: {{currency}} {{total_amount}}\n\nWe look forward to welcoming you!',
     'en', true, true, 'reservation.confirmed',
     '{"guest_name": "Guest full name", "confirmation_number": "Reservation confirmation number", "check_in_date": "Check-in date", "check_out_date": "Check-out date", "room_type": "Room type name", "total_amount": "Total reservation amount", "currency": "Currency code"}'::JSONB),

    ('00000000-0000-0000-0000-000000000001'::UUID, 'Booking Modification', 'BOOKING_MODIFIED', 'EMAIL', 'BOOKING',
     'Booking Updated - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nYour reservation {{confirmation_number}} has been updated.\n\nNew Check-in: {{check_in_date}}\nNew Check-out: {{check_out_date}}\nRoom Type: {{room_type}}\nUpdated Total: {{currency}} {{total_amount}}\n\nPlease contact us if you have any questions.',
     'en', true, true, 'reservation.modified',
     '{"guest_name": "Guest full name", "confirmation_number": "Reservation confirmation number", "check_in_date": "Check-in date", "check_out_date": "Check-out date", "room_type": "Room type name", "total_amount": "Total reservation amount", "currency": "Currency code"}'::JSONB),

    ('00000000-0000-0000-0000-000000000001'::UUID, 'Booking Cancellation', 'BOOKING_CANCELLED', 'EMAIL', 'BOOKING',
     'Booking Cancelled - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nYour reservation {{confirmation_number}} has been cancelled.\n\nIf this was in error or you would like to rebook, please contact us.\n\nWe hope to welcome you in the future.',
     'en', true, true, 'reservation.cancelled',
     '{"guest_name": "Guest full name", "confirmation_number": "Reservation confirmation number"}'::JSONB),

    -- Arrival & Departure
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Check-In Confirmation', 'CHECK_IN_CONFIRMATION', 'EMAIL', 'ARRIVAL',
     'Welcome - You''re Checked In!',
     E'Dear {{guest_name}},\n\nWelcome! You have been checked into room {{room_number}}.\n\nRoom Type: {{room_type}}\nCheck-out: {{check_out_date}}\n\nPlease don''t hesitate to contact the front desk if you need anything during your stay.',
     'en', true, true, 'reservation.checked_in',
     '{"guest_name": "Guest full name", "room_number": "Assigned room number", "room_type": "Room type name", "check_out_date": "Check-out date"}'::JSONB),

    ('00000000-0000-0000-0000-000000000001'::UUID, 'Check-Out Confirmation', 'CHECK_OUT_CONFIRMATION', 'EMAIL', 'DEPARTURE',
     'Thank You for Your Stay',
     E'Dear {{guest_name}},\n\nThank you for staying with us. You have been checked out of room {{room_number}}.\n\nConfirmation: {{confirmation_number}}\nTotal Charges: {{currency}} {{total_amount}}\n\nWe hope to see you again soon!',
     'en', true, true, 'reservation.checked_out',
     '{"guest_name": "Guest full name", "room_number": "Room number", "confirmation_number": "Reservation confirmation number", "total_amount": "Total amount charged", "currency": "Currency code"}'::JSONB),

    -- Pre-Arrival
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Pre-Arrival Welcome', 'WELCOME_SCRIPT', 'EMAIL', 'ARRIVAL',
     'Getting Ready for Your Arrival',
     E'Dear {{guest_name}},\n\nWe are looking forward to welcoming you on {{check_in_date}}.\n\nConfirmation: {{confirmation_number}}\nRoom Type: {{room_type}}\n\nHere are a few things to help you prepare:\n- Check-in time: {{check_in_time | 3:00 PM}}\n- Parking: {{parking_info | Available on-site}}\n- Special requests: {{special_requests | None noted}}\n\nSafe travels!',
     'en', true, false, NULL,
     '{"guest_name": "Guest full name", "check_in_date": "Check-in date", "confirmation_number": "Confirmation number", "room_type": "Room type", "check_in_time": "Check-in time", "parking_info": "Parking information", "special_requests": "Guest special requests"}'::JSONB),

    -- Financial Templates
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Deposit Due Reminder', 'DEPOSIT_DUE', 'EMAIL', 'FINANCIAL',
     'Deposit Due - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nA deposit of {{currency}} {{deposit_amount}} is due for your reservation {{confirmation_number}}.\n\nDue Date: {{due_date}}\nCheck-in: {{check_in_date}}\n\nPlease submit payment to secure your reservation. You can pay online at: {{payment_link | Contact the hotel}}',
     'en', true, false, NULL,
     '{"guest_name": "Guest full name", "confirmation_number": "Confirmation number", "deposit_amount": "Deposit amount", "currency": "Currency code", "due_date": "Payment due date", "check_in_date": "Check-in date", "payment_link": "Online payment URL"}'::JSONB),

    ('00000000-0000-0000-0000-000000000001'::UUID, 'Payment Link', 'PAYMENT_LINK', 'EMAIL', 'FINANCIAL',
     'Payment Request - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nPlease use the link below to complete your payment of {{currency}} {{amount}}.\n\nReservation: {{confirmation_number}}\nPayment Link: {{payment_url}}\n\nThis link expires on {{expiry_date | 7 days from now}}.',
     'en', true, false, NULL,
     '{"guest_name": "Guest full name", "confirmation_number": "Confirmation number", "amount": "Payment amount", "currency": "Currency code", "payment_url": "Secure payment URL", "expiry_date": "Link expiry date"}'::JSONB),

    ('00000000-0000-0000-0000-000000000001'::UUID, 'AR Statement', 'AR_STATEMENT', 'EMAIL', 'FINANCIAL',
     'Account Statement - {{statement_period}}',
     E'Dear {{contact_name}},\n\nPlease find your account statement for {{statement_period}}.\n\nAccount: {{account_name}}\nTotal Outstanding: {{currency}} {{total_outstanding}}\nCurrent: {{currency}} {{current_balance}}\n30 Days: {{currency}} {{balance_30}}\n60 Days: {{currency}} {{balance_60}}\n90+ Days: {{currency}} {{balance_90_plus}}\n\nPlease remit payment at your earliest convenience.',
     'en', true, false, NULL,
     '{"contact_name": "AR contact name", "statement_period": "Statement period", "account_name": "Account name", "total_outstanding": "Total outstanding balance", "current_balance": "Current period balance", "balance_30": "30-day balance", "balance_60": "60-day balance", "balance_90_plus": "90+ day balance", "currency": "Currency code"}'::JSONB),

    ('00000000-0000-0000-0000-000000000001'::UUID, 'Invoice', 'INVOICE', 'EMAIL', 'FINANCIAL',
     'Invoice {{invoice_number}} - {{property_name}}',
     E'Dear {{contact_name}},\n\nPlease find attached invoice {{invoice_number}}.\n\nInvoice Date: {{invoice_date}}\nDue Date: {{due_date}}\nAmount: {{currency}} {{invoice_amount}}\n\nGuest: {{guest_name | N/A}}\nConfirmation: {{confirmation_number | N/A}}\nStay: {{check_in_date | N/A}} to {{check_out_date | N/A}}\n\nPayment Terms: {{payment_terms | Net 30}}',
     'en', true, false, NULL,
     '{"contact_name": "Invoice recipient", "invoice_number": "Invoice number", "invoice_date": "Invoice date", "due_date": "Payment due date", "invoice_amount": "Invoice total", "currency": "Currency code", "guest_name": "Guest name", "confirmation_number": "Confirmation number", "check_in_date": "Check-in date", "check_out_date": "Check-out date", "property_name": "Property name", "payment_terms": "Payment terms"}'::JSONB),

    -- No-Show Notification
    ('00000000-0000-0000-0000-000000000001'::UUID, 'No-Show Notification', 'NO_SHOW_NOTIFICATION', 'EMAIL', 'BOOKING',
     'Missed Reservation - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nWe noticed you did not arrive for your reservation {{confirmation_number}} on {{check_in_date}}.\n\nIf you would like to rebook or if this was in error, please contact us as soon as possible.\n\nNo-show fees may apply per your cancellation policy.',
     'en', true, true, 'reservation.no_show',
     '{"guest_name": "Guest full name", "confirmation_number": "Reservation confirmation number", "check_in_date": "Original check-in date"}'::JSONB),

    -- Pre-Arrival Reminder (automated, sent before arrival)
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Pre-Arrival Reminder', 'PRE_ARRIVAL_REMINDER', 'EMAIL', 'ARRIVAL',
     'Your Stay Begins Soon - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nYour stay is approaching! Here are your reservation details:\n\nConfirmation: {{confirmation_number}}\nCheck-in: {{check_in_date}}\nCheck-out: {{check_out_date}}\nRoom Type: {{room_type}}\n\nCheck-in time: {{check_in_time | 3:00 PM}}\nSpecial requests: {{special_requests | None noted}}\n\nWe look forward to welcoming you!',
     'en', true, true, 'pre_arrival',
     '{"guest_name": "Guest full name", "confirmation_number": "Confirmation number", "check_in_date": "Check-in date", "check_out_date": "Check-out date", "room_type": "Room type", "check_in_time": "Check-in time", "special_requests": "Guest special requests"}'::JSONB),

    -- Post-Stay Review Request
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Post-Stay Review Request', 'POST_STAY_REVIEW', 'EMAIL', 'DEPARTURE',
     'How Was Your Stay?',
     E'Dear {{guest_name}},\n\nThank you for staying with us! We hope you enjoyed your visit.\n\nConfirmation: {{confirmation_number}}\nStay: {{check_in_date}} to {{check_out_date}}\nRoom: {{room_number}}\n\nYour feedback helps us improve. We would love to hear about your experience.\n\n{{review_link | Please contact us with your feedback.}}\n\nWe hope to welcome you back soon!',
     'en', true, true, 'post_departure',
     '{"guest_name": "Guest full name", "confirmation_number": "Confirmation number", "check_in_date": "Check-in date", "check_out_date": "Check-out date", "room_number": "Room number", "review_link": "Review/feedback URL"}'::JSONB),

    -- Room Ready Notification
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Room Ready Notification', 'ROOM_READY', 'EMAIL', 'ARRIVAL',
     'Your Room Is Ready!',
     E'Dear {{guest_name}},\n\nGreat news! Your room is ready for you.\n\nRoom: {{room_number}}\nRoom Type: {{room_type}}\nConfirmation: {{confirmation_number}}\n\nYou may proceed to the front desk or use mobile check-in at your convenience.\n\nWelcome!',
     'en', true, true, 'room_ready',
     '{"guest_name": "Guest full name", "room_number": "Assigned room number", "room_type": "Room type name", "confirmation_number": "Confirmation number"}'::JSONB),

    -- Room Move Notification (guest communication)
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Room Move Notification', 'ROOM_MOVE_NOTIFICATION', 'EMAIL', 'STAY',
     'Room Change - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nYou have been moved to a new room.\n\nPrevious Room: {{from_room_number}}\nNew Room: {{to_room_number}}\nConfirmation: {{confirmation_number}}\n\nReason: {{move_reason | Operational adjustment}}\n\nIf you have any questions, please contact the front desk.',
     'en', true, true, 'room_move',
     '{"guest_name": "Guest full name", "from_room_number": "Previous room number", "to_room_number": "New room number", "confirmation_number": "Confirmation number", "move_reason": "Reason for room move"}'::JSONB),

    -- Mobile Key Issued
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Mobile Key Issued', 'MOBILE_KEY_ISSUED', 'EMAIL', 'ARRIVAL',
     'Your Mobile Key Is Ready',
     E'Dear {{guest_name}},\n\nYour mobile key has been issued.\n\nRoom: {{room_number}}\nKey Type: {{key_type | Mobile Key}}\nValid From: {{valid_from}}\nValid Until: {{valid_to}}\n\nOpen the app and hold your phone near the door lock to enter your room.\n\nEnjoy your stay!',
     'en', true, true, 'key_issued',
     '{"guest_name": "Guest full name", "room_number": "Room number", "key_type": "Key type (bluetooth, NFC, QR code)", "valid_from": "Key validity start", "valid_to": "Key validity end"}'::JSONB),

    -- Room Out of Order Staff Alert
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Room Out of Order Alert', 'ROOM_OUT_OF_ORDER', 'EMAIL', 'OPERATIONAL',
     'Room {{room_number}} - Out of Order',
     E'Room {{room_number}} has been marked OUT OF ORDER.\n\nReason: {{out_of_order_reason | Not specified}}\nSince: {{out_of_order_since}}\nExpected Ready: {{expected_ready_date | TBD}}\n\nThis room has been removed from available inventory until further notice.',
     'en', true, true, 'room_out_of_order',
     '{"room_number": "Room number", "out_of_order_reason": "Reason for out of order", "out_of_order_since": "Date marked OOO", "expected_ready_date": "Expected ready date"}'::JSONB),

    -- Room Back in Service Alert
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Room Back in Service', 'ROOM_BACK_IN_SERVICE', 'EMAIL', 'OPERATIONAL',
     'Room {{room_number}} - Back in Service',
     E'Room {{room_number}} is now back in service and available for assignment.\n\nPrevious Status: {{previous_status | Out of Order}}\nCleared By: {{cleared_by | System}}\n\nThe room has been returned to available inventory.',
     'en', true, true, 'room_back_in_service',
     '{"room_number": "Room number", "previous_status": "Previous room status", "cleared_by": "User who cleared the room"}'::JSONB),

    -- Payment Received Confirmation
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Payment Confirmation', 'PAYMENT_CONFIRMATION', 'EMAIL', 'FINANCIAL',
     'Payment Received - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nWe have received your payment.\n\nAmount: {{currency}} {{payment_amount}}\nPayment Method: {{payment_method | Credit Card}}\nReservation: {{confirmation_number}}\nDate: {{payment_date}}\n\nThank you for your prompt payment.',
     'en', true, true, 'payment_received',
     '{"guest_name": "Guest full name", "confirmation_number": "Confirmation number", "payment_amount": "Payment amount", "currency": "Currency code", "payment_method": "Payment method", "payment_date": "Payment date"}'::JSONB),

    -- Quote Sent
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Quote Sent', 'QUOTE_SENT', 'EMAIL', 'BOOKING',
     'Your Quote - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nThank you for your interest. Here is your quote:\n\nReference: {{confirmation_number}}\nCheck-in: {{check_in_date}}\nCheck-out: {{check_out_date}}\nRoom Type: {{room_type}}\nQuoted Rate: {{currency}} {{total_amount}}\n\nThis quote is valid until {{expiry_date | 48 hours from now}}.\n\nTo confirm your reservation, please reply or book online.',
     'en', true, true, 'reservation.quoted',
     '{"guest_name": "Guest full name", "confirmation_number": "Confirmation number", "check_in_date": "Check-in date", "check_out_date": "Check-out date", "room_type": "Room type", "total_amount": "Quoted amount", "currency": "Currency code", "expiry_date": "Quote expiry date"}'::JSONB),

    -- Reservation Expired
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Reservation Expired', 'RESERVATION_EXPIRED', 'EMAIL', 'BOOKING',
     'Reservation Expired - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nYour reservation or quote {{confirmation_number}} has expired.\n\nOriginal Check-in: {{check_in_date}}\nOriginal Check-out: {{check_out_date}}\n\nIf you would still like to book, please create a new reservation. Rates and availability may have changed.\n\nWe hope to welcome you soon.',
     'en', true, true, 'reservation.expired',
     '{"guest_name": "Guest full name", "confirmation_number": "Confirmation number", "check_in_date": "Original check-in date", "check_out_date": "Original check-out date"}'::JSONB),

    -- Early Check-In Approval
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Early Check-In Approved', 'EARLY_CHECKIN_APPROVED', 'EMAIL', 'ARRIVAL',
     'Early Check-In Approved - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nGood news! Your early check-in request has been approved.\n\nRoom: {{room_number}}\nEarly Check-in Time: {{early_checkin_time}}\nConfirmation: {{confirmation_number}}\n\nPlease proceed to the front desk upon arrival.',
     'en', true, false, NULL,
     '{"guest_name": "Guest full name", "room_number": "Room number", "early_checkin_time": "Approved early check-in time", "confirmation_number": "Confirmation number"}'::JSONB),

    -- Express Checkout Ready
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Express Checkout Ready', 'EXPRESS_CHECKOUT_READY', 'EMAIL', 'DEPARTURE',
     'Express Checkout Available - {{confirmation_number}}',
     E'Dear {{guest_name}},\n\nYour folio is ready for express checkout.\n\nRoom: {{room_number}}\nConfirmation: {{confirmation_number}}\nTotal Charges: {{currency}} {{total_amount}}\n\nSimply drop your key at the front desk or use the express checkout kiosk. A final folio will be emailed to you.\n\nThank you for your stay!',
     'en', true, false, NULL,
     '{"guest_name": "Guest full name", "room_number": "Room number", "confirmation_number": "Confirmation number", "total_amount": "Total charges", "currency": "Currency code"}'::JSONB),

    -- Group Operations
    ('00000000-0000-0000-0000-000000000001'::UUID, 'Group Booking Confirmation', 'GROUP_BOOKING_CONFIRMED', 'EMAIL', 'GROUP',
     'Group Booking Confirmed - {{group_name}}',
     E'Dear {{contact_name}},\n\nYour group booking has been confirmed.\n\nGroup Name: {{group_name}}\nBooking Code: {{booking_code}}\nArrival: {{check_in_date}}\nDeparture: {{check_out_date}}\nTotal Rooms: {{total_rooms}}\n\nCutoff Date: {{cutoff_date | TBD}}\n\nPlease submit your rooming list before the cutoff date.',
     'en', true, true, 'group.created',
     '{"contact_name": "Group coordinator", "group_name": "Group block name", "booking_code": "Group booking code", "check_in_date": "Group check-in date", "check_out_date": "Group check-out date", "total_rooms": "Total rooms reserved", "cutoff_date": "Cutoff date for room list"}'::JSONB),

    ('00000000-0000-0000-0000-000000000001'::UUID, 'Group Cutoff Notice', 'GROUP_CUTOFF_NOTICE', 'EMAIL', 'GROUP',
     'Group Cutoff Enforced - {{group_name}}',
     E'Dear {{contact_name}},\n\nThe cutoff date for group {{group_name}} has been enforced.\n\nCutoff Date: {{cutoff_date}}\nRooms Released: {{rooms_released}}\nRooms Remaining: {{rooms_remaining}}\n\nUnassigned rooms have been released back to general inventory. Please contact us if you need to make changes.',
     'en', true, true, 'group.cutoff_enforced',
     '{"contact_name": "Group coordinator", "group_name": "Group block name", "cutoff_date": "Cutoff date enforced", "rooms_released": "Number of rooms released", "rooms_remaining": "Rooms retained for group"}'::JSONB),

    ('00000000-0000-0000-0000-000000000001'::UUID, 'Group Rooming List', 'GROUP_ROOMING_LIST', 'EMAIL', 'GROUP',
     'Rooming List - {{group_name}}',
     E'Dear {{contact_name}},\n\nPlease find the rooming list for {{group_name}}.\n\nEvent: {{event_name | N/A}}\nArrival: {{check_in_date}}\nDeparture: {{check_out_date}}\nTotal Rooms: {{total_rooms}}\nRooms Assigned: {{rooms_assigned}}\nRooms Remaining: {{rooms_remaining}}\n\nCutoff Date: {{cutoff_date | N/A}}\n\nPlease review and confirm room assignments.',
     'en', true, false, NULL,
     '{"contact_name": "Group coordinator", "group_name": "Group block name", "event_name": "Event name", "check_in_date": "Group check-in date", "check_out_date": "Group check-out date", "total_rooms": "Total rooms in block", "rooms_assigned": "Rooms assigned so far", "rooms_remaining": "Remaining unassigned rooms", "cutoff_date": "Cutoff date for group block"}'::JSONB),

    -- OTA Booking Confirmation
    ('00000000-0000-0000-0000-000000000001'::UUID, 'OTA Booking Confirmation', 'OTA_BOOKING_CONFIRMED', 'EMAIL', 'BOOKING',
     'Booking Confirmation - {{confirmation_number}} (via {{ota_channel | Online}})' ,
     E'Dear {{guest_name}},\n\nYour booking made via {{ota_channel | our online channel}} has been confirmed.\n\nConfirmation: {{confirmation_number}}\nCheck-in: {{check_in_date}}\nCheck-out: {{check_out_date}}\nRoom Type: {{room_type}}\nTotal: {{currency}} {{total_amount}}\n\nWe look forward to welcoming you!',
     'en', true, true, 'reservation.created_from_ota',
     '{"guest_name": "Guest full name", "confirmation_number": "Confirmation number", "check_in_date": "Check-in date", "check_out_date": "Check-out date", "room_type": "Room type", "total_amount": "Total amount", "currency": "Currency code", "ota_channel": "OTA channel name"}'::JSONB)
) AS t(tenant_id, template_name, template_code, communication_type, category,
       subject, body, language_code, is_active, is_automated, trigger_event, variables)
ON CONFLICT ON CONSTRAINT uq_comm_template_code DO NOTHING;

\echo 'communication_templates table created successfully!'
