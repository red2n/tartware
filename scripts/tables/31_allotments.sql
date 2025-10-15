-- =====================================================
-- 31_allotments.sql
-- Group/Block Bookings & Room Allotments
--
-- Purpose: Manage blocked rooms for groups, events, contracts
-- Industry Standard: OPERA (BLOCK/ALLOTMENT), Cloudbeds (allotments),
--                    Protel (KONTINGENT), RMS (block_booking)
--
-- Use Cases:
-- - Wedding blocks (50 rooms for 3 nights)
-- - Corporate contracts (10 rooms/night year-round)
-- - Tour groups (bus tour with 25 rooms)
-- - Event blocks (conference attendees)
--
-- Features: Room type blocks, pickup tracking, cut-off dates
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS allotments CASCADE;

CREATE TABLE allotments (
    -- Primary Key
    allotment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Allotment Information
    allotment_code VARCHAR(50) NOT NULL, -- e.g., "SMITH-WEDDING-2024"
    allotment_name VARCHAR(200) NOT NULL,
    allotment_type VARCHAR(30) NOT NULL
        CHECK (allotment_type IN ('GROUP', 'CONTRACT', 'EVENT', 'TOUR', 'CORPORATE', 'WEDDING', 'CONFERENCE')),

    -- Status
    allotment_status VARCHAR(20) NOT NULL DEFAULT 'TENTATIVE'
        CHECK (allotment_status IN ('TENTATIVE', 'DEFINITE', 'ACTIVE', 'PICKUP_IN_PROGRESS', 'COMPLETED', 'CANCELLED')),

    -- Date Range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cutoff_date DATE, -- Date by which rooms must be picked up
    cutoff_days_prior INTEGER, -- Days before start_date for cutoff

    -- Room Allocation
    room_type_id UUID, -- If block is for specific room type
    total_rooms_blocked INTEGER NOT NULL, -- Total rooms in block
    total_room_nights INTEGER, -- Total room nights (rooms × nights)
    rooms_per_night INTEGER, -- For consistent nightly blocks

    -- Pickup Tracking
    rooms_picked_up INTEGER DEFAULT 0, -- Rooms actually reserved
    rooms_available INTEGER, -- Remaining available rooms
    pickup_percentage DECIMAL(5, 2) DEFAULT 0.00, -- % of block reserved

    -- Financial
    rate_type VARCHAR(30), -- FLAT, NEGOTIATED, DYNAMIC, STANDARD
    contracted_rate DECIMAL(10, 2), -- Fixed rate if contracted
    min_rate DECIMAL(10, 2), -- Minimum allowed rate
    max_rate DECIMAL(10, 2), -- Maximum allowed rate
    total_expected_revenue DECIMAL(12, 2),
    actual_revenue DECIMAL(12, 2) DEFAULT 0.00,
    currency_code CHAR(3) DEFAULT 'USD',

    -- Account Information
    account_name VARCHAR(200), -- Company/group name
    account_type VARCHAR(30), -- CORPORATE, TRAVEL_AGENT, DIRECT
    billing_type VARCHAR(30) DEFAULT 'INDIVIDUAL'
        CHECK (billing_type IN ('INDIVIDUAL', 'MASTER_ACCOUNT', 'SPLIT')),
    master_folio_id UUID, -- If using master billing

    -- Contact Information
    contact_name VARCHAR(200),
    contact_title VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(30),
    contact_company VARCHAR(200),

    -- Booking Source
    booking_source_id UUID, -- Reference to booking_sources table
    booking_reference VARCHAR(100),
    channel VARCHAR(50), -- DIRECT, OTA, GDS, AGENT

    -- Market Segment
    market_segment_id UUID, -- Reference to market_segments table

    -- Terms & Conditions
    deposit_required BOOLEAN DEFAULT FALSE,
    deposit_amount DECIMAL(12, 2),
    deposit_percentage DECIMAL(5, 2),
    deposit_due_date DATE,

    cancellation_policy VARCHAR(50),
    cancellation_deadline DATE,
    cancellation_fee_amount DECIMAL(12, 2),

    attrition_clause BOOLEAN DEFAULT FALSE, -- Penalty if pickup too low
    attrition_percentage DECIMAL(5, 2), -- Minimum pickup required
    attrition_penalty DECIMAL(12, 2),

    -- Room Details
    guaranteed_rooms INTEGER, -- Rooms guest is committed to pay for
    on_hold_rooms INTEGER, -- Rooms held but not guaranteed
    elastic_limit INTEGER, -- Maximum additional rooms available

    -- Rates per Room Type (if multiple types)
    rate_details JSONB, -- {room_type_id: {rate, count, picked_up}}

    -- Special Requests
    special_requests TEXT,
    amenities_included TEXT[],
    setup_requirements TEXT,

    -- Commission
    commission_percentage DECIMAL(5, 2),
    commission_amount DECIMAL(10, 2),
    commissionable_amount DECIMAL(12, 2),

    -- Dates
    confirmed_at TIMESTAMP,
    confirmed_by UUID,
    activated_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_by UUID,
    cancellation_reason VARCHAR(500),

    -- Owner/Manager
    account_manager_id UUID, -- Sales person responsible
    operations_manager_id UUID,

    -- Reporting
    is_vip BOOLEAN DEFAULT FALSE,
    priority_level INTEGER DEFAULT 0,

    -- Notes
    notes TEXT,
    internal_notes TEXT,

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
    CONSTRAINT uk_allotments_code
        UNIQUE (tenant_id, property_id, allotment_code)
        WHERE deleted_at IS NULL,

    -- End date must be after start date
    CONSTRAINT chk_allotments_dates
        CHECK (end_date >= start_date),

    -- Available rooms calculation
    CONSTRAINT chk_allotments_availability
        CHECK (
            rooms_available IS NULL OR
            rooms_available = total_rooms_blocked - rooms_picked_up
        ),

    -- Pickup percentage validation
    CONSTRAINT chk_allotments_pickup
        CHECK (
            pickup_percentage >= 0 AND
            pickup_percentage <= 100
        ),

    -- Attrition percentage validation
    CONSTRAINT chk_allotments_attrition
        CHECK (
            attrition_percentage IS NULL OR
            (attrition_percentage >= 0 AND attrition_percentage <= 100)
        )
);

-- Add table comment
COMMENT ON TABLE allotments IS 'Group/block bookings and room allotments. Manages blocked rooms for groups, events, corporate contracts with pickup tracking.';

-- Add column comments
COMMENT ON COLUMN allotments.allotment_code IS 'Unique code for this block (e.g., "SMITH-WEDDING-2024")';
COMMENT ON COLUMN allotments.allotment_type IS 'GROUP, CONTRACT, EVENT, TOUR, CORPORATE, WEDDING, CONFERENCE';
COMMENT ON COLUMN allotments.cutoff_date IS 'Date by which rooms must be reserved or returned to inventory';
COMMENT ON COLUMN allotments.rooms_picked_up IS 'Number of rooms actually reserved from the block';
COMMENT ON COLUMN allotments.pickup_percentage IS 'Percentage of blocked rooms that have been reserved';
COMMENT ON COLUMN allotments.billing_type IS 'INDIVIDUAL (each guest pays), MASTER_ACCOUNT (billed to group), SPLIT';
COMMENT ON COLUMN allotments.attrition_clause IS 'If TRUE, penalty applies if pickup falls below attrition_percentage';
COMMENT ON COLUMN allotments.guaranteed_rooms IS 'Rooms the group is committed to paying for regardless of pickup';
COMMENT ON COLUMN allotments.elastic_limit IS 'Additional rooms that can be added beyond initial block';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_allotments_tenant ON allotments(tenant_id, property_id, start_date);
-- CREATE INDEX idx_allotments_code ON allotments(allotment_code) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_allotments_dates ON allotments(property_id, start_date, end_date) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_allotments_status ON allotments(property_id, allotment_status) WHERE deleted_at IS NULL;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON allotments TO tartware_app;

-- Success message
\echo '✓ Table created: allotments (31/37)'
\echo '  - Group/block bookings'
\echo '  - Pickup tracking'
\echo '  - Attrition management'
\echo ''
