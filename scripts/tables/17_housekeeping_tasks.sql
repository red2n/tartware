-- =====================================================
-- housekeeping_tasks.sql
-- Housekeeping Tasks Table
-- Industry Standard: Housekeeping operations
-- Pattern: Oracle OPERA Housekeeping, Task Management
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating housekeeping_tasks table...'

-- =====================================================
-- HOUSEKEEPING_TASKS TABLE
-- Room cleaning and maintenance tasks
-- Operational workflow management
-- =====================================================

CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy & Hierarchy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Room Reference
    room_number VARCHAR(50) NOT NULL,

    -- Task Details
    task_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',

    -- Status
    status housekeeping_status NOT NULL DEFAULT 'dirty',

    -- Assignment
    assigned_to UUID,
    assigned_at TIMESTAMP,

    -- Timing
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scheduled_time TIME,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,

    -- Inspection
    inspected_by UUID,
    inspected_at TIMESTAMP,
    inspection_passed BOOLEAN,
    inspection_notes TEXT,

    -- Guest Request
    is_guest_request BOOLEAN DEFAULT false,
    guest_id UUID,
    special_instructions TEXT,

    -- Task Details
    notes TEXT,
    issues_found TEXT,

    -- Credits (for housekeeping staff performance)
    credits DECIMAL(5,2) DEFAULT 1.0,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT housekeeping_tasks_timing_check CHECK (
        started_at IS NULL OR
        completed_at IS NULL OR
        started_at <= completed_at
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE housekeeping_tasks IS 'Housekeeping and cleaning tasks for rooms';
COMMENT ON COLUMN housekeeping_tasks.id IS 'Unique task identifier (UUID)';
COMMENT ON COLUMN housekeeping_tasks.tenant_id IS 'Reference to tenants.id';
COMMENT ON COLUMN housekeeping_tasks.property_id IS 'Reference to properties.id';
COMMENT ON COLUMN housekeeping_tasks.room_number IS 'Room number to clean';
COMMENT ON COLUMN housekeeping_tasks.task_type IS 'Type: checkout, checkin, turndown, deep_clean, maintenance, guest_request';
COMMENT ON COLUMN housekeeping_tasks.priority IS 'Priority: low, normal, high, urgent';
COMMENT ON COLUMN housekeeping_tasks.status IS 'ENUM: clean, dirty, inspected, in_progress, do_not_disturb';
COMMENT ON COLUMN housekeeping_tasks.assigned_to IS 'Reference to users.id (housekeeping staff)';
COMMENT ON COLUMN housekeeping_tasks.started_at IS 'When cleaning started';
COMMENT ON COLUMN housekeeping_tasks.completed_at IS 'When cleaning completed';
COMMENT ON COLUMN housekeeping_tasks.inspected_by IS 'Reference to users.id (supervisor)';
COMMENT ON COLUMN housekeeping_tasks.inspection_passed IS 'Quality control result';
COMMENT ON COLUMN housekeeping_tasks.is_guest_request IS 'Guest-requested cleaning';
COMMENT ON COLUMN housekeeping_tasks.credits IS 'Performance credits for staff (1.0 = standard room)';
COMMENT ON COLUMN housekeeping_tasks.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Housekeeping_tasks table created successfully!'
