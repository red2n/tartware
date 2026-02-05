-- =====================================================
-- 01_room_status_codes.sql
-- Dynamic Room Status Reference Data
--
-- Purpose: Replace hardcoded room_status ENUM with
--          configurable lookup table
--
-- Industry Standard: OPERA (ROOM_STATUS), Cloudbeds,
--                    Protel (ZIMMER_STATUS), RMS
--
-- Migration: This table will eventually replace the
--            PostgreSQL ENUM 'room_status' to allow
--            tenant-specific status codes
--
-- Date: 2026-02-05
-- =====================================================

\c tartware

\echo 'Creating room_status_codes table...'

CREATE TABLE IF NOT EXISTS room_status_codes (
    -- Primary Key
    status_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy (NULL tenant_id = system default)
    tenant_id UUID,  -- NULL for system defaults available to all
    property_id UUID, -- NULL for tenant-level codes

    -- Status Identification
    code VARCHAR(30) NOT NULL,           -- e.g., "VC", "VD", "OC", "SO"
    name VARCHAR(100) NOT NULL,          -- e.g., "Vacant Clean"
    description TEXT,                    -- Detailed description

    -- Behavioral Flags (determines PMS logic)
    is_occupied BOOLEAN NOT NULL DEFAULT FALSE,      -- Guest currently in room
    is_sellable BOOLEAN NOT NULL DEFAULT TRUE,       -- Can be sold to new guest
    is_clean BOOLEAN NOT NULL DEFAULT FALSE,         -- Room has been cleaned
    requires_housekeeping BOOLEAN NOT NULL DEFAULT FALSE, -- Needs HK attention
    requires_inspection BOOLEAN NOT NULL DEFAULT FALSE,   -- Needs supervisor QC
    is_out_of_inventory BOOLEAN NOT NULL DEFAULT FALSE,   -- OOO/OOS type

    -- State Machine: Valid Transitions
    allowed_next_codes VARCHAR(30)[],    -- What statuses can follow this one

    -- Mapping to Legacy Enum (for migration)
    legacy_enum_value VARCHAR(50),       -- Maps to room_status ENUM value

    -- Display & UI
    display_order INTEGER DEFAULT 0,     -- Sort order in dropdowns
    color_code VARCHAR(7),               -- Hex color for UI (e.g., "#28a745")
    icon VARCHAR(50),                    -- Icon identifier (e.g., "check-circle")
    badge_class VARCHAR(50),             -- CSS class for badge styling

    -- Categorization
    category VARCHAR(30) DEFAULT 'OPERATIONAL'
        CHECK (category IN ('OPERATIONAL', 'MAINTENANCE', 'BLOCKED', 'SPECIAL')),

    -- System vs Custom
    is_system BOOLEAN NOT NULL DEFAULT FALSE,  -- System defaults, cannot delete
    is_active BOOLEAN NOT NULL DEFAULT TRUE,   -- Soft disable without delete

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT uk_room_status_codes_tenant_code
        UNIQUE NULLS NOT DISTINCT (tenant_id, property_id, code),

    -- System codes cannot be duplicated across tenants
    CONSTRAINT chk_room_status_code_format
        CHECK (code ~ '^[A-Z0-9_]{1,30}$')
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE room_status_codes IS
'Configurable room status codes replacing hardcoded ENUM.
Allows tenant-specific and property-specific status codes
while maintaining system defaults for core operational statuses.';

COMMENT ON COLUMN room_status_codes.tenant_id IS
'NULL for system-wide defaults; set for tenant-specific codes';

COMMENT ON COLUMN room_status_codes.is_occupied IS
'TRUE if guest is physically in the room (affects inventory counts)';

COMMENT ON COLUMN room_status_codes.is_sellable IS
'TRUE if room can be sold to a new guest (affects availability search)';

COMMENT ON COLUMN room_status_codes.is_clean IS
'TRUE if room has been cleaned and passed inspection';

COMMENT ON COLUMN room_status_codes.requires_housekeeping IS
'TRUE if this status triggers assignment to housekeeping queue';

COMMENT ON COLUMN room_status_codes.is_out_of_inventory IS
'TRUE for OOO/OOS statuses that remove room from sellable inventory';

COMMENT ON COLUMN room_status_codes.legacy_enum_value IS
'Maps to the old room_status PostgreSQL ENUM for migration compatibility';

COMMENT ON COLUMN room_status_codes.allowed_next_codes IS
'Array of status codes that are valid transitions from this status';

-- =====================================================
-- INDEXES
-- =====================================================

-- Lookup by tenant
CREATE INDEX idx_room_status_codes_tenant
    ON room_status_codes(tenant_id, property_id)
    WHERE deleted_at IS NULL;

-- Active codes for dropdown population
CREATE INDEX idx_room_status_codes_active
    ON room_status_codes(tenant_id, is_active, display_order)
    WHERE deleted_at IS NULL AND is_active = TRUE;

-- Legacy enum mapping for migration queries
CREATE INDEX idx_room_status_codes_legacy
    ON room_status_codes(legacy_enum_value)
    WHERE legacy_enum_value IS NOT NULL;

-- =====================================================
-- SYSTEM DEFAULT DATA
-- =====================================================

-- Insert system defaults (tenant_id = NULL means available to all)
INSERT INTO room_status_codes (
    tenant_id, code, name, description,
    is_occupied, is_sellable, is_clean, requires_housekeeping,
    requires_inspection, is_out_of_inventory,
    allowed_next_codes, legacy_enum_value,
    display_order, color_code, icon, category, is_system
) VALUES
-- Vacant Clean (VC) - Ready for guest
(NULL, 'VC', 'Vacant Clean', 'Room is vacant, cleaned, and ready for new guest',
 FALSE, TRUE, TRUE, FALSE, FALSE, FALSE,
 ARRAY['OC', 'VD', 'OOO', 'OOS', 'BLK'], 'AVAILABLE',
 10, '#28a745', 'check-circle', 'OPERATIONAL', TRUE),

-- Vacant Dirty (VD) - Needs cleaning
(NULL, 'VD', 'Vacant Dirty', 'Room is vacant but needs cleaning after checkout',
 FALSE, FALSE, FALSE, TRUE, FALSE, FALSE,
 ARRAY['VC', 'INS', 'OOO', 'OOS'], 'DIRTY',
 20, '#dc3545', 'broom', 'OPERATIONAL', TRUE),

-- Occupied Clean (OC) - Guest in-house, serviced
(NULL, 'OC', 'Occupied Clean', 'Guest is in-house and room has been serviced today',
 TRUE, FALSE, TRUE, FALSE, FALSE, FALSE,
 ARRAY['OD', 'VD', 'VC'], 'OCCUPIED',
 30, '#007bff', 'user-check', 'OPERATIONAL', TRUE),

-- Occupied Dirty (OD) - Guest in-house, needs service
(NULL, 'OD', 'Occupied Dirty', 'Guest is in-house and room needs daily service',
 TRUE, FALSE, FALSE, TRUE, FALSE, FALSE,
 ARRAY['OC', 'VD', 'DND'], 'OCCUPIED',
 40, '#fd7e14', 'user-clock', 'OPERATIONAL', TRUE),

-- Inspected (INS) - QC passed
(NULL, 'INS', 'Inspected', 'Room has been cleaned and passed supervisor inspection',
 FALSE, TRUE, TRUE, FALSE, FALSE, FALSE,
 ARRAY['VC', 'OC', 'VD'], 'INSPECTED',
 15, '#20c997', 'clipboard-check', 'OPERATIONAL', TRUE),

-- Out of Order (OOO) - Maintenance required
(NULL, 'OOO', 'Out of Order', 'Room is not sellable due to maintenance issue',
 FALSE, FALSE, FALSE, FALSE, FALSE, TRUE,
 ARRAY['VC', 'VD'], 'OUT_OF_ORDER',
 50, '#6c757d', 'tools', 'MAINTENANCE', TRUE),

-- Out of Service (OOS) - Temporarily unavailable
(NULL, 'OOS', 'Out of Service', 'Room temporarily removed from inventory (renovation, block)',
 FALSE, FALSE, FALSE, FALSE, FALSE, TRUE,
 ARRAY['VC', 'VD'], 'OUT_OF_SERVICE',
 60, '#6c757d', 'pause-circle', 'MAINTENANCE', TRUE),

-- Do Not Disturb (DND) - Guest declined service
(NULL, 'DND', 'Do Not Disturb', 'Guest has requested no housekeeping service',
 TRUE, FALSE, FALSE, FALSE, FALSE, FALSE,
 ARRAY['OD', 'OC', 'VD'], NULL,
 45, '#ffc107', 'bell-slash', 'SPECIAL', TRUE),

-- Sleep Out (SO) - Occupied but bed not used
(NULL, 'SO', 'Sleep Out', 'Guest is checked in but did not sleep in room overnight',
 TRUE, FALSE, FALSE, FALSE, FALSE, FALSE,
 ARRAY['OC', 'OD', 'VD'], NULL,
 47, '#17a2b8', 'moon', 'SPECIAL', TRUE),

-- On Change (CHG) - Checkout in progress
(NULL, 'CHG', 'On Change', 'Guest checking out, room transitioning to vacant',
 FALSE, FALSE, FALSE, TRUE, FALSE, FALSE,
 ARRAY['VD'], NULL,
 35, '#e83e8c', 'exchange-alt', 'OPERATIONAL', TRUE),

-- Blocked (BLK) - Manually blocked for VIP/special use
(NULL, 'BLK', 'Blocked', 'Room manually blocked (VIP hold, owner use, etc.)',
 FALSE, FALSE, TRUE, FALSE, FALSE, TRUE,
 ARRAY['VC', 'OOO', 'OOS'], NULL,
 55, '#343a40', 'lock', 'BLOCKED', TRUE);

-- =====================================================
-- PERMISSIONS
-- =====================================================

GRANT SELECT ON room_status_codes TO tartware_app;
GRANT INSERT, UPDATE ON room_status_codes TO tartware_app;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

\echo '✓ Table created: room_status_codes'
\echo '  - 11 system default statuses seeded'
\echo '  - Supports tenant/property-specific custom codes'
\echo '  - Behavioral flags for PMS logic'
\echo '  - State machine transitions defined'
\echo ''
