-- =====================================================
-- Staff Schedules Table
-- =====================================================
-- Purpose: Manage staff work schedules and shift planning
-- Key Features:
--   - Shift scheduling and rostering
--   - Availability tracking
--   - Overtime management
--   - Schedule conflicts detection
-- =====================================================

CREATE TABLE IF NOT EXISTS staff_schedules (
    -- Primary Key
    schedule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Staff Member
    user_id UUID NOT NULL,
    staff_name VARCHAR(200),
    employee_number VARCHAR(100),

    -- Department & Role
    department VARCHAR(100) NOT NULL CHECK (department IN (
        'front_desk', 'housekeeping', 'maintenance', 'food_beverage',
        'management', 'sales', 'security', 'spa', 'concierge', 'other'
    )),
    role VARCHAR(100),
    position_title VARCHAR(200),

    -- Schedule Details
    schedule_date DATE NOT NULL,
    day_of_week VARCHAR(10) NOT NULL,
    week_number INTEGER,

    -- Shift Information
    shift_type VARCHAR(50) NOT NULL CHECK (shift_type IN (
        'morning', 'afternoon', 'evening', 'night',
        'split', 'on_call', 'full_day', 'custom'
    )),
    shift_name VARCHAR(100),

    -- Time
    scheduled_start_time TIME NOT NULL,
    scheduled_end_time TIME NOT NULL,
    scheduled_hours DECIMAL(5,2) NOT NULL,

    actual_start_time TIME,
    actual_end_time TIME,
    actual_hours DECIMAL(5,2),

    -- Break Times
    break_duration_minutes INTEGER DEFAULT 30,
    break_start_time TIME,
    break_end_time TIME,
    paid_break BOOLEAN DEFAULT FALSE,

    -- Location & Area
    work_location VARCHAR(100),
    assigned_area VARCHAR(100), -- Floor, section, zone
    work_station VARCHAR(100),

    -- Status
    schedule_status VARCHAR(50) DEFAULT 'scheduled' CHECK (schedule_status IN (
        'draft', 'scheduled', 'confirmed', 'in_progress', 'completed',
        'no_show', 'cancelled', 'swapped', 'adjusted'
    )),

    -- Attendance
    checked_in BOOLEAN DEFAULT FALSE,
    check_in_time TIMESTAMP WITH TIME ZONE,
    check_in_method VARCHAR(50) CHECK (check_in_method IN ('manual', 'biometric', 'rfid', 'mobile_app', 'system')),

    checked_out BOOLEAN DEFAULT FALSE,
    check_out_time TIMESTAMP WITH TIME ZONE,
    check_out_method VARCHAR(50),

    -- Time Tracking
    is_late BOOLEAN DEFAULT FALSE,
    late_by_minutes INTEGER,
    is_early_departure BOOLEAN DEFAULT FALSE,
    early_departure_minutes INTEGER,

    -- Overtime
    is_overtime BOOLEAN DEFAULT FALSE,
    overtime_hours DECIMAL(5,2),
    overtime_approved BOOLEAN DEFAULT FALSE,
    overtime_approved_by UUID,
    overtime_rate_multiplier DECIMAL(3,2) DEFAULT 1.5,

    -- Special Conditions
    is_holiday BOOLEAN DEFAULT FALSE,
    holiday_name VARCHAR(255),
    holiday_pay_multiplier DECIMAL(3,2) DEFAULT 2.0,

    is_weekend BOOLEAN DEFAULT FALSE,
    weekend_pay_multiplier DECIMAL(3,2) DEFAULT 1.5,

    -- Coverage & Replacement
    is_replacement_shift BOOLEAN DEFAULT FALSE,
    replacing_user_id UUID,
    replacement_reason VARCHAR(255),

    is_covered BOOLEAN DEFAULT TRUE,
    coverage_confirmed BOOLEAN DEFAULT FALSE,

    -- Swap Management
    is_swap_request BOOLEAN DEFAULT FALSE,
    swap_requested_by UUID,
    swap_requested_with UUID,
    swap_status VARCHAR(50) CHECK (swap_status IN ('pending', 'approved', 'rejected', 'completed')),
    swap_approved_by UUID,
    swap_approved_at TIMESTAMP WITH TIME ZONE,

    -- Task Assignment
    assigned_tasks JSONB, -- [{task_id, task_name, priority}]
    tasks_count INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,

    -- Special Instructions
    special_instructions TEXT,
    notes TEXT,
    manager_notes TEXT,

    -- Performance
    performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
    performance_notes TEXT,
    incidents_reported INTEGER DEFAULT 0,

    -- Conflicts & Issues
    has_conflicts BOOLEAN DEFAULT FALSE,
    conflict_reasons VARCHAR(255)[],
    conflict_resolved BOOLEAN DEFAULT FALSE,

    -- Availability Issues
    availability_status VARCHAR(50) CHECK (availability_status IN ('available', 'unavailable', 'limited', 'on_leave', 'sick')),
    unavailability_reason VARCHAR(255),

    -- Leave & Time Off
    is_leave BOOLEAN DEFAULT FALSE,
    leave_type VARCHAR(100) CHECK (leave_type IN (
        'vacation', 'sick', 'personal', 'bereavement',
        'maternity', 'paternity', 'jury_duty', 'other'
    )),
    leave_approved BOOLEAN DEFAULT FALSE,
    leave_approved_by UUID,

    -- Payroll Integration
    payroll_code VARCHAR(100),
    cost_center VARCHAR(100),
    hourly_rate DECIMAL(10,2),
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),

    -- Notifications
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,

    -- Publishing
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP WITH TIME ZONE,
    published_by UUID,

    -- Recurrence (for recurring schedules)
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_pattern VARCHAR(50) CHECK (recurrence_pattern IN ('daily', 'weekly', 'biweekly', 'monthly', 'custom')),
    recurrence_end_date DATE,
    parent_schedule_id UUID,

    -- Approval
    requires_approval BOOLEAN DEFAULT FALSE,
    approved BOOLEAN DEFAULT FALSE,
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],

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

-- Indexes for staff_schedules
CREATE INDEX idx_staff_schedules_tenant ON staff_schedules(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_property ON staff_schedules(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_user ON staff_schedules(user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_department ON staff_schedules(department) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_date ON staff_schedules(schedule_date) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_week ON staff_schedules(week_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_shift_type ON staff_schedules(shift_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_status ON staff_schedules(schedule_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_checked_in ON staff_schedules(checked_in, check_in_time) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_checked_out ON staff_schedules(checked_out) WHERE checked_out = FALSE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_overtime ON staff_schedules(is_overtime, overtime_approved) WHERE is_overtime = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_late ON staff_schedules(is_late) WHERE is_late = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_swap ON staff_schedules(is_swap_request, swap_status) WHERE is_swap_request = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_conflicts ON staff_schedules(has_conflicts, conflict_resolved) WHERE has_conflicts = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_leave ON staff_schedules(is_leave, leave_type) WHERE is_leave = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_published ON staff_schedules(is_published, published_at) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_approval ON staff_schedules(requires_approval, approved) WHERE requires_approval = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_assigned_tasks ON staff_schedules USING gin(assigned_tasks) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_metadata ON staff_schedules USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_tags ON staff_schedules USING gin(tags) WHERE is_deleted = FALSE;

-- Composite Indexes for Common Queries
CREATE INDEX idx_staff_schedules_property_date ON staff_schedules(property_id, schedule_date, department) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_user_date ON staff_schedules(user_id, schedule_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_department_date ON staff_schedules(department, schedule_date, shift_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_upcoming ON staff_schedules(property_id, schedule_date, scheduled_start_time) WHERE schedule_date >= CURRENT_DATE AND is_deleted = FALSE;
CREATE INDEX idx_staff_schedules_current_shift ON staff_schedules(property_id, schedule_date, checked_in) WHERE schedule_date = CURRENT_DATE AND checked_in = TRUE AND checked_out = FALSE AND is_deleted = FALSE;

-- Comments
COMMENT ON TABLE staff_schedules IS 'Manages staff work schedules, shift planning, and attendance tracking';
COMMENT ON COLUMN staff_schedules.shift_type IS 'Type of shift: morning, afternoon, evening, night, split, on_call, full_day, custom';
COMMENT ON COLUMN staff_schedules.schedule_status IS 'Current status: draft, scheduled, confirmed, in_progress, completed, no_show, cancelled, swapped, adjusted';
COMMENT ON COLUMN staff_schedules.overtime_rate_multiplier IS 'Multiplier for overtime pay (e.g., 1.5 for time-and-a-half)';
COMMENT ON COLUMN staff_schedules.assigned_tasks IS 'JSON array of tasks assigned during this shift';
