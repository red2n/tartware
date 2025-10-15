-- =====================================================
-- 17_housekeeping_tasks_indexes.sql
-- Indexes for housekeeping_tasks table
-- Performance optimization for operational queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for housekeeping_tasks table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_hk_tasks_tenant_id ON housekeeping_tasks(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_property_id ON housekeeping_tasks(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_assigned_to ON housekeeping_tasks(assigned_to) WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_guest_id ON housekeeping_tasks(guest_id) WHERE guest_id IS NOT NULL;

-- Room number lookup
CREATE INDEX IF NOT EXISTS idx_hk_tasks_room_number ON housekeeping_tasks(room_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_property_room ON housekeeping_tasks(property_id, room_number, deleted_at)
    WHERE deleted_at IS NULL;

-- Task type and priority
CREATE INDEX IF NOT EXISTS idx_hk_tasks_task_type ON housekeeping_tasks(task_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_priority ON housekeeping_tasks(priority) WHERE deleted_at IS NULL;

-- Status queries (critical for operational dashboard)
CREATE INDEX IF NOT EXISTS idx_hk_tasks_status ON housekeeping_tasks(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_property_status ON housekeeping_tasks(property_id, status, deleted_at)
    WHERE deleted_at IS NULL;

-- Date queries
CREATE INDEX IF NOT EXISTS idx_hk_tasks_scheduled_date ON housekeeping_tasks(scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_scheduled_time ON housekeeping_tasks(scheduled_time) WHERE scheduled_time IS NOT NULL;

-- Assignment and timing
CREATE INDEX IF NOT EXISTS idx_hk_tasks_assigned_at ON housekeeping_tasks(assigned_at) WHERE assigned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_started_at ON housekeeping_tasks(started_at) WHERE started_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_completed_at ON housekeeping_tasks(completed_at) WHERE completed_at IS NOT NULL;

-- Composite for today's tasks by staff
CREATE INDEX IF NOT EXISTS idx_hk_tasks_staff_today ON housekeeping_tasks(assigned_to, scheduled_date, status, deleted_at)
    WHERE deleted_at IS NULL;

-- Composite for property tasks by date
CREATE INDEX IF NOT EXISTS idx_hk_tasks_property_date ON housekeeping_tasks(property_id, scheduled_date, status, deleted_at)
    WHERE deleted_at IS NULL;

-- Inspection tracking
CREATE INDEX IF NOT EXISTS idx_hk_tasks_inspected_by ON housekeeping_tasks(inspected_by) WHERE inspected_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_inspected_at ON housekeeping_tasks(inspected_at) WHERE inspected_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hk_tasks_inspection_passed ON housekeeping_tasks(inspection_passed)
    WHERE inspection_passed IS NOT NULL;

-- Guest request flag
CREATE INDEX IF NOT EXISTS idx_hk_tasks_guest_request ON housekeeping_tasks(is_guest_request)
    WHERE is_guest_request = true AND deleted_at IS NULL;

-- Credits (for payroll)
CREATE INDEX IF NOT EXISTS idx_hk_tasks_credits ON housekeeping_tasks(credits) WHERE completed_at IS NOT NULL;

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_hk_tasks_metadata_gin ON housekeeping_tasks USING GIN(metadata);

-- Composite for pending tasks by property
CREATE INDEX IF NOT EXISTS idx_hk_tasks_pending ON housekeeping_tasks(property_id, status, scheduled_date, priority)
    WHERE status IN ('dirty', 'in_progress') AND deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_hk_tasks_created_at ON housekeeping_tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_updated_at ON housekeeping_tasks(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_hk_tasks_deleted_at ON housekeeping_tasks(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Housekeeping_tasks indexes created successfully!'
