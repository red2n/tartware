-- =============================================
-- Packages Table
-- =============================================
-- Description: Room and service packages/bundles
-- Dependencies: tenants, properties
-- Category: Revenue Management
-- =============================================

CREATE TABLE IF NOT EXISTS packages (
    -- Primary Key
    package_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY, -- Unique package identifier

-- Multi-tenancy
tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE, -- Tenant ownership
property_id UUID REFERENCES properties (id) ON DELETE CASCADE, -- Optional property-specific package

-- Package Information
package_name VARCHAR(255) NOT NULL, -- Display name
package_code VARCHAR(50) UNIQUE NOT NULL, -- Booking reference code
package_type VARCHAR(50) NOT NULL CHECK (
    package_type IN (
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
    )
),

-- Description & Marketing
short_description VARCHAR(500), -- Brief overview
full_description TEXT, -- Detailed package description
marketing_description TEXT, -- Promotional content
terms_and_conditions TEXT, -- Usage terms

-- Validity Period
valid_from DATE NOT NULL, -- Start date
valid_to DATE NOT NULL, -- End date
blackout_dates DATE[], -- Array of excluded dates

-- Booking Requirements
min_nights INTEGER DEFAULT 1, -- Minimum LOS requirement
max_nights INTEGER, -- Maximum LOS allowed
min_advance_booking_days INTEGER DEFAULT 0, -- Minimum lead-time
max_advance_booking_days INTEGER, -- Maximum lead-time
min_guests INTEGER DEFAULT 1, -- Minimum guests covered
max_guests INTEGER, -- Maximum guests allowed

-- Pricing
pricing_model VARCHAR(50) NOT NULL CHECK (
    pricing_model IN (
        'per_night',
        'per_stay',
        'per_person',
        'per_person_per_night',
        'flat_rate',
        'tiered'
    )
),
base_price DECIMAL(10, 2) NOT NULL, -- Primary package price
adult_price DECIMAL(10, 2), -- Override per adult
child_price DECIMAL(10, 2), -- Override per child
extra_person_charge DECIMAL(10, 2), -- Additional guest charge
single_supplement DECIMAL(10, 2), -- Solo traveler surcharge

-- Discount & Commission
discount_percentage DECIMAL(5, 2) DEFAULT 0.00, -- Promotional discount
discount_amount DECIMAL(10, 2) DEFAULT 0.00, -- Fixed discount amount
commissionable BOOLEAN DEFAULT TRUE, -- Is package commissionable
commission_percentage DECIMAL(5, 2), -- Commission rate if applicable

-- Days of Week Restrictions
available_monday BOOLEAN DEFAULT TRUE, -- Availability on Monday
available_tuesday BOOLEAN DEFAULT TRUE, -- Availability on Tuesday
available_wednesday BOOLEAN DEFAULT TRUE, -- Availability on Wednesday
available_thursday BOOLEAN DEFAULT TRUE, -- Availability on Thursday
available_friday BOOLEAN DEFAULT TRUE, -- Availability on Friday
available_saturday BOOLEAN DEFAULT TRUE, -- Availability on Saturday
available_sunday BOOLEAN DEFAULT TRUE, -- Availability on Sunday

-- Room Type Restrictions
applicable_room_types UUID [], -- Specific room type applicability
all_room_types BOOLEAN DEFAULT FALSE, -- True when valid for all types

-- Channel Restrictions
available_channels VARCHAR(50) [] DEFAULT ARRAY['all'], -- 'direct', 'ota', 'phone', etc.

-- Cancellation Policy
cancellation_policy_id UUID, -- Linked policy (if separate table)
refundable BOOLEAN DEFAULT TRUE, -- Is cancellation allowed
free_cancellation_days INTEGER, -- Days before stay with free cancel
cancellation_fee_percentage DECIMAL(5, 2), -- Cancellation penalty

-- Inventory Control
total_inventory INTEGER, -- Limited allotment for package
sold_count INTEGER DEFAULT 0, -- Units sold
available_inventory INTEGER GENERATED ALWAYS AS (
    COALESCE(total_inventory, 999999) - sold_count
) STORED, -- Current availability

-- Package Features
includes_breakfast BOOLEAN DEFAULT FALSE, -- Meal inclusions
includes_lunch BOOLEAN DEFAULT FALSE, -- Meal inclusions
includes_dinner BOOLEAN DEFAULT FALSE, -- Meal inclusions
includes_parking BOOLEAN DEFAULT FALSE, -- Parking inclusion
includes_wifi BOOLEAN DEFAULT FALSE, -- WiFi inclusion
includes_airport_transfer BOOLEAN DEFAULT FALSE, -- Airport transfer inclusion

-- Marketing & Display
featured BOOLEAN DEFAULT FALSE, -- Highlight on storefront
display_order INTEGER DEFAULT 0, -- Ordering weight
image_urls TEXT [], -- Marketing assets
highlight_color VARCHAR(20), -- UI highlight color
badge_text VARCHAR(50), -- e.g., "BEST VALUE", "POPULAR"

-- Tags & Categories
tags TEXT [], -- Search keywords
categories TEXT [], -- e.g., 'luxury', 'budget', 'adventure'
target_audience VARCHAR(50) [], -- 'couples', 'families', 'business', etc.

-- Status
is_active BOOLEAN DEFAULT TRUE, -- Availability status
is_published BOOLEAN DEFAULT FALSE, -- Visible to customers
is_featured BOOLEAN DEFAULT FALSE, -- Highlighted package
require_approval BOOLEAN DEFAULT FALSE, -- Needs managerial approval

-- Performance Metrics
total_bookings INTEGER DEFAULT 0, -- Cumulative bookings
total_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Revenue attributed
average_rating DECIMAL(2, 1), -- Guest feedback average
conversion_rate DECIMAL(5, 2), -- Conversion percent

-- Notes
notes TEXT, -- General notes
internal_notes TEXT, -- Internal use only

-- Audit Fields
created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
created_by UUID REFERENCES users (id), -- Creator user reference
updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
updated_by UUID REFERENCES users (id), -- Last updater user reference
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP WITHOUT TIME ZONE, -- Deletion timestamp
deleted_by UUID REFERENCES users (id), -- Deleter user reference
version BIGINT DEFAULT 0, -- Optimistic locking

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
    component_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY, -- Unique component identifier

-- Foreign Key
package_id UUID NOT NULL REFERENCES packages (package_id) ON DELETE CASCADE, -- Parent package

-- Component Details
component_type VARCHAR(50) NOT NULL CHECK (
    component_type IN (
        'service',
        'amenity',
        'meal',
        'activity',
        'transportation',
        'upgrade',
        'credit',
        'voucher',
        'other'
    )
),
component_name VARCHAR(255) NOT NULL, -- Display name
component_description TEXT, -- Detailed description

-- Reference
service_id UUID, -- FK to services(id) - constraint added in constraints phase
external_reference VARCHAR(100),

-- Quantity & Timing
quantity INTEGER DEFAULT 1, -- Included quantity per stay
pricing_type VARCHAR(50) NOT NULL CHECK (
    pricing_type IN (
        'per_night',
        'per_stay',
        'per_person',
        'per_person_per_night',
        'once',
        'daily',
        'included'
    )
),

-- Pricing
unit_price DECIMAL(10, 2) DEFAULT 0.00, -- Standalone price
is_included BOOLEAN DEFAULT TRUE, -- Included vs add-on
is_optional BOOLEAN DEFAULT FALSE, -- Allow guest to opt-in
additional_charge DECIMAL(10, 2),

-- Scheduling
delivery_timing VARCHAR(50) CHECK (
    delivery_timing IN (
        'on_arrival',
        'on_departure',
        'daily',
        'specific_date',
        'on_request',
        'anytime'
    )
),
delivery_location VARCHAR(255),

-- Display
display_order INTEGER DEFAULT 0, highlight BOOLEAN DEFAULT FALSE,

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
package_id UUID NOT NULL REFERENCES packages (package_id) ON DELETE RESTRICT,
reservation_id UUID NOT NULL, -- FK to reservations(id) ON DELETE CASCADE - constraint added in constraints phase

-- Booking Details
package_price DECIMAL(10, 2) NOT NULL,
number_of_nights INTEGER NOT NULL,
number_of_adults INTEGER NOT NULL,
number_of_children INTEGER DEFAULT 0,
total_amount DECIMAL(12, 2) NOT NULL,

-- Component Selections
selected_components JSONB, -- Optional components selected
component_modifications JSONB, -- Any changes to default components

-- Redemption Tracking
components_delivered JSONB, -- Track which components have been delivered
fully_delivered BOOLEAN DEFAULT FALSE,

-- Status
status VARCHAR(50) DEFAULT 'confirmed' CHECK (
    status IN (
        'pending',
        'confirmed',
        'checked_in',
        'checked_out',
        'cancelled'
    )
),

-- Notes
special_requests TEXT, notes TEXT,

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
