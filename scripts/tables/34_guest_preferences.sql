-- =====================================================
-- 34_guest_preferences.sql
-- Guest Stay Preferences & Profile
--
-- Purpose: Store guest preferences for personalization
-- Industry Standard: OPERA (GUEST_PREFERENCES), Cloudbeds (preferences),
--                    Protel (GAST_PRAEFERENZEN), RMS (guest_profile)
--
-- Use Cases:
-- - Room preferences (floor, bed type, view)
-- - Service preferences (newspapers, turndown)
-- - Dietary restrictions
-- - Accessibility needs
-- - Communication preferences
--
-- Enables personalized service and repeat guest recognition
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS guest_preferences CASCADE;

CREATE TABLE guest_preferences (
    -- Primary Key
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID, -- NULL for guest-wide preferences

    -- Guest Association
    guest_id UUID NOT NULL,

    -- Preference Category
    preference_category VARCHAR(50) NOT NULL
        CHECK (preference_category IN ('ROOM', 'SERVICE', 'DIETARY', 'ACCESSIBILITY', 'COMMUNICATION', 'BILLING', 'AMENITY', 'EXPERIENCE', 'OTHER')),
    preference_type VARCHAR(100) NOT NULL, -- Specific preference type

    -- Preference Value
    preference_value TEXT, -- The actual preference
    preference_code VARCHAR(50), -- Coded value if applicable
    preference_options JSONB, -- Multiple choice options

    -- Priority
    priority INTEGER DEFAULT 0, -- Higher = more important
    is_mandatory BOOLEAN DEFAULT FALSE, -- Must be honored
    is_special_request BOOLEAN DEFAULT FALSE,

    -- Room Preferences
    preferred_floor INTEGER,
    floor_preference VARCHAR(20), -- HIGH, LOW, MIDDLE
    preferred_room_type_id UUID,
    preferred_room_numbers TEXT[], -- Specific room numbers
    avoid_room_numbers TEXT[], -- Rooms to avoid

    bed_type_preference VARCHAR(30), -- KING, QUEEN, TWIN, DOUBLE
    smoking_preference VARCHAR(20) DEFAULT 'NON_SMOKING'
        CHECK (smoking_preference IN ('SMOKING', 'NON_SMOKING', 'NO_PREFERENCE')),

    view_preference VARCHAR(30), -- OCEAN, CITY, GARDEN, MOUNTAIN, POOL
    room_location_preference VARCHAR(30), -- QUIET, ELEVATOR_CLOSE, ELEVATOR_FAR

    connecting_rooms BOOLEAN DEFAULT FALSE,
    adjacent_rooms BOOLEAN DEFAULT FALSE,

    -- Service Preferences
    newspaper_preference VARCHAR(100),
    turndown_service BOOLEAN DEFAULT TRUE,
    do_not_disturb_default BOOLEAN DEFAULT FALSE,
    wake_up_call_preference TIME,

    -- Amenity Preferences
    pillow_type VARCHAR(50), -- FIRM, SOFT, FOAM, HYPOALLERGENIC
    extra_pillows INTEGER,
    extra_blankets INTEGER,
    mini_bar_stocked BOOLEAN,
    mini_bar_preferences TEXT[],
    room_temperature_celsius DECIMAL(4, 1),

    -- Dietary Restrictions
    dietary_restrictions TEXT[],
    food_allergies TEXT[],
    preferred_cuisine TEXT[],
    dislikes TEXT[],

    -- Accessibility Needs
    mobility_accessible BOOLEAN DEFAULT FALSE,
    hearing_accessible BOOLEAN DEFAULT FALSE,
    visual_accessible BOOLEAN DEFAULT FALSE,
    service_animal BOOLEAN DEFAULT FALSE,
    accessibility_notes TEXT,

    -- Communication Preferences
    preferred_language VARCHAR(10), -- ISO language code
    preferred_contact_method VARCHAR(30)
        CHECK (preferred_contact_method IN ('EMAIL', 'PHONE', 'SMS', 'MAIL', 'WHATSAPP', 'NO_CONTACT')),
    preferred_contact_time VARCHAR(30), -- MORNING, AFTERNOON, EVENING

    marketing_opt_in BOOLEAN DEFAULT FALSE,
    newsletter_opt_in BOOLEAN DEFAULT FALSE,
    sms_opt_in BOOLEAN DEFAULT FALSE,

    -- Billing Preferences
    preferred_payment_method VARCHAR(30),
    split_billing BOOLEAN DEFAULT FALSE,
    itemized_invoice BOOLEAN DEFAULT TRUE,
    email_invoice BOOLEAN DEFAULT TRUE,

    -- Experience Preferences
    check_in_preference VARCHAR(30), -- EARLY, STANDARD, LATE, MOBILE
    check_out_preference VARCHAR(30), -- EARLY, STANDARD, LATE, EXPRESS

    occasions TEXT[], -- BIRTHDAY, ANNIVERSARY, HONEYMOON, BUSINESS
    celebration_dates JSONB, -- {occasion: date}

    -- Companion Preferences
    traveling_with VARCHAR(30), -- FAMILY, PARTNER, SOLO, BUSINESS, PETS
    number_of_children INTEGER,
    children_ages INTEGER[],
    has_pets BOOLEAN DEFAULT FALSE,
    pet_type VARCHAR(50),

    -- Frequency
    frequency VARCHAR(20) DEFAULT 'ALWAYS'
        CHECK (frequency IN ('ALWAYS', 'USUALLY', 'SOMETIMES', 'RARELY', 'ONCE')),

    -- Validity
    is_active BOOLEAN DEFAULT TRUE,
    valid_from DATE,
    valid_until DATE,

    -- Source
    source VARCHAR(50), -- GUEST_PROVIDED, STAFF_OBSERVED, IMPORTED, INFERRED
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    collected_by UUID, -- Staff member who recorded
    last_honored_at TIMESTAMP,
    times_honored INTEGER DEFAULT 0,

    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    verified_by UUID,

    -- Notes
    notes TEXT,
    internal_notes TEXT, -- Not shown to guest

    -- Metadata
    metadata JSONB,

    -- Soft delete
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    -- Priority validation
    CONSTRAINT chk_guest_preferences_priority
        CHECK (priority >= 0 AND priority <= 10),

    -- Floor validation
    CONSTRAINT chk_guest_preferences_floor
        CHECK (
            preferred_floor IS NULL OR
            preferred_floor >= 0
        ),

    -- Temperature validation
    CONSTRAINT chk_guest_preferences_temp
        CHECK (
            room_temperature_celsius IS NULL OR
            (room_temperature_celsius >= 15 AND room_temperature_celsius <= 30)
        )
);

-- Add table comment
COMMENT ON TABLE guest_preferences IS 'Guest stay preferences and profile for personalization. Room, service, dietary, accessibility, and communication preferences.';

-- Add column comments
COMMENT ON COLUMN guest_preferences.preference_category IS 'ROOM, SERVICE, DIETARY, ACCESSIBILITY, COMMUNICATION, BILLING, AMENITY, EXPERIENCE, OTHER';
COMMENT ON COLUMN guest_preferences.priority IS '0-10, higher = more important to guest';
COMMENT ON COLUMN guest_preferences.is_mandatory IS 'TRUE if this must be honored (e.g., severe allergy)';
COMMENT ON COLUMN guest_preferences.frequency IS 'How often this preference applies: ALWAYS, USUALLY, SOMETIMES, RARELY, ONCE';
COMMENT ON COLUMN guest_preferences.source IS 'Where preference came from: GUEST_PROVIDED, STAFF_OBSERVED, IMPORTED, INFERRED';
COMMENT ON COLUMN guest_preferences.times_honored IS 'Count of how many times this preference was fulfilled';
COMMENT ON COLUMN guest_preferences.mobility_accessible IS 'Requires wheelchair-accessible room';
COMMENT ON COLUMN guest_preferences.dietary_restrictions IS 'Array of dietary needs (vegetarian, vegan, gluten-free, etc.)';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_guest_preferences_guest ON guest_preferences(guest_id, preference_category) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_guest_preferences_property ON guest_preferences(property_id, guest_id) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_guest_preferences_active ON guest_preferences(guest_id, is_active) WHERE is_active = TRUE;
-- CREATE INDEX idx_guest_preferences_category ON guest_preferences(preference_category, is_mandatory);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON guest_preferences TO tartware_app;

-- Success message
\echo '✓ Table created: guest_preferences (34/37)'
\echo '  - Guest personalization'
\echo '  - Stay preferences'
\echo '  - Accessibility needs'
\echo ''
