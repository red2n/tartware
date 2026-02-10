-- =====================================================
-- Shift Handovers Table
-- =====================================================
-- Purpose: Document shift handover information and continuity
-- Key Features:
--   - Shift transition documentation
--   - Important notes transfer
--   - Task handoff tracking
--   - Issue escalation
-- =====================================================

CREATE TABLE IF NOT EXISTS shift_handovers (
    -- Primary Key
    handover_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Handover Identification
    handover_number VARCHAR(50) UNIQUE,
    handover_title VARCHAR(255),

    -- Shift Information
    shift_date DATE NOT NULL,

    -- Outgoing Shift
    outgoing_shift VARCHAR(50) NOT NULL CHECK (outgoing_shift IN ('morning', 'afternoon', 'evening', 'night')),
    outgoing_shift_start TIME,
    outgoing_shift_end TIME,
    outgoing_user_id UUID NOT NULL,
    outgoing_user_name VARCHAR(200),

    -- Incoming Shift
    incoming_shift VARCHAR(50) NOT NULL CHECK (incoming_shift IN ('morning', 'afternoon', 'evening', 'night')),
    incoming_shift_start TIME,
    incoming_shift_end TIME,
    incoming_user_id UUID NOT NULL,
    incoming_user_name VARCHAR(200),

    -- Department
    department VARCHAR(100) NOT NULL CHECK (department IN (
        'front_desk', 'housekeeping', 'maintenance', 'food_beverage',
        'management', 'sales', 'security', 'spa', 'concierge', 'other'
    )),

    -- Handover Status
    handover_status VARCHAR(50) DEFAULT 'pending' CHECK (handover_status IN (
        'pending', 'in_progress', 'completed', 'acknowledged', 'escalated'
    )),

    -- Timing
    handover_started_at TIMESTAMP WITH TIME ZONE,
    handover_completed_at TIMESTAMP WITH TIME ZONE,
    handover_duration_minutes INTEGER,

    -- Occupancy & Property Status
    current_occupancy_count INTEGER,
    current_occupancy_percent DECIMAL(5,2),
    expected_arrivals_count INTEGER,
    expected_departures_count INTEGER,
    in_house_guests_count INTEGER,

    -- Room Status Summary
    rooms_occupied INTEGER,
    rooms_vacant_clean INTEGER,
    rooms_vacant_dirty INTEGER,
    rooms_out_of_order INTEGER,
    rooms_blocked INTEGER,

    -- Reservations Summary
    reservations_arriving_today INTEGER,
    reservations_departing_today INTEGER,
    reservations_in_house INTEGER,
    vip_guests_in_house INTEGER,
    group_reservations_active INTEGER,

    -- Outstanding Tasks
    tasks_pending INTEGER DEFAULT 0,
    tasks_urgent INTEGER DEFAULT 0,
    tasks_overdue INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_details JSONB, -- [{task_id, description, priority, status}]

    -- Key Information
    key_points TEXT NOT NULL,
    important_notes TEXT,
    urgent_matters TEXT,

    -- Guest Issues
    guest_issues JSONB, -- [{guest_name, room, issue, status, actions_taken}]
    guest_complaints_count INTEGER DEFAULT 0,
    guest_requests_pending INTEGER DEFAULT 0,
    guest_special_attention JSONB,

    -- VIP Information
    vip_arrivals JSONB, -- [{guest_name, room, arrival_time, special_requirements}]
    vip_in_house JSONB,
    vip_departures JSONB,

    -- Maintenance Issues
    maintenance_issues JSONB, -- [{location, issue, urgency, status}]
    equipment_failures JSONB,
    safety_concerns JSONB,

    -- Inventory Status
    inventory_alerts JSONB, -- [{item, current_level, reorder_needed}]
    supplies_low BOOLEAN DEFAULT FALSE,
    supplies_needed TEXT,

    -- Financial Summary
    cash_on_hand DECIMAL(10,2),
    deposits_to_make DECIMAL(10,2),
    outstanding_payments DECIMAL(10,2),
    payment_issues TEXT,

    -- Security & Safety
    security_incidents JSONB, -- [{time, description, action_taken, follow_up}]
    safety_issues JSONB,
    access_control_notes TEXT,

    -- Staff Notes
    staff_availability JSONB, -- [{staff_name, status, notes}]
    staff_issues TEXT,
    coverage_concerns TEXT,

    -- Follow-up Required
    requires_follow_up BOOLEAN DEFAULT FALSE,
    follow_up_items JSONB, -- [{item, priority, deadline, assigned_to}]
    follow_up_count INTEGER DEFAULT 0,

    -- Escalations
    escalated_issues JSONB, -- [{issue, escalated_to, escalated_at, reason}]
    escalation_count INTEGER DEFAULT 0,

    -- Events & Special Situations
    upcoming_events JSONB, -- [{event_name, date, time, impact}]
    special_situations TEXT,
    weather_concerns TEXT,

    -- Checklist
    handover_checklist JSONB, -- [{item, completed, notes}]
    checklist_completed BOOLEAN DEFAULT FALSE,

    -- Systems & Equipment
    system_status JSONB, -- [{system_name, status, issues}]
    equipment_status JSONB,
    technology_issues TEXT,

    -- Acknowledgment
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledgment_notes TEXT,

    -- Questions & Clarifications
    questions_asked TEXT,
    clarifications_provided TEXT,
    additional_information TEXT,

    -- Ratings
    handover_quality_rating INTEGER CHECK (handover_quality_rating BETWEEN 1 AND 5),
    information_completeness_rating INTEGER CHECK (information_completeness_rating BETWEEN 1 AND 5),

    -- Attachments
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_urls TEXT[],
    photo_urls TEXT[],

    -- Manager Review
    reviewed_by_manager BOOLEAN DEFAULT FALSE,
    manager_id UUID,
    manager_review_notes TEXT,
    manager_review_at TIMESTAMP WITH TIME ZONE,

    -- Linked Documents
    incident_reports UUID[],
    maintenance_requests UUID[],
    guest_complaints UUID[],

    -- Previous Handover
    previous_handover_id UUID,

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


-- Comments
COMMENT ON TABLE shift_handovers IS 'Documents shift handover information, tasks, issues, and continuity notes';
COMMENT ON COLUMN shift_handovers.key_points IS 'Most important information to communicate during handover';
COMMENT ON COLUMN shift_handovers.tasks_details IS 'JSON array of pending tasks with priority and status';
COMMENT ON COLUMN shift_handovers.guest_issues IS 'JSON array of current guest issues requiring attention';
COMMENT ON COLUMN shift_handovers.follow_up_items IS 'JSON array of items requiring follow-up action';

\echo 'shift_handovers table created successfully!'
