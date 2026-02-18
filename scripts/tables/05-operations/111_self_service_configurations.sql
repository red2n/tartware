-- =====================================================
-- 111_self_service_configurations.sql
-- Self-Service Configuration Table
-- Industry Standard: Guest-facing module configuration
-- Pattern: Per-property feature toggles for mobile check-in,
--          digital keys, direct booking, and registration cards
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- SELF_SERVICE_CONFIGURATIONS TABLE
-- Property-level configuration for guest-facing self-service
-- modules: mobile check-in, digital keys, direct booking,
-- registration cards, and contactless requests
-- =====================================================

CREATE TABLE IF NOT EXISTS self_service_configurations (
    -- Primary Key
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),    -- Unique configuration identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                  -- FK tenants.id
    property_id UUID NOT NULL,                                -- FK properties.id (always property-scoped)

    -- Mobile Check-In
    mobile_checkin_enabled BOOLEAN DEFAULT FALSE,             -- Allow guests to check in via mobile
    mobile_checkin_window_hours INTEGER DEFAULT 24,           -- Hours before arrival when check-in opens
    mobile_checkin_require_id BOOLEAN DEFAULT TRUE,           -- Require ID verification for mobile check-in
    mobile_checkin_require_payment BOOLEAN DEFAULT TRUE,      -- Require payment on file for mobile check-in
    mobile_checkin_auto_assign_room BOOLEAN DEFAULT FALSE,    -- Auto-assign room on mobile check-in completion

    -- Digital Keys
    digital_keys_enabled BOOLEAN DEFAULT FALSE,               -- Allow mobile key issuance
    digital_keys_provider VARCHAR(50),                        -- Key vendor (ASSA_ABLOY, SALTO, DORMAKABA, etc.)
    digital_keys_max_per_reservation INTEGER DEFAULT 2,       -- Max keys per reservation
    digital_keys_auto_revoke_on_checkout BOOLEAN DEFAULT TRUE,-- Auto-revoke keys at checkout

    -- Direct Booking Engine
    booking_engine_enabled BOOLEAN DEFAULT FALSE,             -- Allow direct bookings from hotel website
    booking_engine_min_advance_hours INTEGER DEFAULT 4,       -- Minimum hours in advance for booking
    booking_engine_max_advance_days INTEGER DEFAULT 365,      -- Maximum days in advance for booking
    booking_engine_max_rooms_per_booking INTEGER DEFAULT 5,   -- Max rooms per single booking
    booking_engine_require_deposit BOOLEAN DEFAULT FALSE,     -- Require deposit at booking time
    booking_engine_deposit_percent DECIMAL(5,2),              -- Deposit percentage (if required)

    -- Registration Card
    registration_card_enabled BOOLEAN DEFAULT TRUE,           -- Generate digital registration cards
    registration_card_require_signature BOOLEAN DEFAULT TRUE, -- Require guest signature
    registration_card_include_terms BOOLEAN DEFAULT TRUE,     -- Include terms & conditions
    registration_card_custom_terms TEXT,                       -- Custom terms text (overrides default)

    -- Contactless Requests
    contactless_requests_enabled BOOLEAN DEFAULT FALSE,       -- Allow in-stay requests (towels, amenities)
    contactless_menu_enabled BOOLEAN DEFAULT FALSE,           -- Allow room service ordering

    -- Guest Communication Preferences
    send_pre_arrival_email BOOLEAN DEFAULT TRUE,              -- Pre-arrival email with self-service links
    pre_arrival_email_hours INTEGER DEFAULT 48,               -- Hours before arrival to send email

    -- Branding
    brand_logo_url VARCHAR(500),                              -- Logo URL for self-service pages
    brand_primary_color VARCHAR(7),                           -- Primary brand color
    brand_welcome_message TEXT,                               -- Custom welcome text

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                  -- Whether self-service is active for this property

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::JSONB,                       -- Extensible metadata

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT uq_self_service_config UNIQUE (tenant_id, property_id)
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE self_service_configurations IS 'Per-property configuration for guest-facing self-service modules (mobile check-in, keys, booking, registration)';
COMMENT ON COLUMN self_service_configurations.mobile_checkin_enabled IS 'Whether guests can check in via mobile device';
COMMENT ON COLUMN self_service_configurations.digital_keys_enabled IS 'Whether mobile key issuance is available';
COMMENT ON COLUMN self_service_configurations.digital_keys_provider IS 'Door lock vendor: ASSA_ABLOY, SALTO, DORMAKABA, ONITY, etc.';
COMMENT ON COLUMN self_service_configurations.booking_engine_enabled IS 'Whether direct booking widget is active on hotel website';
COMMENT ON COLUMN self_service_configurations.registration_card_enabled IS 'Whether digital registration cards are generated';
COMMENT ON COLUMN self_service_configurations.contactless_requests_enabled IS 'Whether in-stay contactless service requests are available';

\echo 'self_service_configurations table created successfully!'
