-- =====================================================
-- 17_property_events.sql
-- Property Events & Announcements
-- Industry Standard: OPERA Cloud (PROPERTY_EVENTS),
--                    Mews (ANNOUNCEMENTS)
-- Pattern: Property-level events and staff announcements
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- PROPERTY_EVENTS TABLE
-- Property-level events (holidays, special occasions,
-- local events) that affect operations and pricing
-- =====================================================

CREATE TABLE IF NOT EXISTS property_events (
    -- Primary Key
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),       -- Unique event identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                    -- FK tenants.id
    property_id UUID NOT NULL,                                  -- FK properties.id

    -- Event Information
    event_code VARCHAR(50) NOT NULL,                            -- Short code (e.g., 'NYE-2026', 'MARATHON-MAR')
    event_name VARCHAR(200) NOT NULL,                           -- Display name (e.g., 'New Year''s Eve Gala')
    event_description TEXT,                                      -- Detailed description

    -- Classification
    event_type VARCHAR(50) NOT NULL CHECK (
        event_type IN (
            'HOLIDAY',          -- Public holiday
            'LOCAL_EVENT',      -- City/area event (marathon, festival)
            'PROPERTY_EVENT',   -- Hotel-specific event (gala, wine tasting)
            'CONFERENCE',       -- Conference/convention in area
            'SPORTS',           -- Sporting event nearby
            'CONCERT',          -- Concert/music event
            'SEASONAL',         -- Seasonal event (Christmas markets, etc.)
            'MAINTENANCE',      -- Planned maintenance affecting operations
            'TRAINING',         -- Staff training event
            'VIP_ARRIVAL',      -- VIP arrival alert
            'OTHER'             -- Other event
        )
    ),                                                          -- Event classification

    -- Date & Time
    start_date DATE NOT NULL,                                   -- Event start date
    end_date DATE NOT NULL,                                     -- Event end date
    start_time TIME,                                            -- Event start time (if applicable)
    end_time TIME,                                              -- Event end time (if applicable)
    all_day BOOLEAN DEFAULT TRUE,                               -- Full-day event

    -- Impact
    impact_level VARCHAR(20) DEFAULT 'LOW' CHECK (
        impact_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    ),                                                          -- Operations impact level
    affects_pricing BOOLEAN DEFAULT FALSE,                     -- Should trigger rate adjustments
    affects_availability BOOLEAN DEFAULT FALSE,                -- Impacts room availability
    affects_staffing BOOLEAN DEFAULT FALSE,                    -- Requires staffing changes
    expected_occupancy_impact_percent DECIMAL(5, 2),           -- Expected occupancy impact (+/-)
    demand_multiplier DECIMAL(4, 2) DEFAULT 1.0,              -- Rate multiplier for revenue management

    -- Visibility
    is_public BOOLEAN DEFAULT TRUE,                            -- Visible to guests
    show_on_website BOOLEAN DEFAULT FALSE,                     -- Display on property website
    show_in_app BOOLEAN DEFAULT FALSE,                         -- Display in guest app
    show_to_staff BOOLEAN DEFAULT TRUE,                        -- Display in staff dashboard

    -- Location
    event_location VARCHAR(200),                                -- Where the event takes place
    distance_from_property_km DECIMAL(6, 2),                   -- Distance from property

    -- Recurrence
    is_recurring BOOLEAN DEFAULT FALSE,                        -- Is this a recurring event
    recurrence_pattern VARCHAR(50),                             -- ANNUALLY, MONTHLY, WEEKLY
    parent_event_id UUID,                                       -- Reference to original event in series

    -- Status
    event_status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (
        event_status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')
    ),                                                          -- Event lifecycle status
    is_active BOOLEAN DEFAULT TRUE,                            -- Active/inactive

    -- Media
    image_url VARCHAR(500),                                    -- Event image
    external_url VARCHAR(500),                                 -- Link to external event page

    -- Notes
    internal_notes TEXT,                                        -- Staff-only notes
    guest_facing_notes TEXT,                                    -- Notes visible to guests
    operational_notes TEXT,                                     -- Operations impact notes

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                        -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- Creation timestamp
    updated_at TIMESTAMP,                                      -- Last update timestamp
    created_by UUID,                                           -- Creator identifier
    updated_by UUID,                                           -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                          -- Soft delete flag
    deleted_at TIMESTAMP,                                      -- Deletion timestamp
    deleted_by UUID,                                           -- Deleter identifier

    -- Constraints
    CONSTRAINT property_events_code_unique UNIQUE (tenant_id, property_id, event_code),
    CONSTRAINT property_events_date_check CHECK (end_date >= start_date)
);

-- =====================================================
-- ANNOUNCEMENTS TABLE
-- Internal staff announcements and guest-facing notices
-- =====================================================

CREATE TABLE IF NOT EXISTS announcements (
    -- Primary Key
    announcement_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique announcement identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                     -- FK tenants.id
    property_id UUID,                                            -- FK properties.id (NULL = tenant-wide)

    -- Announcement Content
    title VARCHAR(200) NOT NULL,                                 -- Announcement title
    body TEXT NOT NULL,                                           -- Announcement body (Markdown supported)
    summary VARCHAR(500),                                        -- Short summary for previews

    -- Classification
    announcement_type VARCHAR(50) NOT NULL CHECK (
        announcement_type IN (
            'OPERATIONAL',     -- Day-to-day operational update
            'POLICY',          -- Policy change
            'MAINTENANCE',     -- Maintenance notification
            'SAFETY',          -- Safety/emergency notice
            'HR',              -- Human resources
            'CELEBRATION',     -- Team celebration/recognition
            'TRAINING',        -- Training announcement
            'GUEST_NOTICE',    -- Guest-facing notice
            'SYSTEM',          -- System/IT update
            'GENERAL'          -- General announcement
        )
    ),                                                            -- Announcement classification

    -- Audience
    audience VARCHAR(20) NOT NULL DEFAULT 'STAFF' CHECK (
        audience IN ('STAFF', 'GUESTS', 'ALL')
    ),                                                            -- Target audience
    target_roles TEXT[],                                          -- Specific roles (if staff-targeted)
    target_departments TEXT[],                                    -- Specific departments

    -- Priority
    priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (
        priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')
    ),                                                            -- Display priority
    is_pinned BOOLEAN DEFAULT FALSE,                             -- Pin to top of feed

    -- Scheduling
    publish_at TIMESTAMP,                                         -- Scheduled publish time (NULL = immediate)
    expire_at TIMESTAMP,                                          -- Auto-expire time
    is_published BOOLEAN DEFAULT FALSE,                          -- Published state
    published_at TIMESTAMP,                                       -- Actual publish time
    published_by UUID,                                            -- Who published

    -- Acknowledgment
    requires_acknowledgment BOOLEAN DEFAULT FALSE,               -- Staff must acknowledge
    acknowledgment_deadline TIMESTAMP,                            -- Deadline to acknowledge

    -- Media
    image_url VARCHAR(500),                                      -- Announcement image
    attachment_urls JSONB DEFAULT '[]'::jsonb,                   -- File attachments

    -- Status
    is_active BOOLEAN DEFAULT TRUE,                              -- Active/inactive

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                          -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,     -- Creation timestamp
    updated_at TIMESTAMP,                                        -- Last update timestamp
    created_by UUID,                                             -- Creator identifier
    updated_by UUID,                                             -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                            -- Soft delete flag
    deleted_at TIMESTAMP,                                        -- Deletion timestamp
    deleted_by UUID                                              -- Deleter identifier
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE property_events IS 'Property-level events (holidays, local events, property events) that affect operations, pricing, and demand';
COMMENT ON COLUMN property_events.event_id IS 'Unique event identifier (UUID)';
COMMENT ON COLUMN property_events.event_code IS 'Short code for reports (e.g., NYE-2026, MARATHON-MAR)';
COMMENT ON COLUMN property_events.event_type IS 'Type: HOLIDAY, LOCAL_EVENT, PROPERTY_EVENT, CONFERENCE, SPORTS, etc.';
COMMENT ON COLUMN property_events.impact_level IS 'Operations impact: LOW, MEDIUM, HIGH, CRITICAL';
COMMENT ON COLUMN property_events.affects_pricing IS 'TRUE if event should trigger rate adjustments';
COMMENT ON COLUMN property_events.demand_multiplier IS 'Revenue management rate multiplier (1.0 = no change, 1.5 = 50% increase)';
COMMENT ON COLUMN property_events.expected_occupancy_impact_percent IS 'Expected occupancy change (+/-) as percentage';

COMMENT ON TABLE announcements IS 'Internal staff announcements and guest-facing notices with scheduling, priority, and acknowledgment tracking';
COMMENT ON COLUMN announcements.announcement_id IS 'Unique announcement identifier (UUID)';
COMMENT ON COLUMN announcements.announcement_type IS 'Type: OPERATIONAL, POLICY, MAINTENANCE, SAFETY, HR, GUEST_NOTICE, etc.';
COMMENT ON COLUMN announcements.audience IS 'Target audience: STAFF, GUESTS, or ALL';
COMMENT ON COLUMN announcements.priority IS 'Display priority: LOW, NORMAL, HIGH, URGENT';
COMMENT ON COLUMN announcements.requires_acknowledgment IS 'TRUE if staff must acknowledge reading this announcement';
COMMENT ON COLUMN announcements.is_pinned IS 'TRUE to pin announcement to top of feed';

\echo 'property_events and announcements tables created successfully!'
