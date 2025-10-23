-- =====================================================
-- rooms.sql
-- Rooms Table
-- Industry Standard: Physical room inventory
-- Pattern: Oracle OPERA Cloud Room, Cloudbeds Room
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating rooms table...'

-- =====================================================
-- ROOMS TABLE
-- Physical rooms/units within a property
-- Individual sellable inventory units
-- =====================================================

CREATE TABLE IF NOT EXISTS rooms (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    room_type_id UUID NOT NULL,

    -- Room Identification
    room_number VARCHAR(50) NOT NULL,
    room_name VARCHAR(255),

    -- Location
    floor VARCHAR(20),
    building VARCHAR(100),
    wing VARCHAR(100),

    -- Status
    status room_status NOT NULL DEFAULT 'AVAILABLE',
    housekeeping_status housekeeping_status NOT NULL DEFAULT 'CLEAN',
    maintenance_status maintenance_status NOT NULL DEFAULT 'OPERATIONAL',

    -- Features (can override room type defaults)
    features JSONB DEFAULT '{
        "view": null,
        "accessibility": false,
        "connecting": false,
        "smoking": false,
        "balcony": false,
        "oceanView": false
    }'::jsonb,

    -- Room-Specific Amenities (overrides/additions to room type)
    amenities JSONB DEFAULT '[]'::jsonb,

    -- Blocking/Maintenance
    is_blocked BOOLEAN DEFAULT false,
    block_reason VARCHAR(255),
    blocked_from TIMESTAMP,
    blocked_until TIMESTAMP,

    -- Out of Order/Service
    is_out_of_order BOOLEAN DEFAULT false,
    out_of_order_reason TEXT,
    out_of_order_since TIMESTAMP,
    expected_ready_date TIMESTAMP,

    -- Notes
    notes TEXT,
    housekeeping_notes TEXT,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT rooms_number_unique UNIQUE (property_id, room_number),
    CONSTRAINT rooms_block_dates CHECK (blocked_from IS NULL OR blocked_until IS NULL OR blocked_from < blocked_until)
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
