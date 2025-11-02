-- =============================================
-- Mobile Check-Ins Table
-- =============================================
-- Description: Contactless mobile check-in workflow tracking
-- Dependencies: guests, reservations
-- Category: Contactless Operations
-- =============================================

CREATE TABLE IF NOT EXISTS mobile_check_ins (
    -- Primary Key
    mobile_checkin_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Reservation
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,

    -- Check-in Process
    checkin_status VARCHAR(50) DEFAULT 'not_started' CHECK (checkin_status IN (
        'not_started',
        'in_progress',
        'identity_verification',
        'payment_verification',
        'room_assignment',
        'key_generated',
        'completed',
        'failed',
        'cancelled'
    )),

    -- Timeline
    checkin_started_at TIMESTAMP WITHOUT TIME ZONE,
    checkin_completed_at TIMESTAMP WITHOUT TIME ZONE,

    time_to_complete_seconds INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN checkin_started_at IS NOT NULL AND checkin_completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (checkin_completed_at - checkin_started_at))::INTEGER
            ELSE NULL
        END
    ) STORED,

    -- Access Method
    access_method VARCHAR(50) CHECK (access_method IN (
        'mobile_app',
        'web_browser',
        'kiosk',
        'sms_link',
        'email_link',
        'qr_code'
    )),

    -- Device Information
    device_type VARCHAR(50), -- "iOS", "Android", "Web"
    device_model VARCHAR(100),
    app_version VARCHAR(50),
    browser VARCHAR(100),
    operating_system VARCHAR(100),

    -- Location
    checkin_location VARCHAR(50) CHECK (checkin_location IN (
        'off_property',
        'parking_lot',
        'lobby',
        'in_room',
        'other'
    )),

    ip_address VARCHAR(45),
    geolocation JSONB, -- {"latitude": 37.7749, "longitude": -122.4194}

    -- Identity Verification
    identity_verification_method VARCHAR(50) CHECK (identity_verification_method IN (
        'government_id',
        'passport',
        'drivers_license',
        'face_recognition',
        'biometric',
        'existing_profile',
        'manual_verification',
        'not_required'
    )),

    id_document_type VARCHAR(50),
    id_document_uploaded BOOLEAN DEFAULT FALSE,
    id_document_verified BOOLEAN DEFAULT FALSE,
    id_verified_at TIMESTAMP WITHOUT TIME ZONE,
    id_verified_by UUID REFERENCES users(id),

    face_match_score DECIMAL(5,2), -- Biometric face matching confidence (0-100)
    liveness_check_passed BOOLEAN DEFAULT FALSE,

    -- Registration Card
    registration_card_signed BOOLEAN DEFAULT FALSE,
    signature_captured BOOLEAN DEFAULT FALSE,
    signature_url TEXT,
    registration_card_url TEXT,

    terms_accepted BOOLEAN DEFAULT FALSE,
    terms_accepted_at TIMESTAMP WITHOUT TIME ZONE,

    -- Payment Verification
    payment_method_verified BOOLEAN DEFAULT FALSE,
    payment_authorization_code VARCHAR(100),
    deposit_collected BOOLEAN DEFAULT FALSE,
    deposit_amount DECIMAL(10,2),

    -- Room Assignment
    room_preference_submitted BOOLEAN DEFAULT FALSE,
    preferred_floor INTEGER,
    preferred_view VARCHAR(50),
    preferred_bed_type VARCHAR(50),
    accessibility_requirements TEXT[],

    room_id UUID REFERENCES rooms(id),
    room_assigned BOOLEAN DEFAULT FALSE,
    room_assigned_at TIMESTAMP WITHOUT TIME ZONE,
    room_assignment_method VARCHAR(50) CHECK (room_assignment_method IN (
        'guest_selected',
        'auto_assigned',
        'staff_assigned',
        'ai_optimized'
    )),

    upgrade_offered BOOLEAN DEFAULT FALSE,
    upgrade_accepted BOOLEAN DEFAULT FALSE,
    upgrade_amount DECIMAL(10,2),

    -- Digital Key
    digital_key_type VARCHAR(50) CHECK (digital_key_type IN (
        'mobile_app_key',
        'nfc',
        'bluetooth',
        'qr_code',
        'pin_code',
        'physical_key_required'
    )),

    digital_key_generated BOOLEAN DEFAULT FALSE,
    digital_key_id VARCHAR(255),
    digital_key_expires_at TIMESTAMP WITHOUT TIME ZONE,

    key_delivery_method VARCHAR(50) CHECK (key_delivery_method IN (
        'app_download',
        'sms',
        'email',
        'push_notification',
        'front_desk'
    )),

    -- Pre-arrival Requests
    early_checkin_requested BOOLEAN DEFAULT FALSE,
    early_checkin_approved BOOLEAN DEFAULT FALSE,
    requested_checkin_time TIME,

    special_requests TEXT,
    dietary_restrictions TEXT,

    -- Upsells & Add-ons
    upsells_presented JSONB, -- Array of upsell offers shown
    upsells_accepted JSONB, -- Array of accepted offers
    total_upsell_revenue DECIMAL(10,2) DEFAULT 0.00,

    -- Communication Preferences
    sms_notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications_enabled BOOLEAN DEFAULT TRUE,
    push_notifications_enabled BOOLEAN DEFAULT TRUE,

    preferred_language VARCHAR(10),

    -- Guest Experience
    arrival_instructions_viewed BOOLEAN DEFAULT FALSE,
    property_map_viewed BOOLEAN DEFAULT FALSE,
    amenities_guide_viewed BOOLEAN DEFAULT FALSE,

    chatbot_interaction_count INTEGER DEFAULT 0,
    help_requested BOOLEAN DEFAULT FALSE,

    -- Satisfaction
    checkin_rating INTEGER CHECK (checkin_rating >= 1 AND checkin_rating <= 5),
    checkin_feedback TEXT,
    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),

    -- Staff Override
    requires_staff_assistance BOOLEAN DEFAULT FALSE,
    staff_notified BOOLEAN DEFAULT FALSE,
    staff_assisted_by UUID REFERENCES users(id),
    staff_notes TEXT,

    -- Errors & Issues
    error_count INTEGER DEFAULT 0,
    last_error_message TEXT,
    last_error_at TIMESTAMP WITHOUT TIME ZONE,

    -- Completion
    checkin_confirmation_sent BOOLEAN DEFAULT FALSE,
    confirmation_sent_at TIMESTAMP WITHOUT TIME ZONE,

    welcome_message_sent BOOLEAN DEFAULT FALSE,
    welcome_message_viewed BOOLEAN DEFAULT FALSE,

    -- Analytics
    session_id VARCHAR(100),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),

    referrer VARCHAR(255),

    -- Notes
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

-- =============================================
-- Digital Registration Cards
-- =============================================

CREATE TABLE IF NOT EXISTS digital_registration_cards (
    -- Primary Key
    registration_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Links
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    mobile_checkin_id UUID REFERENCES mobile_check_ins(mobile_checkin_id) ON DELETE CASCADE,

    -- Registration Details
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    registration_date DATE NOT NULL,
    registration_time TIME NOT NULL,

    -- Guest Information (snapshot)
    guest_full_name VARCHAR(255) NOT NULL,
    guest_email VARCHAR(255),
    guest_phone VARCHAR(50),
    guest_date_of_birth DATE,
    guest_nationality VARCHAR(100),

    -- ID Document Information
    id_type VARCHAR(50),
    id_number VARCHAR(100),
    id_issuing_country VARCHAR(100),
    id_issue_date DATE,
    id_expiry_date DATE,

    id_front_image_url TEXT,
    id_back_image_url TEXT,

    -- Address
    home_address TEXT,
    home_city VARCHAR(100),
    home_state VARCHAR(100),
    home_country VARCHAR(100),
    home_postal_code VARCHAR(20),

    -- Stay Details
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    number_of_nights INTEGER NOT NULL,
    number_of_adults INTEGER NOT NULL,
    number_of_children INTEGER DEFAULT 0,

    room_number VARCHAR(50),
    room_type VARCHAR(100),
    rate_code VARCHAR(50),

    -- Companions
    companion_names TEXT[],
    companion_count INTEGER DEFAULT 0,

    -- Vehicle Information
    vehicle_make VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_color VARCHAR(50),
    vehicle_license_plate VARCHAR(50),
    parking_space_assigned VARCHAR(50),

    -- Purpose of Visit
    visit_purpose VARCHAR(50) CHECK (visit_purpose IN (
        'leisure',
        'business',
        'conference',
        'wedding',
        'family_event',
        'other'
    )),

    company_name VARCHAR(255), -- If business travel

    -- Signature
    guest_signature_url TEXT,
    signature_captured_at TIMESTAMP WITHOUT TIME ZONE,
    signature_method VARCHAR(50) CHECK (signature_method IN (
        'touchscreen',
        'mouse',
        'stylus',
        'biometric',
        'electronic_consent'
    )),

    -- Legal Compliance
    terms_and_conditions_url TEXT,
    privacy_policy_url TEXT,

    terms_accepted BOOLEAN DEFAULT FALSE,
    privacy_accepted BOOLEAN DEFAULT FALSE,
    marketing_consent BOOLEAN DEFAULT FALSE,

    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relationship VARCHAR(100),

    -- Document Storage
    pdf_url TEXT,
    pdf_generated_at TIMESTAMP WITHOUT TIME ZONE,

    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITHOUT TIME ZONE,

    -- Compliance
    regulatory_compliance_status VARCHAR(50) CHECK (regulatory_compliance_status IN (
        'compliant',
        'pending',
        'non_compliant'
    )),

    government_reporting_submitted BOOLEAN DEFAULT FALSE,
    government_reporting_date DATE,

    -- Notes
    special_notes TEXT,
    staff_notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID
);

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


COMMENT ON TABLE mobile_check_ins IS 'Contactless mobile check-in workflow with identity verification, digital keys, and upsells';
COMMENT ON TABLE digital_registration_cards IS 'Electronic registration cards with digital signatures and compliance tracking';
COMMENT ON TABLE contactless_requests IS 'Guest service requests via mobile app, QR codes, and contactless channels';
COMMENT ON COLUMN mobile_check_ins.time_to_complete_seconds IS 'Total time for guest to complete check-in process (computed)';
COMMENT ON COLUMN mobile_check_ins.digital_key_type IS 'Type of digital key issued (mobile app, NFC, Bluetooth, QR code, PIN)';
COMMENT ON COLUMN contactless_requests.response_time_minutes IS 'Minutes from request to staff acknowledgment (computed)';
COMMENT ON COLUMN contactless_requests.resolution_time_minutes IS 'Minutes from request to completion (computed)';
