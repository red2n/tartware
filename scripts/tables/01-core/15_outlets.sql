-- =====================================================
-- 15_outlets.sql
-- Food & Beverage Outlets and Service Points
-- Industry Standard: OPERA Cloud (OUTLET), Protel (VERKAUFSSTELLE),
--                    Micros POS (REVENUE_CENTER)
-- Pattern: Revenue centers within a property
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- OUTLETS TABLE
-- F&B outlets, retail shops, spa reception, and other
-- revenue-generating service points within a property
-- =====================================================

CREATE TABLE IF NOT EXISTS outlets (
    -- Primary Key
    outlet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),   -- Unique outlet identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                 -- FK tenants.id
    property_id UUID NOT NULL,                               -- FK properties.id
    building_id UUID,                                        -- FK buildings.building_id (optional)

    -- Outlet Identification
    outlet_code VARCHAR(50) NOT NULL,                        -- Short code (e.g., 'REST-MAIN', 'BAR-POOL', 'SPA-REC')
    outlet_name VARCHAR(200) NOT NULL,                       -- Display name (e.g., 'The Grand Restaurant')
    outlet_type VARCHAR(50) NOT NULL CHECK (
        outlet_type IN (
            'RESTAURANT',       -- Full-service restaurant
            'BAR',              -- Bar/lounge
            'CAFE',             -- Coffee shop/café
            'ROOM_SERVICE',     -- In-room dining
            'POOL_BAR',         -- Pool-side bar
            'BANQUET',          -- Banquet/event catering
            'RETAIL',           -- Gift shop/retail
            'SPA',              -- Spa reception
            'GYM',              -- Fitness center
            'BUSINESS_CENTER',  -- Business center
            'CONCIERGE',        -- Concierge desk
            'VALET',            -- Valet service
            'OTHER'             -- Other revenue center
        )
    ),                                                       -- Outlet classification

    -- Cuisine (for F&B outlets)
    cuisine_type VARCHAR(100),                               -- Italian, Asian, Fusion, etc.
    dining_style VARCHAR(50),                                -- FINE_DINING, CASUAL, BUFFET, QUICK_SERVICE

    -- Capacity
    seating_capacity INTEGER,                                -- Total seats
    indoor_seats INTEGER,                                    -- Indoor seating
    outdoor_seats INTEGER,                                   -- Outdoor/terrace seating
    private_dining_capacity INTEGER,                         -- Private dining room capacity
    bar_seats INTEGER,                                       -- Bar counter seats

    -- Location
    floor INTEGER,                                           -- Floor number
    location_description VARCHAR(200),                       -- e.g., 'Lobby Level, East Wing'

    -- Operating Hours
    breakfast_open TIME,                                      -- Breakfast start
    breakfast_close TIME,                                     -- Breakfast end
    lunch_open TIME,                                          -- Lunch start
    lunch_close TIME,                                         -- Lunch end
    dinner_open TIME,                                         -- Dinner start
    dinner_close TIME,                                        -- Dinner end
    all_day_open TIME,                                        -- All-day dining start
    all_day_close TIME,                                       -- All-day dining end
    operating_days VARCHAR(50),                               -- e.g., 'Mon-Sun', 'Tue-Sat'
    seasonal BOOLEAN DEFAULT FALSE,                          -- Seasonal operation
    seasonal_open_date DATE,                                  -- Season start
    seasonal_close_date DATE,                                 -- Season end

    -- Meal Periods
    serves_breakfast BOOLEAN DEFAULT FALSE,                  -- Breakfast service
    serves_lunch BOOLEAN DEFAULT FALSE,                      -- Lunch service
    serves_dinner BOOLEAN DEFAULT FALSE,                     -- Dinner service
    serves_brunch BOOLEAN DEFAULT FALSE,                     -- Brunch service
    serves_afternoon_tea BOOLEAN DEFAULT FALSE,              -- Afternoon tea
    serves_all_day BOOLEAN DEFAULT FALSE,                    -- All-day dining
    serves_room_service BOOLEAN DEFAULT FALSE,               -- Room service from this outlet

    -- Financial
    revenue_center_code VARCHAR(50),                         -- POS revenue center code
    gl_account VARCHAR(50),                                  -- GL account for posting
    charge_code VARCHAR(50),                                 -- Default charge code for folio posting
    average_check DECIMAL(10, 2),                            -- Average guest check
    currency_code CHAR(3) DEFAULT 'USD',                     -- Currency

    -- Contact
    phone_extension VARCHAR(20),                             -- Internal phone extension
    direct_phone VARCHAR(20),                                -- Direct dial number
    email VARCHAR(255),                                      -- Outlet email
    reservation_email VARCHAR(255),                          -- Reservations email

    -- Features
    dress_code VARCHAR(100),                                 -- Dress code description
    reservations_required BOOLEAN DEFAULT FALSE,             -- Reservations needed
    walk_ins_accepted BOOLEAN DEFAULT TRUE,                  -- Walk-ins welcome
    wheelchair_accessible BOOLEAN DEFAULT TRUE,              -- Accessibility
    child_friendly BOOLEAN DEFAULT TRUE,                     -- Family friendly
    pet_friendly BOOLEAN DEFAULT FALSE,                      -- Pets allowed
    live_entertainment BOOLEAN DEFAULT FALSE,                -- Live music/entertainment
    has_happy_hour BOOLEAN DEFAULT FALSE,                    -- Happy hour available

    -- POS Integration
    pos_system VARCHAR(100),                                 -- POS system name (Micros, Square, etc.)
    pos_terminal_count INTEGER DEFAULT 0,                    -- Number of POS terminals

    -- Status
    is_active BOOLEAN DEFAULT TRUE,                          -- Active/inactive
    outlet_status VARCHAR(20) DEFAULT 'OPEN' CHECK (
        outlet_status IN ('OPEN', 'CLOSED', 'RENOVATION', 'SEASONAL', 'TEMPORARY_CLOSED')
    ),                                                       -- Operational status

    -- Media
    photo_url VARCHAR(500),                                  -- Outlet photo
    menu_url VARCHAR(500),                                   -- Online menu link
    reservation_url VARCHAR(500),                            -- Online reservation link

    -- Notes
    internal_notes TEXT,                                     -- Staff-only notes
    guest_description TEXT,                                  -- Guest-facing description

    -- Display
    display_order INTEGER DEFAULT 0,                         -- Sort order in listings

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                      -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
    updated_at TIMESTAMP,                                    -- Last update timestamp
    created_by UUID,                                         -- Creator identifier
    updated_by UUID,                                         -- Modifier identifier

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,                        -- Soft delete flag
    deleted_at TIMESTAMP,                                    -- Deletion timestamp
    deleted_by UUID,                                         -- Deleter identifier

    -- Optimistic Locking
    version BIGINT DEFAULT 0,                                -- Row version for concurrency

    -- Constraints
    CONSTRAINT outlets_code_unique UNIQUE (tenant_id, property_id, outlet_code),
    CONSTRAINT outlets_capacity_check CHECK (seating_capacity IS NULL OR seating_capacity >= 0)
);

-- =====================================================
-- MEAL_PERIODS TABLE
-- Configurable meal period definitions per property
-- =====================================================

CREATE TABLE IF NOT EXISTS meal_periods (
    -- Primary Key
    meal_period_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Unique meal period identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                    -- FK tenants.id
    property_id UUID NOT NULL,                                  -- FK properties.id

    -- Meal Period Details
    period_code VARCHAR(50) NOT NULL,                           -- Short code (e.g., 'BKFST', 'LUNCH', 'DINNER')
    period_name VARCHAR(100) NOT NULL,                          -- Display name (e.g., 'Breakfast')
    period_type VARCHAR(50) NOT NULL CHECK (
        period_type IN (
            'BREAKFAST', 'BRUNCH', 'LUNCH', 'AFTERNOON_TEA',
            'DINNER', 'SUPPER', 'ALL_DAY', 'HAPPY_HOUR',
            'ROOM_SERVICE', 'MINIBAR', 'OTHER'
        )
    ),                                                          -- Meal period classification

    -- Timing
    default_start_time TIME NOT NULL,                           -- Standard start time
    default_end_time TIME NOT NULL,                             -- Standard end time
    last_seating_time TIME,                                     -- Latest seating time (may differ from end)
    last_order_time TIME,                                       -- Kitchen last order cutoff

    -- Pricing
    default_price DECIMAL(10, 2),                               -- Standard meal plan price per person
    child_price DECIMAL(10, 2),                                 -- Child meal plan price
    currency_code CHAR(3) DEFAULT 'USD',                        -- Currency
    charge_code VARCHAR(50),                                    -- Default charge code for posting

    -- Configuration
    is_included_in_rate BOOLEAN DEFAULT FALSE,                  -- Included in room rate (e.g., B&B plan)
    is_buffet BOOLEAN DEFAULT FALSE,                            -- Buffet style
    is_a_la_carte BOOLEAN DEFAULT TRUE,                         -- À la carte available
    covers_forecast INTEGER DEFAULT 0,                          -- Expected daily covers

    -- Status
    is_active BOOLEAN DEFAULT TRUE,                             -- Active/inactive
    display_order INTEGER DEFAULT 0,                            -- Sort order

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                         -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,    -- Creation timestamp
    updated_at TIMESTAMP,                                       -- Last update timestamp
    created_by UUID,                                            -- Creator identifier
    updated_by UUID,                                            -- Modifier identifier

    -- Constraints
    CONSTRAINT meal_periods_code_unique UNIQUE (tenant_id, property_id, period_code),
    CONSTRAINT meal_periods_time_check CHECK (default_end_time > default_start_time)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE outlets IS 'F&B outlets, retail shops, spa reception, and other revenue-generating service points';
COMMENT ON COLUMN outlets.outlet_id IS 'Unique outlet identifier (UUID)';
COMMENT ON COLUMN outlets.outlet_code IS 'Short code for POS/reports (e.g., REST-MAIN, BAR-POOL)';
COMMENT ON COLUMN outlets.outlet_type IS 'Classification: RESTAURANT, BAR, CAFE, ROOM_SERVICE, SPA, etc.';
COMMENT ON COLUMN outlets.revenue_center_code IS 'Maps to POS revenue center for financial reporting';
COMMENT ON COLUMN outlets.gl_account IS 'General ledger account for revenue posting';
COMMENT ON COLUMN outlets.charge_code IS 'Default charge code when posting to guest folio';
COMMENT ON COLUMN outlets.pos_system IS 'Name of connected POS system (e.g., Micros, Square)';

COMMENT ON TABLE meal_periods IS 'Configurable meal period definitions per property with timing, pricing, and inclusion rules';
COMMENT ON COLUMN meal_periods.meal_period_id IS 'Unique meal period identifier (UUID)';
COMMENT ON COLUMN meal_periods.period_code IS 'Short code (e.g., BKFST, LUNCH, DINNER)';
COMMENT ON COLUMN meal_periods.period_type IS 'Classification: BREAKFAST, LUNCH, DINNER, etc.';
COMMENT ON COLUMN meal_periods.is_included_in_rate IS 'TRUE if meal is included in room rate (B&B, MAP, AP plans)';
COMMENT ON COLUMN meal_periods.last_seating_time IS 'Latest time guests can be seated';
COMMENT ON COLUMN meal_periods.covers_forecast IS 'Expected daily covers for kitchen planning';

\echo 'outlets and meal_periods tables created successfully!'
