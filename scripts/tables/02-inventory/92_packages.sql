-- =============================================
-- Packages Table
-- =============================================
-- Description: Room and service packages/bundles
-- Dependencies: tenants, properties
-- Category: Revenue Management
-- =============================================

CREATE TABLE IF NOT EXISTS packages (
    -- Primary Key
    package_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Package Information
    package_name VARCHAR(255) NOT NULL,
    package_code VARCHAR(50) UNIQUE NOT NULL,
    package_type VARCHAR(50) NOT NULL CHECK (package_type IN (
        'room_only',
        'bed_and_breakfast',
        'half_board',
        'full_board',
        'all_inclusive',
        'romance',
        'spa',
        'golf',
        'ski',
        'family',
        'business',
        'weekend_getaway',
        'extended_stay',
        'seasonal',
        'custom'
    )),

    -- Description & Marketing
    short_description VARCHAR(500),
    full_description TEXT,
    marketing_description TEXT,
    terms_and_conditions TEXT,

    -- Validity Period
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL,
    blackout_dates DATE[],

    -- Booking Requirements
    min_nights INTEGER DEFAULT 1,
    max_nights INTEGER,
    min_advance_booking_days INTEGER DEFAULT 0,
    max_advance_booking_days INTEGER,
    min_guests INTEGER DEFAULT 1,
    max_guests INTEGER,

    -- Pricing
    pricing_model VARCHAR(50) NOT NULL CHECK (pricing_model IN (
        'per_night',
        'per_stay',
        'per_person',
        'per_person_per_night',
        'flat_rate',
        'tiered'
    )),
    base_price DECIMAL(10,2) NOT NULL,
    adult_price DECIMAL(10,2),
    child_price DECIMAL(10,2),
    extra_person_charge DECIMAL(10,2),
    single_supplement DECIMAL(10,2),

    -- Discount & Commission
    discount_percentage DECIMAL(5,2) DEFAULT 0.00,
    commissionable BOOLEAN DEFAULT TRUE,
    commission_percentage DECIMAL(5,2),

    -- Days of Week Restrictions
    available_monday BOOLEAN DEFAULT TRUE,
    available_tuesday BOOLEAN DEFAULT TRUE,
    available_wednesday BOOLEAN DEFAULT TRUE,
    available_thursday BOOLEAN DEFAULT TRUE,
    available_friday BOOLEAN DEFAULT TRUE,
    available_saturday BOOLEAN DEFAULT TRUE,
    available_sunday BOOLEAN DEFAULT TRUE,

    -- Room Type Restrictions
    applicable_room_types UUID[], -- Array of room_type IDs
    all_room_types BOOLEAN DEFAULT FALSE,

    -- Channel Restrictions
    available_channels VARCHAR(50)[] DEFAULT ARRAY['all'], -- 'direct', 'ota', 'phone', etc.

    -- Cancellation Policy
    cancellation_policy_id UUID,
    refundable BOOLEAN DEFAULT TRUE,
    free_cancellation_days INTEGER,
    cancellation_fee_percentage DECIMAL(5,2),

    -- Inventory Control
    total_inventory INTEGER,
    sold_count INTEGER DEFAULT 0,
    available_inventory INTEGER GENERATED ALWAYS AS (COALESCE(total_inventory, 999999) - sold_count) STORED,

    -- Package Features
    includes_breakfast BOOLEAN DEFAULT FALSE,
    includes_lunch BOOLEAN DEFAULT FALSE,
    includes_dinner BOOLEAN DEFAULT FALSE,
    includes_parking BOOLEAN DEFAULT FALSE,
    includes_wifi BOOLEAN DEFAULT FALSE,
    includes_airport_transfer BOOLEAN DEFAULT FALSE,

    -- Marketing & Display
    featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    image_urls TEXT[],
    highlight_color VARCHAR(20),
    badge_text VARCHAR(50), -- e.g., "BEST VALUE", "POPULAR"

    -- Tags & Categories
    tags TEXT[],
    categories TEXT[],
    target_audience VARCHAR(50)[], -- 'couples', 'families', 'business', etc.

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_published BOOLEAN DEFAULT FALSE,
    require_approval BOOLEAN DEFAULT FALSE,

    -- Performance Metrics
    total_bookings INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    average_rating DECIMAL(2,1),
    conversion_rate DECIMAL(5,2),

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    version BIGINT DEFAULT 0,

    -- Constraints
    CHECK (valid_from < valid_to),
    CHECK (base_price >= 0),
    CHECK (min_nights <= COALESCE(max_nights, 999))
);

-- =============================================
-- Package Components Table
-- =============================================

CREATE TABLE IF NOT EXISTS package_components (
    -- Primary Key
    component_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Foreign Key
    package_id UUID NOT NULL REFERENCES packages(package_id) ON DELETE CASCADE,

    -- Component Details
    component_type VARCHAR(50) NOT NULL CHECK (component_type IN (
        'service',
        'amenity',
        'meal',
        'activity',
        'transportation',
        'upgrade',
        'credit',
        'voucher',
        'other'
    )),
    component_name VARCHAR(255) NOT NULL,
    component_description TEXT,

    -- Reference
    service_id UUID, -- FK to services(id) - constraint added in constraints phase
    external_reference VARCHAR(100),

    -- Quantity & Timing
    quantity INTEGER DEFAULT 1,
    pricing_type VARCHAR(50) NOT NULL CHECK (pricing_type IN (
        'per_night',
        'per_stay',
        'per_person',
        'per_person_per_night',
        'once',
        'daily',
        'included'
    )),

    -- Pricing
    unit_price DECIMAL(10,2) DEFAULT 0.00,
    is_included BOOLEAN DEFAULT TRUE,
    is_optional BOOLEAN DEFAULT FALSE,
    additional_charge DECIMAL(10,2),

    -- Scheduling
    delivery_timing VARCHAR(50) CHECK (delivery_timing IN (
        'on_arrival',
        'on_departure',
        'daily',
        'specific_date',
        'on_request',
        'anytime'
    )),
    delivery_location VARCHAR(255),

    -- Display
    display_order INTEGER DEFAULT 0,
    highlight BOOLEAN DEFAULT FALSE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_mandatory BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- =============================================
-- Package Bookings Table
-- =============================================

CREATE TABLE IF NOT EXISTS package_bookings (
    -- Primary Key
    package_booking_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Foreign Keys
    package_id UUID NOT NULL REFERENCES packages(package_id) ON DELETE RESTRICT,
    reservation_id UUID NOT NULL, -- FK to reservations(id) ON DELETE CASCADE - constraint added in constraints phase

    -- Booking Details
    package_price DECIMAL(10,2) NOT NULL,
    number_of_nights INTEGER NOT NULL,
    number_of_adults INTEGER NOT NULL,
    number_of_children INTEGER DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,

    -- Component Selections
    selected_components JSONB, -- Optional components selected
    component_modifications JSONB, -- Any changes to default components

    -- Redemption Tracking
    components_delivered JSONB, -- Track which components have been delivered
    fully_delivered BOOLEAN DEFAULT FALSE,

    -- Status
    status VARCHAR(50) DEFAULT 'confirmed' CHECK (status IN (
        'pending',
        'confirmed',
        'checked_in',
        'checked_out',
        'cancelled'
    )),

    -- Notes
    special_requests TEXT,
    notes TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);


COMMENT ON TABLE packages IS 'Defines bundled room and service packages (e.g., B&B, All-Inclusive, Romance packages)';
COMMENT ON TABLE package_components IS 'Individual services and amenities included in each package';
COMMENT ON TABLE package_bookings IS 'Links reservations to packages and tracks component delivery';
COMMENT ON COLUMN packages.pricing_model IS 'How the package is priced: per night, per stay, per person, etc.';
COMMENT ON COLUMN package_components.is_included IS 'Whether the component is included in base price or additional charge';
