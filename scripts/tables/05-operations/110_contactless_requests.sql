-- =============================================
-- Contactless Requests
-- =============================================

CREATE TABLE IF NOT EXISTS contactless_requests (
    -- Primary Key
    request_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Guest & Reservation
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id),

    -- Request Details
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN (
        'housekeeping',
        'maintenance',
        'room_service',
        'amenity_delivery',
        'wake_up_call',
        'extra_towels',
        'extra_pillows',
        'temperature_adjustment',
        'noise_complaint',
        'concierge_service',
        'valet_parking',
        'luggage_assistance',
        'late_checkout',
        'early_checkin',
        'other'
    )),

    request_category VARCHAR(50) CHECK (request_category IN (
        'housekeeping',
        'maintenance',
        'food_beverage',
        'guest_services',
        'concierge',
        'front_desk',
        'other'
    )),

    request_title VARCHAR(255) NOT NULL,
    request_description TEXT,

    urgency VARCHAR(50) DEFAULT 'normal' CHECK (urgency IN (
        'low',
        'normal',
        'high',
        'urgent',
        'emergency'
    )),

    -- Request Source
    request_channel VARCHAR(50) NOT NULL CHECK (request_channel IN (
        'mobile_app',
        'web_portal',
        'qr_code',
        'sms',
        'chatbot',
        'voice_assistant',
        'in_room_tablet',
        'phone',
        'front_desk'
    )),

    -- QR Code Scanning
    qr_code_scanned BOOLEAN DEFAULT FALSE,
    qr_code_location VARCHAR(100), -- "Room Door", "Bathroom", "Lobby"

    -- Request Time
    requested_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    preferred_service_time TIMESTAMP WITHOUT TIME ZONE,

    -- Assignment
    assigned_to UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITHOUT TIME ZONE,
    department VARCHAR(100),

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
        'pending',
        'acknowledged',
        'assigned',
        'in_progress',
        'completed',
        'cancelled',
        'declined'
    )),

    -- Workflow
    acknowledged_at TIMESTAMP WITHOUT TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),

    started_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,

    response_time_minutes INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN requested_at IS NOT NULL AND acknowledged_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (acknowledged_at - requested_at))::INTEGER / 60
            ELSE NULL
        END
    ) STORED,

    resolution_time_minutes INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN requested_at IS NOT NULL AND completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - requested_at))::INTEGER / 60
            ELSE NULL
        END
    ) STORED,

    -- Delivery/Service Confirmation
    service_delivered BOOLEAN DEFAULT FALSE,
    delivery_method VARCHAR(50), -- "room_delivery", "guest_pickup", "in_room_service"

    delivery_photo_url TEXT,
    delivery_signature_url TEXT,

    -- Guest Notification
    guest_notified BOOLEAN DEFAULT FALSE,
    notification_method VARCHAR(50), -- "push", "sms", "in_app"
    notification_sent_at TIMESTAMP WITHOUT TIME ZONE,

    -- Feedback
    guest_satisfaction_rating INTEGER CHECK (guest_satisfaction_rating >= 1 AND guest_satisfaction_rating <= 5),
    guest_feedback TEXT,
    feedback_submitted_at TIMESTAMP WITHOUT TIME ZONE,

    -- Staff Notes
    staff_notes TEXT,
    completion_notes TEXT,

    -- Cost
    service_charge DECIMAL(10,2),
    add_to_folio BOOLEAN DEFAULT FALSE,

    -- Analytics
    session_id VARCHAR(100),

    -- Notes
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

COMMENT ON TABLE contactless_requests IS 'Guest service requests via mobile app, QR codes, and contactless channels';
COMMENT ON COLUMN contactless_requests.response_time_minutes IS 'Minutes from request to staff acknowledgment (computed)';
COMMENT ON COLUMN contactless_requests.resolution_time_minutes IS 'Minutes from request to completion (computed)';

\echo 'contactless_requests table created successfully!'

\echo 'contactless_requests table created successfully!'

\echo 'contactless_requests table created successfully!'
