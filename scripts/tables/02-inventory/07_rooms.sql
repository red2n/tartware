-- =====================================================
-- rooms.sql
-- Rooms Table
-- Industry Standard: Physical room inventory
-- Pattern: Oracle OPERA Cloud Room, Cloudbeds Room
-- Date: 2025-10-15
-- =====================================================

\c tartware \echo 'Creating rooms table...'

-- =====================================================
-- ROOMS TABLE
-- Physical rooms/units within a property
-- Individual sellable inventory units
-- =====================================================

CREATE TABLE IF NOT EXISTS rooms (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique identifier per physical room

-- Multi-Tenancy & Hierarchy
tenant_id UUID NOT NULL, -- FK tenants.id for data isolation
property_id UUID NOT NULL, -- FK properties.id referencing the property
room_type_id UUID NOT NULL, -- FK room_types.id indicating category

-- Room Identification
room_number VARCHAR(50) NOT NULL, -- Sellable unit identifier (e.g., 101, 12A)
room_name VARCHAR(255), -- Optional marketing name (e.g., Presidential Suite)

-- Location
floor VARCHAR(20), -- Floor indicator
building VARCHAR(100), -- Building or tower designation
wing VARCHAR(100), -- Wing or section within the property

-- Status
status room_status NOT NULL DEFAULT 'AVAILABLE', -- Availability state for sales
housekeeping_status housekeeping_status NOT NULL DEFAULT 'CLEAN', -- Housekeeping readiness
maintenance_status maintenance_status NOT NULL DEFAULT 'OPERATIONAL', -- Maintenance state

-- Features (can override room type defaults)
features JSONB DEFAULT '{
        "view": null,
        "accessibility": false,
        "connecting": false,
        "smoking": false,
        "balcony": false,
        "oceanView": false
    }'::jsonb, -- Room-specific features overriding the type defaults

-- Room-Specific Amenities (overrides/additions to room type)
amenities JSONB DEFAULT '[]'::jsonb, -- Additional amenities unique to this room

-- Blocking/Maintenance
is_blocked BOOLEAN DEFAULT false, -- Indicates manual inventory block
block_reason VARCHAR(255), -- Reason for block (VIP hold, renovation)
blocked_from TIMESTAMP, -- Block start date/time
blocked_until TIMESTAMP, -- Block end date/time

-- Out of Order/Service
is_out_of_order BOOLEAN DEFAULT false, -- Room currently not sellable due to issue
out_of_order_reason TEXT, -- Explanation for out-of-order status
out_of_order_since TIMESTAMP, -- Timestamp when OOO flag was set
expected_ready_date TIMESTAMP, -- Planned return-to-service date

-- Notes
notes TEXT, -- Operational notes visible to staff
housekeeping_notes TEXT, -- Notes specific to housekeeping staff

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Extensible metadata payload

-- Audit Fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP, -- Last update timestamp
created_by VARCHAR(100), -- User who created record
updated_by VARCHAR(100), -- User who last updated

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP, -- Soft delete timestamp
deleted_by VARCHAR(100), -- Actor performing soft delete

-- Optimistic Locking
version BIGINT DEFAULT 0, -- Concurrency control version

-- Constraints
CONSTRAINT rooms_number_unique UNIQUE (property_id, room_number), -- Room numbers unique per property
    CONSTRAINT rooms_block_dates CHECK (blocked_from IS NULL OR blocked_until IS NULL OR blocked_from < blocked_until) -- Validate block window
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE rooms IS 'Physical rooms/units - individual sellable inventory';

COMMENT ON COLUMN rooms.id IS 'Unique room identifier (UUID)';

COMMENT ON COLUMN rooms.tenant_id IS 'Reference to tenants.id';

COMMENT ON COLUMN rooms.property_id IS 'Reference to properties.id';

COMMENT ON COLUMN rooms.room_type_id IS 'Reference to room_types.id';

COMMENT ON COLUMN rooms.room_number IS 'Unique room number within property (e.g., 101, 205A)';

COMMENT ON COLUMN rooms.floor IS 'Floor location (e.g., Ground, 1, 2, Penthouse)';

COMMENT ON COLUMN rooms.status IS 'ENUM: available, occupied, reserved, blocked, maintenance';

COMMENT ON COLUMN rooms.housekeeping_status IS 'ENUM: clean, dirty, inspected, in_progress, do_not_disturb';

COMMENT ON COLUMN rooms.maintenance_status IS 'ENUM: operational, needs_maintenance, under_maintenance, out_of_service';

COMMENT ON COLUMN rooms.is_blocked IS 'Room temporarily blocked (not sellable)';

COMMENT ON COLUMN rooms.block_reason IS 'Reason for blocking (e.g., renovation, VIP hold)';

COMMENT ON COLUMN rooms.is_out_of_order IS 'Room out of order/service';

COMMENT ON COLUMN rooms.out_of_order_reason IS 'Detailed reason for OOO status';

COMMENT ON COLUMN rooms.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Rooms table created successfully!'
