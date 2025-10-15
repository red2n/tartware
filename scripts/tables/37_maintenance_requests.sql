-- =====================================================
-- 37_maintenance_requests.sql
-- Maintenance & Repair Request Tracking
--
-- Purpose: Track maintenance issues and work orders
-- Industry Standard: OPERA (MAINTENANCE), Cloudbeds (maintenance),
--                    Protel (WARTUNG), RMS (maintenance_log)
--
-- Use Cases:
-- - Room repairs (plumbing, electrical, HVAC)
-- - Preventive maintenance scheduling
-- - Guest-reported issues
-- - Housekeeping-identified problems
-- - Out-of-order room management
--
-- Integrates with room status and availability
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS maintenance_requests CASCADE;

CREATE TABLE maintenance_requests (
    -- Primary Key
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Request Information
    request_number VARCHAR(50), -- Human-readable work order number
    request_type VARCHAR(30) NOT NULL
        CHECK (request_type IN ('CORRECTIVE', 'PREVENTIVE', 'EMERGENCY', 'ROUTINE', 'INSPECTION', 'UPGRADE', 'GUEST_REPORTED')),

    -- Status
    request_status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (request_status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'VERIFIED')),

    -- Priority
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT', 'EMERGENCY')),

    -- Location
    room_id UUID, -- Specific room
    room_number VARCHAR(20),
    location_description VARCHAR(200), -- If not room-specific (lobby, pool, etc.)
    location_type VARCHAR(30), -- GUEST_ROOM, PUBLIC_AREA, BACK_OF_HOUSE, EXTERIOR

    -- Issue Details
    issue_category VARCHAR(50) NOT NULL
        CHECK (issue_category IN ('PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE', 'FURNITURE', 'FIXTURE', 'SAFETY', 'CLEANLINESS', 'PEST', 'STRUCTURAL', 'EQUIPMENT', 'TECHNOLOGY', 'OTHER')),
    issue_subcategory VARCHAR(100),
    issue_description TEXT NOT NULL,

    -- Severity
    affects_occupancy BOOLEAN DEFAULT FALSE, -- Room cannot be sold
    affects_guest_comfort BOOLEAN DEFAULT FALSE,
    is_safety_issue BOOLEAN DEFAULT FALSE,
    is_health_issue BOOLEAN DEFAULT FALSE,

    -- Reported By
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reported_by UUID NOT NULL, -- User who reported
    reporter_role VARCHAR(30), -- GUEST, HOUSEKEEPING, FRONT_DESK, MAINTENANCE, MANAGER

    guest_id UUID, -- If reported by guest
    reservation_id UUID, -- If affects current guest

    -- Assignment
    assigned_to UUID, -- Maintenance staff assigned
    assigned_at TIMESTAMP,
    assigned_by UUID,
    maintenance_team VARCHAR(50), -- PLUMBING, ELECTRICAL, GENERAL, HVAC

    -- Scheduling
    scheduled_date DATE,
    scheduled_time TIME,
    estimated_duration_minutes INTEGER,

    requires_room_vacant BOOLEAN DEFAULT FALSE,
    requires_specialist BOOLEAN DEFAULT FALSE,
    specialist_type VARCHAR(100),

    -- Work Details
    work_started_at TIMESTAMP,
    work_completed_at TIMESTAMP,
    actual_duration_minutes INTEGER,

    work_performed TEXT,
    parts_used TEXT[],
    materials_used TEXT,

    -- Costs
    labor_cost DECIMAL(10, 2),
    parts_cost DECIMAL(10, 2),
    total_cost DECIMAL(10, 2),
    currency_code CHAR(3) DEFAULT 'USD',

    is_warranty_work BOOLEAN DEFAULT FALSE,
    warranty_notes TEXT,

    -- Vendor Information
    requires_vendor BOOLEAN DEFAULT FALSE,
    vendor_name VARCHAR(200),
    vendor_contact VARCHAR(100),
    vendor_cost DECIMAL(10, 2),
    po_number VARCHAR(50), -- Purchase order

    -- Room Impact
    room_out_of_service BOOLEAN DEFAULT FALSE,
    oos_from TIMESTAMP, -- Out of service from
    oos_until TIMESTAMP, -- Expected back in service
    actual_oos_duration_hours INTEGER,

    -- Follow-up
    requires_follow_up BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    follow_up_notes TEXT,

    -- Verification
    verified_at TIMESTAMP,
    verified_by UUID,
    verification_notes TEXT,
    is_satisfactory BOOLEAN,

    -- Recurrence
    is_recurring_issue BOOLEAN DEFAULT FALSE,
    previous_request_id UUID, -- Reference to previous occurrence
    recurrence_count INTEGER DEFAULT 0,
    root_cause_analysis TEXT,

    -- Preventive Maintenance
    is_scheduled_maintenance BOOLEAN DEFAULT FALSE,
    maintenance_schedule_id UUID,
    next_maintenance_date DATE,

    -- Guest Communication
    guest_notified BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP,
    apology_issued BOOLEAN DEFAULT FALSE,
    compensation_offered BOOLEAN DEFAULT FALSE,
    compensation_amount DECIMAL(10, 2),

    -- Quality Flags
    response_time_minutes INTEGER, -- Time from reported to assigned
    resolution_time_hours INTEGER, -- Time from reported to completed

    is_within_sla BOOLEAN, -- Service Level Agreement met
    sla_target_hours INTEGER,
    sla_notes TEXT,

    -- Photos/Documentation
    photo_urls TEXT[], -- Before/after photos
    document_urls TEXT[],

    -- Escalation
    is_escalated BOOLEAN DEFAULT FALSE,
    escalated_at TIMESTAMP,
    escalated_to UUID,
    escalation_reason TEXT,

    -- Completion
    completed_at TIMESTAMP,
    completed_by UUID,
    completion_notes TEXT,

    cancelled_at TIMESTAMP,
    cancelled_by UUID,
    cancellation_reason TEXT,

    -- Asset Management
    asset_id UUID, -- If related to specific asset/equipment
    asset_tag VARCHAR(50),

    -- Metadata
    metadata JSONB,

    -- Notes
    notes TEXT,
    internal_notes TEXT,

    -- Soft delete
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Audit trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID,

    -- Constraints
    CONSTRAINT uk_maintenance_requests_number
        UNIQUE (tenant_id, property_id, request_number),

    -- Completed status requires completion timestamp
    CONSTRAINT chk_maintenance_completed
        CHECK (
            request_status != 'COMPLETED' OR
            completed_at IS NOT NULL
        ),

    -- OOS dates validation
    CONSTRAINT chk_maintenance_oos_dates
        CHECK (
            oos_until IS NULL OR
            oos_from IS NULL OR
            oos_until >= oos_from
        ),

    -- Assigned status requires assignment info
    CONSTRAINT chk_maintenance_assigned
        CHECK (
            request_status NOT IN ('ASSIGNED', 'IN_PROGRESS') OR
            (assigned_to IS NOT NULL AND assigned_at IS NOT NULL)
        ),

    -- Duration validation
    CONSTRAINT chk_maintenance_duration
        CHECK (
            estimated_duration_minutes IS NULL OR
            estimated_duration_minutes > 0
        ),

    -- Total cost calculation
    CONSTRAINT chk_maintenance_cost
        CHECK (
            total_cost IS NULL OR
            labor_cost IS NULL OR
            parts_cost IS NULL OR
            total_cost >= (COALESCE(labor_cost, 0) + COALESCE(parts_cost, 0))
        )
);

-- Add table comment
COMMENT ON TABLE maintenance_requests IS 'Maintenance and repair request tracking. Manages work orders, preventive maintenance, and out-of-order room status.';

-- Add column comments
COMMENT ON COLUMN maintenance_requests.request_type IS 'CORRECTIVE, PREVENTIVE, EMERGENCY, ROUTINE, INSPECTION, UPGRADE, GUEST_REPORTED';
COMMENT ON COLUMN maintenance_requests.priority IS 'LOW, MEDIUM, HIGH, URGENT, EMERGENCY - determines response time';
COMMENT ON COLUMN maintenance_requests.issue_category IS 'PLUMBING, ELECTRICAL, HVAC, APPLIANCE, FURNITURE, FIXTURE, SAFETY, CLEANLINESS, PEST, etc.';
COMMENT ON COLUMN maintenance_requests.affects_occupancy IS 'If TRUE, room cannot be sold until repaired';
COMMENT ON COLUMN maintenance_requests.reporter_role IS 'Who reported: GUEST, HOUSEKEEPING, FRONT_DESK, MAINTENANCE, MANAGER';
COMMENT ON COLUMN maintenance_requests.requires_room_vacant IS 'Work can only be done when room is unoccupied';
COMMENT ON COLUMN maintenance_requests.room_out_of_service IS 'Room marked OOS/unavailable for sale';
COMMENT ON COLUMN maintenance_requests.is_recurring_issue IS 'Same issue has occurred before';
COMMENT ON COLUMN maintenance_requests.is_within_sla IS 'Service Level Agreement target met';
COMMENT ON COLUMN maintenance_requests.response_time_minutes IS 'Minutes from reported to assigned';
COMMENT ON COLUMN maintenance_requests.resolution_time_hours IS 'Hours from reported to completed';

-- Create indexes (will be created via indexes file)
-- CREATE INDEX idx_maintenance_tenant ON maintenance_requests(tenant_id, property_id, reported_at DESC);
-- CREATE INDEX idx_maintenance_room ON maintenance_requests(room_id, request_status) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_maintenance_status ON maintenance_requests(property_id, request_status, priority) WHERE deleted_at IS NULL;
-- Create partial unique index for active request numbers
CREATE UNIQUE INDEX idx_uk_maintenance_requests_number
    ON maintenance_requests(tenant_id, property_id, request_number)
    WHERE deleted_at IS NULL;

-- CREATE INDEX idx_maintenance_assigned ON maintenance_requests(assigned_to, request_status) WHERE deleted_at IS NULL;
-- CREATE INDEX idx_maintenance_oos ON maintenance_requests(property_id, room_out_of_service) WHERE room_out_of_service = TRUE;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON maintenance_requests TO tartware_app;

-- Success message
\echo '✓ Table created: maintenance_requests (37/37)'
\echo '  - Maintenance tracking'
\echo '  - Work order management'
\echo '  - OOS room handling'
\echo ''
\echo '==========================================='
\echo '✓✓ ALL 13 TABLES COMPLETE (25-37) ✓✓'
\echo '==========================================='
\echo '  Phase 1 (6): folios, charge_postings,'
\echo '               audit_logs, business_dates,'
\echo '               night_audit_log, deposit_schedules'
\echo ''
\echo '  Phase 2 (7): allotments, booking_sources,'
\echo '               market_segments, guest_preferences,'
\echo '               refunds, rate_overrides,'
\echo '               maintenance_requests'
\echo ''
\echo 'Next: Create indexes and constraints'
\echo '==========================================='
\echo ''
