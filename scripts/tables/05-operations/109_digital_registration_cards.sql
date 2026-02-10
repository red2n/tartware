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
COMMENT ON COLUMN digital_registration_cards.registration_id IS 'Unique identifier for the registration card';
COMMENT ON COLUMN digital_registration_cards.tenant_id IS 'Tenant owning this registration card';
COMMENT ON COLUMN digital_registration_cards.property_id IS 'Property where the guest is registering';
COMMENT ON COLUMN digital_registration_cards.reservation_id IS 'Reservation linked to this registration';
COMMENT ON COLUMN digital_registration_cards.guest_id IS 'Primary guest completing the registration';
COMMENT ON COLUMN digital_registration_cards.mobile_checkin_id IS 'Mobile check-in record if registration was completed via mobile';
COMMENT ON COLUMN digital_registration_cards.registration_number IS 'Unique human-readable registration card number';
COMMENT ON COLUMN digital_registration_cards.registration_date IS 'Date the registration card was completed';
COMMENT ON COLUMN digital_registration_cards.registration_time IS 'Time the registration card was completed';
COMMENT ON COLUMN digital_registration_cards.guest_full_name IS 'Snapshot of guest full name at time of registration';
COMMENT ON COLUMN digital_registration_cards.guest_email IS 'Snapshot of guest email at time of registration';
COMMENT ON COLUMN digital_registration_cards.guest_phone IS 'Snapshot of guest phone number at time of registration';
COMMENT ON COLUMN digital_registration_cards.guest_date_of_birth IS 'Guest date of birth for age verification';
COMMENT ON COLUMN digital_registration_cards.guest_nationality IS 'Guest nationality for regulatory reporting';
COMMENT ON COLUMN digital_registration_cards.id_type IS 'Type of identification document presented (passport, license, etc.)';
COMMENT ON COLUMN digital_registration_cards.id_number IS 'Identification document number';
COMMENT ON COLUMN digital_registration_cards.id_issuing_country IS 'Country that issued the identification document';
COMMENT ON COLUMN digital_registration_cards.id_issue_date IS 'Issue date of the identification document';
COMMENT ON COLUMN digital_registration_cards.id_expiry_date IS 'Expiry date of the identification document';
COMMENT ON COLUMN digital_registration_cards.id_front_image_url IS 'URL to the scanned front image of the ID document';
COMMENT ON COLUMN digital_registration_cards.id_back_image_url IS 'URL to the scanned back image of the ID document';
COMMENT ON COLUMN digital_registration_cards.home_address IS 'Guest home street address';
COMMENT ON COLUMN digital_registration_cards.home_city IS 'Guest home city';
COMMENT ON COLUMN digital_registration_cards.home_state IS 'Guest home state or province';
COMMENT ON COLUMN digital_registration_cards.home_country IS 'Guest home country';
COMMENT ON COLUMN digital_registration_cards.home_postal_code IS 'Guest home postal or ZIP code';
COMMENT ON COLUMN digital_registration_cards.arrival_date IS 'Expected or actual arrival date';
COMMENT ON COLUMN digital_registration_cards.departure_date IS 'Expected or actual departure date';
COMMENT ON COLUMN digital_registration_cards.number_of_nights IS 'Total nights for the stay';
COMMENT ON COLUMN digital_registration_cards.number_of_adults IS 'Number of adult guests in the room';
COMMENT ON COLUMN digital_registration_cards.number_of_children IS 'Number of children in the room';
COMMENT ON COLUMN digital_registration_cards.room_number IS 'Assigned room number';
COMMENT ON COLUMN digital_registration_cards.room_type IS 'Type of room assigned (e.g. deluxe, suite)';
COMMENT ON COLUMN digital_registration_cards.rate_code IS 'Rate plan code applied to the reservation';
COMMENT ON COLUMN digital_registration_cards.companion_names IS 'Array of companion/additional guest names';
COMMENT ON COLUMN digital_registration_cards.companion_count IS 'Number of companions registered';
COMMENT ON COLUMN digital_registration_cards.vehicle_make IS 'Make of the guest vehicle for parking records';
COMMENT ON COLUMN digital_registration_cards.vehicle_model IS 'Model of the guest vehicle';
COMMENT ON COLUMN digital_registration_cards.vehicle_color IS 'Color of the guest vehicle';
COMMENT ON COLUMN digital_registration_cards.vehicle_license_plate IS 'License plate number of the guest vehicle';
COMMENT ON COLUMN digital_registration_cards.parking_space_assigned IS 'Parking space assigned to the guest';
COMMENT ON COLUMN digital_registration_cards.visit_purpose IS 'Purpose of the visit (leisure, business, conference, wedding, family_event, other)';
COMMENT ON COLUMN digital_registration_cards.company_name IS 'Company name if the visit is for business travel';
COMMENT ON COLUMN digital_registration_cards.guest_signature_url IS 'URL to the stored digital signature image';
COMMENT ON COLUMN digital_registration_cards.signature_captured_at IS 'Timestamp when the signature was captured';
COMMENT ON COLUMN digital_registration_cards.signature_method IS 'Method used to capture the signature (touchscreen, mouse, stylus, biometric, electronic_consent)';
COMMENT ON COLUMN digital_registration_cards.terms_and_conditions_url IS 'URL to the terms and conditions document presented';
COMMENT ON COLUMN digital_registration_cards.privacy_policy_url IS 'URL to the privacy policy document presented';
COMMENT ON COLUMN digital_registration_cards.terms_accepted IS 'Whether the guest accepted the terms and conditions';
COMMENT ON COLUMN digital_registration_cards.privacy_accepted IS 'Whether the guest accepted the privacy policy';
COMMENT ON COLUMN digital_registration_cards.marketing_consent IS 'Whether the guest consented to marketing communications';
COMMENT ON COLUMN digital_registration_cards.emergency_contact_name IS 'Name of the guest emergency contact';
COMMENT ON COLUMN digital_registration_cards.emergency_contact_phone IS 'Phone number of the emergency contact';
COMMENT ON COLUMN digital_registration_cards.emergency_contact_relationship IS 'Relationship of the emergency contact to the guest';
COMMENT ON COLUMN digital_registration_cards.pdf_url IS 'URL to the generated PDF version of the registration card';
COMMENT ON COLUMN digital_registration_cards.pdf_generated_at IS 'Timestamp when the PDF was generated';
COMMENT ON COLUMN digital_registration_cards.verified IS 'Whether staff verified the registration details';
COMMENT ON COLUMN digital_registration_cards.verified_by IS 'Staff user who verified the registration';
COMMENT ON COLUMN digital_registration_cards.verified_at IS 'Timestamp when verification was completed';
COMMENT ON COLUMN digital_registration_cards.regulatory_compliance_status IS 'Compliance status for regulatory requirements (compliant, pending, non_compliant)';
COMMENT ON COLUMN digital_registration_cards.government_reporting_submitted IS 'Whether guest data was submitted to government authorities';
COMMENT ON COLUMN digital_registration_cards.government_reporting_date IS 'Date when government reporting was submitted';
COMMENT ON COLUMN digital_registration_cards.special_notes IS 'Guest-provided special requests or notes';
COMMENT ON COLUMN digital_registration_cards.staff_notes IS 'Internal staff notes about the registration';

\echo 'digital_registration_cards table created successfully!'
