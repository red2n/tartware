-- =============================================
-- Group Bookings Table
-- =============================================
-- Description: Manages group reservations, blocks, and rooming lists
-- Dependencies: tenants, properties, companies, users
-- Category: Group & Events Management
-- =============================================

CREATE TABLE IF NOT EXISTS group_bookings (
    -- Primary Key
    group_booking_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Group Identification
    group_name VARCHAR(255) NOT NULL,
    group_code VARCHAR(50) UNIQUE,
    group_type VARCHAR(50) NOT NULL CHECK (group_type IN (
        'conference',
        'wedding',
        'corporate',
        'tour_group',
        'sports_team',
        'reunion',
        'convention',
        'government',
        'airline_crew',
        'educational',
        'other'
    )),

    -- Company/Contact Information
    company_id UUID REFERENCES companies(company_id),
    organization_name VARCHAR(255),
    event_name VARCHAR(255),
    event_type VARCHAR(100),

    -- Contact Person
    contact_name VARCHAR(255) NOT NULL,
    contact_title VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    contact_mobile VARCHAR(50),
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255),

    -- Booking Details
    arrival_date DATE NOT NULL,
    departure_date DATE NOT NULL,
    number_of_nights INTEGER GENERATED ALWAYS AS (departure_date - arrival_date) STORED,
    total_rooms_requested INTEGER NOT NULL,
    total_rooms_blocked INTEGER DEFAULT 0,
    total_rooms_picked INTEGER DEFAULT 0,
    total_rooms_confirmed INTEGER DEFAULT 0,

    -- Cutoff & Release
    cutoff_date DATE NOT NULL,
    cutoff_days_before_arrival INTEGER,
    release_unsold_rooms BOOLEAN DEFAULT TRUE,

    -- Room Block Status
    block_status VARCHAR(50) DEFAULT 'tentative' CHECK (block_status IN (
        'inquiry',
        'tentative',
        'definite',
        'confirmed',
        'partial',
        'cancelled',
        'completed'
    )),

    -- Rooming List
    rooming_list_received BOOLEAN DEFAULT FALSE,
    rooming_list_received_date DATE,
    rooming_list_deadline DATE,
    rooming_list_format VARCHAR(50) CHECK (rooming_list_format IN (
        'excel',
        'csv',
        'pdf',
        'portal',
        'api',
        'email'
    )),

    -- Financial Information
    master_folio_id UUID REFERENCES folios(folio_id),
    payment_method VARCHAR(50) CHECK (payment_method IN (
        'direct_bill',
        'credit_card',
        'deposit',
        'prepaid',
        'individual_pay',
        'mixed'
    )),
    deposit_amount DECIMAL(12,2) DEFAULT 0.00,
    deposit_percentage DECIMAL(5,2),
    deposit_due_date DATE,
    deposit_received BOOLEAN DEFAULT FALSE,
    deposit_received_date DATE,

    -- Rate Information
    rate_type VARCHAR(50) CHECK (rate_type IN (
        'group_rate',
        'negotiated',
        'contracted',
        'special',
        'rack'
    )),
    commissionable BOOLEAN DEFAULT FALSE,
    commission_percentage DECIMAL(5,2),

    -- Amenities & Services
    complimentary_rooms INTEGER DEFAULT 0,
    complimentary_ratio VARCHAR(20), -- e.g., "1:50" (1 comp per 50 rooms)
    meeting_space_required BOOLEAN DEFAULT FALSE,
    catering_required BOOLEAN DEFAULT FALSE,
    av_equipment_required BOOLEAN DEFAULT FALSE,

    -- Special Requests
    special_requests TEXT,
    dietary_restrictions TEXT,
    accessibility_requirements TEXT,
    vip_requirements TEXT,

    -- Expected Guest Profile
    expected_arrival_pattern JSONB, -- Time distribution of arrivals
    expected_departure_pattern JSONB, -- Time distribution of departures
    average_length_of_stay DECIMAL(3,1),

    -- Revenue Forecast
    estimated_room_revenue DECIMAL(12,2),
    estimated_fb_revenue DECIMAL(12,2), -- Food & Beverage
    estimated_meeting_revenue DECIMAL(12,2),
    estimated_total_revenue DECIMAL(12,2),
    actual_revenue DECIMAL(12,2) DEFAULT 0.00,

    -- Assignment & Ownership
    account_manager_id UUID REFERENCES users(id),
    sales_manager_id UUID REFERENCES users(id),
    booking_source VARCHAR(100),

    -- Contract & Documentation
    contract_signed BOOLEAN DEFAULT FALSE,
    contract_signed_date DATE,
    contract_document_url VARCHAR(500),
    beo_created BOOLEAN DEFAULT FALSE, -- Banquet Event Order
    beo_document_url VARCHAR(500),

    -- Cancellation Policy
    cancellation_policy TEXT,
    cancellation_deadline DATE,
    cancellation_penalty_percentage DECIMAL(5,2),
    cancellation_fee DECIMAL(10,2),

    -- Status & Tracking
    confirmation_number VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    booking_confidence VARCHAR(20) CHECK (booking_confidence IN (
        'very_low',
        'low',
        'medium',
        'high',
        'very_high',
        'confirmed'
    )),

    -- Notes
    notes TEXT,
    internal_notes TEXT,
    catering_notes TEXT,
    housekeeping_notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    deleted_by UUID REFERENCES users(id),
    version BIGINT DEFAULT 0
);

-- =============================================
-- Group Room Blocks Table
-- =============================================

CREATE TABLE IF NOT EXISTS group_room_blocks (
    -- Primary Key
    block_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Foreign Keys
    group_booking_id UUID NOT NULL REFERENCES group_bookings(group_booking_id) ON DELETE CASCADE,
    room_type_id UUID NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,

    -- Block Details
    block_date DATE NOT NULL,
    blocked_rooms INTEGER NOT NULL DEFAULT 0,
    picked_rooms INTEGER DEFAULT 0,
    confirmed_rooms INTEGER DEFAULT 0,
    available_rooms INTEGER GENERATED ALWAYS AS (blocked_rooms - picked_rooms) STORED,

    -- Pricing
    negotiated_rate DECIMAL(10,2) NOT NULL,
    rack_rate DECIMAL(10,2),
    discount_percentage DECIMAL(5,2),

    -- Status
    block_status VARCHAR(50) DEFAULT 'active' CHECK (block_status IN (
        'pending',
        'active',
        'released',
        'sold_out',
        'cancelled'
    )),
    released_date DATE,
    released_by UUID REFERENCES users(id),

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),

    -- Constraints
    UNIQUE (group_booking_id, room_type_id, block_date),
    CHECK (picked_rooms <= blocked_rooms),
    CHECK (confirmed_rooms <= picked_rooms)
);

-- =============================================
-- Indexes
-- =============================================

CREATE INDEX idx_group_bookings_tenant ON group_bookings(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_group_bookings_property ON group_bookings(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_group_bookings_dates ON group_bookings(arrival_date, departure_date) WHERE is_active = TRUE;
CREATE INDEX idx_group_bookings_cutoff ON group_bookings(cutoff_date) WHERE block_status IN ('tentative', 'definite');
CREATE INDEX idx_group_bookings_status ON group_bookings(block_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_group_bookings_company ON group_bookings(company_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_group_bookings_code ON group_bookings(group_code) WHERE is_deleted = FALSE;

CREATE INDEX idx_group_room_blocks_booking ON group_room_blocks(group_booking_id);
CREATE INDEX idx_group_room_blocks_date ON group_room_blocks(block_date, block_status);
CREATE INDEX idx_group_room_blocks_room_type ON group_room_blocks(room_type_id);
CREATE INDEX idx_group_room_blocks_availability ON group_room_blocks(block_date) WHERE blocked_rooms > picked_rooms;

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE group_bookings IS 'Manages group reservations, corporate bookings, and event blocks';
COMMENT ON TABLE group_room_blocks IS 'Room inventory blocks allocated to group bookings by date and room type';
COMMENT ON COLUMN group_bookings.cutoff_date IS 'Date by which unsold rooms are released back to inventory';
COMMENT ON COLUMN group_bookings.rooming_list_received IS 'Indicates if individual guest names have been provided';
COMMENT ON COLUMN group_room_blocks.picked_rooms IS 'Number of rooms from the block that have been reserved';
