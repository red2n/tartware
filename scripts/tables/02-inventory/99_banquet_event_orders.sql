-- =====================================================
-- 104_banquet_event_orders.sql
-- Banquet Event Order (BEO) Management
--
-- Purpose: Detailed catering and setup instructions for events
-- Industry Standard: OPERA (BEO), Delphi.fdc (FUNCTION_DETAIL),
--                    Protel (VERANSTALTUNGS_DETAILS), Cvent (EVENT_SPEC)
--
-- Use Cases:
-- - Detailed food & beverage orders
-- - Setup and teardown instructions
-- - Equipment and AV requirements
-- - Timeline and service schedules
-- - Kitchen and service staff coordination
--
-- The BEO is the master document used by all departments
-- =====================================================

\c tartware

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS banquet_event_orders CASCADE;

CREATE TABLE banquet_event_orders (
    -- Primary Key
    beo_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique BEO identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL, -- FK tenants.id
    property_id UUID NOT NULL, -- FK properties.id

    -- Linked Event
    event_booking_id UUID NOT NULL, -- Reference to event_bookings

    -- BEO Information
    beo_number VARCHAR(50) NOT NULL, -- Human-readable BEO number
    beo_version INTEGER DEFAULT 1, -- Versioning for revisions
    beo_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (beo_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),

    -- Revision Tracking
    revision_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Timestamp of latest revision
    revision_reason TEXT, -- Reason for change
    previous_beo_id UUID, -- Reference to previous version

    -- Timeline
    event_date DATE NOT NULL, -- Event date
    setup_start_time TIME NOT NULL, -- Setup crew start
    event_start_time TIME NOT NULL, -- Scheduled start time
    event_end_time TIME NOT NULL, -- Scheduled end time
    teardown_end_time TIME, -- Teardown completion
    room_release_time TIME, -- Room release time

    -- Room & Setup
    meeting_room_id UUID NOT NULL, -- Linked meeting room
    room_setup VARCHAR(50) NOT NULL, -- THEATER, CLASSROOM, BANQUET, etc.
    tables_count INTEGER, -- Quantity of tables
    chairs_count INTEGER, -- Quantity of chairs
    table_configuration TEXT, -- Detailed table arrangement
    seating_chart_layout_url VARCHAR(500), -- Layout document

    -- Expected Numbers
    guaranteed_count INTEGER NOT NULL, -- For billing
    expected_count INTEGER,
    over_set_percentage DECIMAL(5, 2) DEFAULT 5.0, -- Extra place settings
    actual_count INTEGER, -- Post-event

    -- Menu & Food Service
    menu_type VARCHAR(50), -- BUFFET, PLATED, STATIONS, COCKTAIL, FAMILY_STYLE
    menu_items JSONB DEFAULT '[]'::jsonb, -- Detailed menu items
    service_style VARCHAR(50), -- BUTLER, BUFFET, PLATED, PASSED
    courses_count INTEGER,
    meal_service_start_time TIME,
    meal_service_duration_minutes INTEGER,

    -- Food Details (JSONB structure)
    -- Each item: {name, description, quantity, price, dietary_notes, presentation_style}
    appetizers JSONB DEFAULT '[]'::jsonb,
    salads JSONB DEFAULT '[]'::jsonb,
    entrees JSONB DEFAULT '[]'::jsonb,
    sides JSONB DEFAULT '[]'::jsonb,
    desserts JSONB DEFAULT '[]'::jsonb,
    stations JSONB DEFAULT '[]'::jsonb, -- Food stations

    -- Beverage Service
    bar_type VARCHAR(50), -- OPEN_BAR, CASH_BAR, HOST_BAR, LIMITED_BAR, NO_BAR
    bar_start_time TIME,
    bar_end_time TIME,
    bar_setup_location VARCHAR(100),
    beverages JSONB DEFAULT '[]'::jsonb,
    wine_service JSONB,
    coffee_tea_service BOOLEAN DEFAULT TRUE,
    water_service VARCHAR(50), -- BOTTLED, PITCHERS, GLASSES

    -- Dietary Restrictions
    vegetarian_count INTEGER DEFAULT 0,
    vegan_count INTEGER DEFAULT 0,
    gluten_free_count INTEGER DEFAULT 0,
    dairy_free_count INTEGER DEFAULT 0,
    nut_free_count INTEGER DEFAULT 0,
    kosher_count INTEGER DEFAULT 0,
    halal_count INTEGER DEFAULT 0,
    special_diets JSONB DEFAULT '[]'::jsonb, -- Other dietary needs

    -- Table Linens & Décor
    linen_color VARCHAR(50),
    linen_type VARCHAR(50), -- POLYESTER, COTTON, SATIN
    napkin_color VARCHAR(50),
    napkin_fold VARCHAR(50),
    table_skirting BOOLEAN DEFAULT FALSE,
    centerpieces TEXT,
    decor_description TEXT,
    candles BOOLEAN DEFAULT FALSE,
    floral_arrangements TEXT,

    -- Equipment & AV
    equipment_list JSONB DEFAULT '[]'::jsonb,
    av_equipment JSONB DEFAULT '[]'::jsonb,
    stage_required BOOLEAN DEFAULT FALSE,
    stage_dimensions VARCHAR(50),
    podium_required BOOLEAN DEFAULT FALSE,
    dance_floor_required BOOLEAN DEFAULT FALSE,
    special_lighting BOOLEAN DEFAULT FALSE,
    lighting_notes TEXT,

    -- Service Staff
    servers_count INTEGER,
    bartenders_count INTEGER,
    chefs_count INTEGER,
    captains_count INTEGER,
    coat_check_attendants INTEGER,
    valet_attendants INTEGER,
    security_guards INTEGER,

    -- Labor & Timing
    staff_arrival_time TIME,
    staff_meal_time TIME,
    staff_break_schedule TEXT,
    overtime_authorized BOOLEAN DEFAULT FALSE,

    -- Financial
    food_subtotal DECIMAL(10, 2),
    beverage_subtotal DECIMAL(10, 2),
    equipment_rental_total DECIMAL(10, 2),
    labor_charges DECIMAL(10, 2),
    service_charge_percent DECIMAL(5, 2) DEFAULT 22.0,
    service_charge_amount DECIMAL(10, 2),
    gratuity_percent DECIMAL(5, 2) DEFAULT 0,
    gratuity_amount DECIMAL(10, 2),
    tax_percent DECIMAL(5, 2),
    tax_amount DECIMAL(10, 2),
    total_estimated DECIMAL(12, 2),
    total_actual DECIMAL(12, 2),
    currency_code CHAR(3) DEFAULT 'USD',

    -- Billing Details
    billing_type VARCHAR(50), -- PER_PERSON, FLAT_FEE, CONSUMPTION
    price_per_person DECIMAL(10, 2),
    children_price DECIMAL(10, 2),
    children_count INTEGER DEFAULT 0,

    -- Special Instructions
    kitchen_instructions TEXT,
    service_instructions TEXT,
    setup_instructions TEXT,
    cleanup_instructions TEXT,
    audio_visual_instructions TEXT,

    -- Approvals
    client_approved BOOLEAN DEFAULT FALSE,
    client_approved_date TIMESTAMP,
    client_approved_by VARCHAR(200),
    client_signature_url VARCHAR(500),

    chef_approved BOOLEAN DEFAULT FALSE,
    chef_approved_date TIMESTAMP,
    chef_approved_by UUID,

    manager_approved BOOLEAN DEFAULT FALSE,
    manager_approved_date TIMESTAMP,
    manager_approved_by UUID,

    -- Execution Tracking
    setup_completed BOOLEAN DEFAULT FALSE,
    setup_completed_time TIMESTAMP,
    event_started BOOLEAN DEFAULT FALSE,
    event_started_time TIMESTAMP,
    event_ended BOOLEAN DEFAULT FALSE,
    event_ended_time TIMESTAMP,
    teardown_completed BOOLEAN DEFAULT FALSE,
    teardown_completed_time TIMESTAMP,

    -- Post-Event
    post_event_notes TEXT,
    issues_encountered TEXT,
    client_satisfaction_rating INTEGER CHECK (client_satisfaction_rating BETWEEN 1 AND 5),
    photos JSONB, -- Post-event photo URLs

    -- Communication
    last_sent_to_client TIMESTAMP,
    last_sent_to_kitchen TIMESTAMP,
    last_sent_to_setup TIMESTAMP,
    distribution_list TEXT[], -- Email addresses for BEO distribution

    -- Documents
    signed_beo_url VARCHAR(500),
    floor_plan_url VARCHAR(500),
    seating_chart_document_url VARCHAR(500),
    menu_card_url VARCHAR(500),

    -- Notes
    internal_notes TEXT,
    client_notes TEXT,
    allergy_warnings TEXT,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
    updated_at TIMESTAMP, -- Last update timestamp
    created_by UUID, -- Creator identifier
    updated_by UUID, -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Optimistic Locking
    version BIGINT DEFAULT 0, -- Concurrency version

    -- Constraints
    CONSTRAINT beo_number_unique UNIQUE (tenant_id, property_id, beo_number, beo_version),
    CONSTRAINT beo_count_check CHECK (guaranteed_count > 0),
    CONSTRAINT beo_time_check CHECK (event_end_time > event_start_time),
    CONSTRAINT beo_rating_check CHECK (
        client_satisfaction_rating IS NULL OR
        (client_satisfaction_rating >= 1 AND client_satisfaction_rating <= 5)
    )
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE banquet_event_orders IS 'Detailed banquet event orders (BEOs) with menu, setup, and service instructions';
COMMENT ON COLUMN banquet_event_orders.beo_id IS 'Unique BEO identifier (UUID)';
COMMENT ON COLUMN banquet_event_orders.beo_number IS 'Human-readable BEO number (e.g., "BEO-2025-001")';
COMMENT ON COLUMN banquet_event_orders.beo_version IS 'Version number for tracking revisions';
COMMENT ON COLUMN banquet_event_orders.guaranteed_count IS 'Guaranteed minimum attendees for billing';
COMMENT ON COLUMN banquet_event_orders.over_set_percentage IS 'Extra place settings as percentage (e.g., 5%)';
COMMENT ON COLUMN banquet_event_orders.menu_items IS 'Detailed menu items with descriptions and pricing (JSONB)';
COMMENT ON COLUMN banquet_event_orders.service_charge_percent IS 'Service charge percentage (typically 18-22%)';
COMMENT ON COLUMN banquet_event_orders.kitchen_instructions IS 'Special instructions for kitchen staff';
COMMENT ON COLUMN banquet_event_orders.distribution_list IS 'Email addresses to receive BEO copies';
COMMENT ON COLUMN banquet_event_orders.seating_chart_layout_url IS 'Layout preview for seating arrangements';
COMMENT ON COLUMN banquet_event_orders.metadata IS 'Custom fields and additional event specifications';

\echo 'Banquet event orders table created successfully!'
