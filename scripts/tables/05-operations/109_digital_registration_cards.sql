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

COMMENT ON TABLE digital_registration_cards IS 'Electronic registration cards with digital signatures and compliance tracking';
