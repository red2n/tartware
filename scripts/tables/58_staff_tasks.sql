-- =====================================================
-- Staff Tasks Table
-- =====================================================
-- Purpose: Task assignment and tracking for staff members
-- Key Features:
--   - Task assignment and delegation
--   - Priority management
--   - Progress tracking
--   - Performance metrics
-- =====================================================

CREATE TABLE IF NOT EXISTS staff_tasks (
    -- Primary Key
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Task Identification
    task_number VARCHAR(50) UNIQUE,
    task_title VARCHAR(255) NOT NULL,
    task_description TEXT,

    -- Task Type
    task_type VARCHAR(100) NOT NULL CHECK (task_type IN (
        'housekeeping', 'maintenance', 'inspection', 'delivery',
        'guest_request', 'administrative', 'setup', 'breakdown',
        'inventory', 'training', 'safety', 'emergency', 'other'
    )),
    task_category VARCHAR(100),
    task_subcategory VARCHAR(100),

    -- Assignment
    assigned_to UUID,
    assigned_department VARCHAR(100),
    assigned_team VARCHAR(100),

    assigned_by UUID,
    assigned_at TIMESTAMP WITH TIME ZONE,

    -- Delegation
    can_be_delegated BOOLEAN DEFAULT TRUE,
    delegated_from UUID,
    delegation_level INTEGER DEFAULT 0,

    -- Priority & Urgency
    priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),
    urgency_score INTEGER CHECK (urgency_score BETWEEN 1 AND 10),
    is_urgent BOOLEAN DEFAULT FALSE,

    -- Status
    task_status VARCHAR(50) DEFAULT 'pending' CHECK (task_status IN (
        'pending', 'assigned', 'accepted', 'in_progress', 'on_hold',
        'completed', 'verified', 'rejected', 'cancelled', 'deferred'
    )),
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),

    -- Scheduling
    due_date DATE,
    due_time TIME,
    scheduled_start_time TIMESTAMP WITH TIME ZONE,
    scheduled_end_time TIMESTAMP WITH TIME ZONE,
    estimated_duration_minutes INTEGER,

    -- Actual Time
    actual_start_time TIMESTAMP WITH TIME ZONE,
    actual_end_time TIMESTAMP WITH TIME ZONE,
    actual_duration_minutes INTEGER,

    -- Location
    location_type VARCHAR(50) CHECK (location_type IN ('room', 'area', 'floor', 'building', 'outdoor', 'multiple', 'other')),
    room_id UUID,
    room_number VARCHAR(20),
    floor_number INTEGER,
    area_name VARCHAR(100),
    specific_location TEXT,

    -- Related Entities
    reservation_id UUID,
    guest_id UUID,
    maintenance_request_id UUID,
    housekeeping_task_id UUID,

    -- Requirements
    required_skills VARCHAR(100)[],
    required_equipment VARCHAR(100)[],
    required_supplies JSONB, -- [{item, quantity, unit}]
    safety_requirements TEXT,

    -- Instructions
    instructions TEXT,
    step_by_step_guide JSONB, -- [{step, description, estimated_time}]
    special_instructions TEXT,
    safety_notes TEXT,

    -- Checklist
    has_checklist BOOLEAN DEFAULT FALSE,
    checklist_items JSONB, -- [{item, completed, notes}]
    checklist_completed_count INTEGER DEFAULT 0,
    checklist_total_count INTEGER DEFAULT 0,

    -- Acceptance
    accepted BOOLEAN DEFAULT FALSE,
    accepted_by UUID,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- Completion
    completed BOOLEAN DEFAULT FALSE,
    completed_by UUID,
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,

    -- Verification
    requires_verification BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    verification_passed BOOLEAN,

    -- Performance
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 5),
    quality_notes TEXT,
    efficiency_rating INTEGER CHECK (efficiency_rating BETWEEN 1 AND 5),

    is_overdue BOOLEAN DEFAULT FALSE,
    overdue_by_minutes INTEGER,

    -- Dependencies
    depends_on_tasks UUID[],
    blocks_tasks UUID[],
    all_dependencies_met BOOLEAN DEFAULT TRUE,

    -- Recurrence
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50) CHECK (recurrence_pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'custom')),
    recurrence_days VARCHAR(10)[], -- ['monday', 'wednesday', 'friday']
    recurrence_time TIME,
    recurrence_end_date DATE,
    parent_task_id UUID,

    -- Issues & Blockers
    has_issues BOOLEAN DEFAULT FALSE,
    issues JSONB, -- [{issue_type, description, reported_at, resolved}]
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE,
    blocked_by UUID,

    -- Photos & Documentation
    photos_required BOOLEAN DEFAULT FALSE,
    photos_count INTEGER DEFAULT 0,
    photo_urls TEXT[],

    documents_attached BOOLEAN DEFAULT FALSE,
    document_urls TEXT[],

    -- Cost Tracking
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    materials_cost DECIMAL(10,2),
    labor_cost DECIMAL(10,2),

    -- Guest Impact
    guest_facing BOOLEAN DEFAULT FALSE,
    guest_satisfaction_impact VARCHAR(50) CHECK (guest_satisfaction_impact IN ('none', 'low', 'medium', 'high', 'critical')),
    guest_notification_required BOOLEAN DEFAULT FALSE,
    guest_notified BOOLEAN DEFAULT FALSE,

    -- Notifications
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    escalation_sent BOOLEAN DEFAULT FALSE,
    escalated_to UUID,
    escalated_at TIMESTAMP WITH TIME ZONE,

    -- Comments & Communication
    comments_count INTEGER DEFAULT 0,
    last_comment_at TIMESTAMP WITH TIME ZONE,

    -- Approval
    requires_approval BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,

    -- SLA
    sla_hours INTEGER,
    sla_due_at TIMESTAMP WITH TIME ZONE,
    sla_breached BOOLEAN DEFAULT FALSE,

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],
    notes TEXT,

    -- Standard Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- Indexes for staff_tasks
CREATE INDEX idx_staff_tasks_tenant ON staff_tasks(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_property ON staff_tasks(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_number ON staff_tasks(task_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_type ON staff_tasks(task_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_assigned_to ON staff_tasks(assigned_to) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_assigned_department ON staff_tasks(assigned_department) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_priority ON staff_tasks(priority) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_status ON staff_tasks(task_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_pending ON staff_tasks(task_status) WHERE task_status IN ('pending', 'assigned') AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_urgent ON staff_tasks(is_urgent, priority) WHERE is_urgent = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_due_date ON staff_tasks(due_date) WHERE due_date IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_overdue ON staff_tasks(is_overdue) WHERE is_overdue = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_room ON staff_tasks(room_id) WHERE room_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_reservation ON staff_tasks(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_guest ON staff_tasks(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_completed ON staff_tasks(completed, completed_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_verification ON staff_tasks(requires_verification, verified) WHERE requires_verification = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_recurring ON staff_tasks(is_recurring, recurrence_pattern) WHERE is_recurring = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_blocked ON staff_tasks(is_blocked) WHERE is_blocked = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_sla ON staff_tasks(sla_breached) WHERE sla_breached = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_checklist ON staff_tasks USING gin(checklist_items) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_issues ON staff_tasks USING gin(issues) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_metadata ON staff_tasks USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_tags ON staff_tasks USING gin(tags) WHERE is_deleted = FALSE;

-- Composite Indexes for Common Queries
CREATE INDEX idx_staff_tasks_property_status ON staff_tasks(property_id, task_status, priority DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_assigned_status ON staff_tasks(assigned_to, task_status, due_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_department_status ON staff_tasks(assigned_department, task_status, priority DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_due_today ON staff_tasks(property_id, due_date, task_status) WHERE due_date = CURRENT_DATE AND task_status NOT IN ('completed', 'cancelled') AND is_deleted = FALSE;
CREATE INDEX idx_staff_tasks_in_progress ON staff_tasks(property_id, assigned_to, task_status) WHERE task_status = 'in_progress' AND is_deleted = FALSE;

-- Comments
COMMENT ON TABLE staff_tasks IS 'Task assignment and tracking system for staff members with progress monitoring';
COMMENT ON COLUMN staff_tasks.task_type IS 'Type of task: housekeeping, maintenance, inspection, delivery, guest_request, etc';
COMMENT ON COLUMN staff_tasks.priority IS 'Task priority: low, normal, high, urgent, critical';
COMMENT ON COLUMN staff_tasks.checklist_items IS 'JSON array of checklist items with completion status';
COMMENT ON COLUMN staff_tasks.step_by_step_guide IS 'JSON array of step-by-step instructions with estimated times';
