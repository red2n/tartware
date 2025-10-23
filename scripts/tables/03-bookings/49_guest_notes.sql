-- =====================================================
-- Guest Notes Table
-- =====================================================
-- Purpose: Internal staff notes and alerts about guests
-- Key Features:
--   - Preference tracking
--   - Complaint/compliment recording
--   - Alert system for special requirements
--   - Resolution tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS guest_notes (
    -- Primary Key
    note_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Guest & Reservation Reference
    guest_id UUID NOT NULL,
    reservation_id UUID,

    -- Note Classification
    note_type VARCHAR(50) NOT NULL CHECK (note_type IN ('preference', 'complaint', 'compliment', 'special_request', 'allergy', 'medical', 'dietary', 'accessibility', 'vip', 'warning', 'incident', 'feedback', 'general')),
    note_category VARCHAR(100),
    severity VARCHAR(20) CHECK (severity IN ('info', 'low', 'normal', 'high', 'critical')),
    priority VARCHAR(20) CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'critical')),

    -- Note Content
    subject VARCHAR(255),
    note_text TEXT NOT NULL,

    -- Alert Configuration
    is_alert BOOLEAN DEFAULT FALSE,
    alert_level VARCHAR(20) CHECK (alert_level IN ('info', 'warning', 'critical', 'urgent')),
    alert_trigger VARCHAR(100)[], -- ['checkin', 'checkout', 'reservation', 'pos']
    show_on_reservation BOOLEAN DEFAULT TRUE,
    show_on_checkin BOOLEAN DEFAULT FALSE,
    show_on_checkout BOOLEAN DEFAULT FALSE,
    show_at_pos BOOLEAN DEFAULT FALSE,
    show_at_frontdesk BOOLEAN DEFAULT TRUE,
    show_in_housekeeping BOOLEAN DEFAULT FALSE,

    -- Visibility & Privacy
    is_private BOOLEAN DEFAULT FALSE,
    is_internal_only BOOLEAN DEFAULT TRUE,
    visible_to_roles VARCHAR(100)[],
    visible_to_departments VARCHAR(100)[],
    hide_from_guest BOOLEAN DEFAULT TRUE,

    -- Action Required
    requires_action BOOLEAN DEFAULT FALSE,
    action_required VARCHAR(255),
    action_deadline TIMESTAMP WITH TIME ZONE,
    assigned_to UUID,
    assigned_department VARCHAR(100),

    -- Status & Resolution
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'closed', 'escalated')),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    resolution_notes TEXT,
    resolution_action_taken TEXT,

    -- Follow-up
    requires_followup BOOLEAN DEFAULT FALSE,
    followup_date DATE,
    followup_completed BOOLEAN DEFAULT FALSE,
    followup_notes TEXT,

    -- Guest Impact
    guest_satisfaction_impact VARCHAR(50) CHECK (guest_satisfaction_impact IN ('positive', 'neutral', 'negative', 'critical')),
    compensation_provided BOOLEAN DEFAULT FALSE,
    compensation_amount DECIMAL(10,2),
    compensation_type VARCHAR(100),

    -- Audit Trail
    created_by UUID NOT NULL,
    created_by_name VARCHAR(200),
    created_by_role VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    acknowledged_by UUID,
    acknowledged_at TIMESTAMP WITH TIME ZONE,

    -- Related Notes
    parent_note_id UUID,
    related_note_ids UUID[],

    -- Attachments
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INTEGER DEFAULT 0,
    attachment_references JSONB,

    -- Metadata
    metadata JSONB,
    tags VARCHAR(100)[],

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);


-- Comments
COMMENT ON TABLE guest_notes IS 'Internal staff notes, alerts, and comments about guests for operational use';
COMMENT ON COLUMN guest_notes.note_type IS 'Type of note: preference, complaint, compliment, special_request, allergy, medical, etc.';
COMMENT ON COLUMN guest_notes.alert_trigger IS 'Array of contexts where alert should be shown: checkin, checkout, reservation, pos';
COMMENT ON COLUMN guest_notes.visible_to_roles IS 'Array of roles that can view this note';
COMMENT ON COLUMN guest_notes.hide_from_guest IS 'If true, note is internal only and should never be shown to guest';
