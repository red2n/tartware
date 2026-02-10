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


-- Comments
COMMENT ON TABLE staff_schedules IS 'Manages staff work schedules, shift planning, and attendance tracking';
COMMENT ON COLUMN staff_schedules.shift_type IS 'Type of shift: morning, afternoon, evening, night, split, on_call, full_day, custom';
COMMENT ON COLUMN staff_schedules.schedule_status IS 'Current status: draft, scheduled, confirmed, in_progress, completed, no_show, cancelled, swapped, adjusted';
COMMENT ON COLUMN staff_schedules.overtime_rate_multiplier IS 'Multiplier for overtime pay (e.g., 1.5 for time-and-a-half)';
COMMENT ON COLUMN staff_schedules.assigned_tasks IS 'JSON array of tasks assigned during this shift';

\echo 'staff_schedules table created successfully!'

\echo 'staff_schedules table created successfully!'

\echo 'staff_schedules table created successfully!'
