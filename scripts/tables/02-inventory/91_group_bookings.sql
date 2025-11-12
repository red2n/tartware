-- =============================================
-- Group Bookings Table
-- =============================================
-- Description: Manages group reservations, blocks, and rooming lists
-- Dependencies: tenants, properties, companies, users
-- Category: Group & Events Management
-- =============================================

CREATE TABLE IF NOT EXISTS group_bookings (
    -- Primary Key
    group_booking_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY, -- Unique group booking identifier

-- Multi-tenancy
tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE, -- Tenant scope
property_id UUID NOT NULL REFERENCES properties (id) ON DELETE CASCADE, -- Property scope

-- Group Identification
group_name VARCHAR(255) NOT NULL, -- Event/group reference name
group_code VARCHAR(50) UNIQUE, -- Internal booking code
group_type VARCHAR(50) NOT NULL CHECK (
    group_type IN (
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
    )
),

-- Company/Contact Information
company_id UUID REFERENCES companies (company_id), -- Linked company account
organization_name VARCHAR(255), -- Organization hosting event
event_name VARCHAR(255), -- Marketing/event name
event_type VARCHAR(100), -- Additional classification

-- Contact Person
contact_name VARCHAR(255) NOT NULL, -- Primary point of contact
contact_title VARCHAR(100), -- Contact's job title
contact_email VARCHAR(255), -- Contact email address
contact_phone VARCHAR(50), -- Contact phone number
contact_mobile VARCHAR(50), -- Contact mobile number
contact_fax VARCHAR(50), -- Contact fax number
billing_contact_name VARCHAR(255), -- Accounts payable contact
billing_contact_email VARCHAR(255), -- Billing email address
billing_contact_phone VARCHAR(50), -- Billing phone number

-- Booking Details
arrival_date DATE NOT NULL, -- Group arrival date
departure_date DATE NOT NULL, -- Group departure date
number_of_nights INTEGER GENERATED ALWAYS AS (departure_date - arrival_date) STORED, -- Calculated LOS
total_rooms_requested INTEGER NOT NULL, -- Requested inventory
total_rooms_blocked INTEGER DEFAULT 0, -- Rooms currently blocked
total_rooms_picked INTEGER DEFAULT 0, -- Rooms currently picked up
total_rooms_confirmed INTEGER DEFAULT 0, -- Rooms contracted/confirmed

-- Cutoff & Release
cutoff_date DATE NOT NULL, -- Release date for unused rooms
cutoff_days_before_arrival INTEGER, -- Days prior for cutoff reference
release_unsold_rooms BOOLEAN DEFAULT TRUE, -- Auto release flag

-- Room Block Status
block_status VARCHAR(50) DEFAULT 'tentative' CHECK (
    block_status IN (
        'inquiry',
        'tentative',
        'definite',
        'confirmed',
        'partial',
        'cancelled',
        'completed'
    )
), -- Overall block status

-- Rooming List
rooming_list_received BOOLEAN DEFAULT FALSE, -- Rooming list on file
rooming_list_received_date DATE, -- Date rooming list received
rooming_list_deadline DATE, -- Deadline for final list
rooming_list_format VARCHAR(50) CHECK (
    rooming_list_format IN (
        'excel',
        'csv',
        'pdf',
        'portal',
        'api',
        'email'
    )
),

-- Financial Information
master_folio_id UUID, -- FK to folios(folio_id) - constraint added in constraints phase
payment_method VARCHAR(50) CHECK (
    payment_method IN (
        'direct_bill',
        'credit_card',
        'deposit',
        'prepaid',
        'individual_pay',
        'mixed'
    )
), -- Payment arrangement
deposit_amount DECIMAL(12, 2) DEFAULT 0.00, -- Deposit value
deposit_percentage DECIMAL(5, 2), -- Deposit % of total
deposit_due_date DATE, -- Deposit deadline
deposit_received BOOLEAN DEFAULT FALSE, -- Deposit status flag
deposit_received_date DATE, -- Date deposit received

-- Rate Information
rate_type VARCHAR(50) CHECK (
    rate_type IN (
        'group_rate',
        'negotiated',
        'contracted',
        'special',
        'rack'
    )
), -- Rate classification
negotiated_rate DECIMAL(10, 2), -- Agreed group rate
rack_rate DECIMAL(10, 2), -- Standard rack rate
discount_percentage DECIMAL(5, 2), -- Discount vs rack rate
commissionable BOOLEAN DEFAULT FALSE, -- Is the booking commissionable
commission_percentage DECIMAL(5, 2), -- Commission rate if applicable

-- Amenities & Services
complimentary_rooms INTEGER DEFAULT 0, -- Comp room count
complimentary_ratio VARCHAR(20), -- e.g., "1:50" (1 comp per 50 rooms)
meeting_space_required BOOLEAN DEFAULT FALSE, -- Meeting space needed
catering_required BOOLEAN DEFAULT FALSE, -- Catering services needed
av_equipment_required BOOLEAN DEFAULT FALSE, -- AV equipment needed
shuttle_service_required BOOLEAN DEFAULT FALSE, -- Shuttle service needed

-- Special Requests
special_requests TEXT, -- General special requests
dietary_restrictions TEXT, -- Dietary needs
accessibility_requirements TEXT, -- Accessibility needs
vip_requirements TEXT, -- VIP guest needs

-- Expected Guest Profile
expected_arrival_pattern JSONB, -- Time distribution of arrivals
expected_departure_pattern JSONB, -- Time distribution of departures
average_length_of_stay DECIMAL(3, 1), -- Avg stay length for group

-- Revenue Forecast
estimated_room_revenue DECIMAL(12, 2), -- Room revenue
estimated_fb_revenue DECIMAL(12, 2), -- Food & Beverage
estimated_meeting_revenue DECIMAL(12, 2), -- Meeting room revenue
estimated_total_revenue DECIMAL(12, 2), -- Total estimated revenue
actual_room_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Actual room revenue
actual_fb_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Actual food & beverage revenue
actual_meeting_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Actual meeting revenue
actual_revenue DECIMAL(12, 2) DEFAULT 0.00, -- Actual total revenue

-- Assignment & Ownership
account_manager_id UUID REFERENCES users (id), -- Assigned account manager
sales_manager_id UUID REFERENCES users (id), -- Assigned sales manager
booking_source VARCHAR(100), -- Source channel reference

-- Contract & Documentation
contract_signed BOOLEAN DEFAULT FALSE, -- Contract execution status
contract_signed_date DATE, -- Date contract was signed
contract_document_url VARCHAR(500), -- URL to contract document
beo_created BOOLEAN DEFAULT FALSE, -- Banquet Event Order
beo_document_url VARCHAR(500), -- URL to BEO document

-- Cancellation Policy
cancellation_policy TEXT, -- Cancellation terms
cancellation_deadline DATE, -- Deadline for cancellations
cancellation_penalty_percentage DECIMAL(5, 2), -- Penalty rate
cancellation_fee DECIMAL(10, 2), -- Fixed penalty amount
cancellation_fee_currency VARCHAR(10), -- Currency for cancellation fee

-- Status & Tracking
confirmation_number VARCHAR(100), -- Confirmation reference
is_active BOOLEAN DEFAULT TRUE, -- Active group flag
booking_confidence VARCHAR(20) CHECK (
    booking_confidence IN (
        'very_low',
        'low',
        'medium',
        'high',
        'very_high',
        'confirmed'
    )
),

-- Notes
notes TEXT, -- General notes
internal_notes TEXT, -- Internal use only
catering_notes TEXT, -- Notes related to catering
housekeeping_notes TEXT, -- Notes for housekeeping

-- Audit Fields
created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
    created_by UUID REFERENCES users(id),   -- User who created the record
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
    updated_by UUID REFERENCES users(id),   -- User who last updated the record
    is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
    deleted_at TIMESTAMP WITHOUT TIME ZONE, -- Deletion timestamp
    deleted_by UUID REFERENCES users(id),   -- User who deleted the record
    version BIGINT DEFAULT 0 -- Optimistic locking counter
);

-- =============================================
-- Group Room Blocks Table
-- =============================================

CREATE TABLE IF NOT EXISTS group_room_blocks (
    -- Primary Key
    block_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY, -- Unique block identifier

-- Foreign Keys
group_booking_id UUID NOT NULL REFERENCES group_bookings (group_booking_id) ON DELETE CASCADE, -- Parent group booking
room_type_id UUID NOT NULL REFERENCES room_types (id) ON DELETE RESTRICT, -- Room type allocated

-- Block Details
block_date DATE NOT NULL, -- Night for this inventory block
blocked_rooms INTEGER NOT NULL DEFAULT 0, -- Total rooms held
picked_rooms INTEGER DEFAULT 0, -- Rooms taken from block
confirmed_rooms INTEGER DEFAULT 0, -- Rooms converted to definite reservations
available_rooms INTEGER GENERATED ALWAYS AS (blocked_rooms - picked_rooms) STORED, -- Remaining inventory

-- Pricing
negotiated_rate DECIMAL(10, 2) NOT NULL, -- Contracted rate
rack_rate DECIMAL(10, 2), -- Reference rack rate
discount_percentage DECIMAL(5, 2), -- Discount vs rack

-- Status
block_status VARCHAR(50) DEFAULT 'active' CHECK (
    block_status IN (
        'pending',
        'active',
        'released',
        'sold_out',
        'cancelled'
    )
),
released_date DATE, -- Date block released
released_by UUID REFERENCES users (id), -- User releasing block

-- Audit
created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
created_by UUID REFERENCES users (id),
updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Last update timestamp
updated_by UUID REFERENCES users (id),

-- Constraints
UNIQUE (group_booking_id, room_type_id, block_date),
    CHECK (picked_rooms <= blocked_rooms),
    CHECK (confirmed_rooms <= picked_rooms)
);

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE group_bookings IS 'Manages group reservations, corporate bookings, and event blocks';

COMMENT ON TABLE group_room_blocks IS 'Room inventory blocks allocated to group bookings by date and room type';

COMMENT ON COLUMN group_bookings.cutoff_date IS 'Date by which unsold rooms are released back to inventory';

COMMENT ON COLUMN group_bookings.rooming_list_received IS 'Indicates if individual guest names have been provided';

COMMENT ON COLUMN group_room_blocks.picked_rooms IS 'Number of rooms from the block that have been reserved';
