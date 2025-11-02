-- =============================================
-- Sustainability Metrics Table
-- =============================================
-- Description: ESG (Environmental, Social, Governance) compliance and sustainability tracking
-- Dependencies: properties, rooms
-- Category: Sustainability & ESG
-- =============================================

CREATE TABLE IF NOT EXISTS sustainability_metrics (
    -- Primary Key
    metric_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Measurement Period
    measurement_period VARCHAR(50) NOT NULL CHECK (measurement_period IN (
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'yearly'
    )),
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,

    -- Energy Consumption
    total_energy_kwh DECIMAL(12,2) DEFAULT 0.00,
    electricity_kwh DECIMAL(12,2) DEFAULT 0.00,
    natural_gas_kwh DECIMAL(12,2) DEFAULT 0.00,
    renewable_energy_kwh DECIMAL(12,2) DEFAULT 0.00,

    renewable_energy_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_energy_kwh > 0 THEN (renewable_energy_kwh / total_energy_kwh) * 100
            ELSE NULL
        END
    ) STORED,

    energy_per_occupied_room DECIMAL(10,2),
    energy_per_guest DECIMAL(10,2),
    energy_cost DECIMAL(12,2),

    -- Water Consumption
    total_water_liters DECIMAL(12,2) DEFAULT 0.00,
    hot_water_liters DECIMAL(12,2) DEFAULT 0.00,
    cold_water_liters DECIMAL(12,2) DEFAULT 0.00,
    recycled_water_liters DECIMAL(12,2) DEFAULT 0.00,

    water_per_occupied_room DECIMAL(10,2),
    water_per_guest DECIMAL(10,2),
    water_cost DECIMAL(12,2),

    -- Waste Management
    total_waste_kg DECIMAL(12,2) DEFAULT 0.00,
    recycled_waste_kg DECIMAL(12,2) DEFAULT 0.00,
    composted_waste_kg DECIMAL(12,2) DEFAULT 0.00,
    landfill_waste_kg DECIMAL(12,2) DEFAULT 0.00,
    hazardous_waste_kg DECIMAL(12,2) DEFAULT 0.00,

    waste_diversion_rate DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_waste_kg > 0 THEN ((recycled_waste_kg + composted_waste_kg) / total_waste_kg) * 100
            ELSE NULL
        END
    ) STORED,

    waste_per_occupied_room DECIMAL(10,2),
    waste_per_guest DECIMAL(10,2),

    -- Food Waste (specific tracking)
    food_waste_kg DECIMAL(12,2) DEFAULT 0.00,
    food_donated_kg DECIMAL(12,2) DEFAULT 0.00,
    food_composted_kg DECIMAL(12,2) DEFAULT 0.00,

    -- Carbon Footprint
    total_carbon_emissions_kg DECIMAL(12,2) DEFAULT 0.00, -- CO2 equivalent
    scope_1_emissions_kg DECIMAL(12,2) DEFAULT 0.00, -- Direct emissions
    scope_2_emissions_kg DECIMAL(12,2) DEFAULT 0.00, -- Indirect from energy
    scope_3_emissions_kg DECIMAL(12,2) DEFAULT 0.00, -- Other indirect

    carbon_offset_kg DECIMAL(12,2) DEFAULT 0.00,
    net_carbon_emissions_kg DECIMAL(12,2) GENERATED ALWAYS AS (
        total_carbon_emissions_kg - carbon_offset_kg
    ) STORED,

    carbon_per_occupied_room DECIMAL(10,2),
    carbon_per_guest DECIMAL(10,2),

    -- Green Operations
    linen_reuse_program_participation_rate DECIMAL(5,2),
    towel_reuse_program_participation_rate DECIMAL(5,2),
    paperless_checkin_rate DECIMAL(5,2),
    digital_key_usage_rate DECIMAL(5,2),

    -- Sustainable Procurement
    locally_sourced_food_percentage DECIMAL(5,2),
    organic_food_percentage DECIMAL(5,2),
    sustainable_seafood_percentage DECIMAL(5,2),
    fair_trade_products_percentage DECIMAL(5,2),

    eco_friendly_cleaning_products_percentage DECIMAL(5,2),
    biodegradable_amenities_percentage DECIMAL(5,2),

    -- Green Certifications Progress
    led_lighting_percentage DECIMAL(5,2),
    low_flow_fixtures_percentage DECIMAL(5,2),
    smart_thermostat_coverage_percentage DECIMAL(5,2),
    motion_sensor_coverage_percentage DECIMAL(5,2),

    -- Transportation
    electric_vehicle_charging_sessions INTEGER DEFAULT 0,
    bike_rental_count INTEGER DEFAULT 0,
    public_transport_vouchers_issued INTEGER DEFAULT 0,
    shuttle_trips INTEGER DEFAULT 0,
    shuttle_occupancy_rate DECIMAL(5,2),

    -- Guest Engagement
    sustainability_program_participation_rate DECIMAL(5,2),
    eco_conscious_room_requests INTEGER DEFAULT 0,
    carbon_offset_donations_received DECIMAL(10,2),

    -- Occupancy Context
    total_occupied_rooms INTEGER NOT NULL,
    total_guests INTEGER NOT NULL,
    occupancy_percentage DECIMAL(5,2),

    -- Cost Savings
    energy_cost_savings DECIMAL(10,2) DEFAULT 0.00,
    water_cost_savings DECIMAL(10,2) DEFAULT 0.00,
    waste_management_cost_savings DECIMAL(10,2) DEFAULT 0.00,
    total_sustainability_cost_savings DECIMAL(10,2) GENERATED ALWAYS AS (
        energy_cost_savings + water_cost_savings + waste_management_cost_savings
    ) STORED,

    -- Targets & Goals
    energy_reduction_target_percentage DECIMAL(5,2),
    water_reduction_target_percentage DECIMAL(5,2),
    waste_diversion_target_percentage DECIMAL(5,2),
    carbon_neutral_target_date DATE,

    -- Compliance
    regulatory_compliance_status VARCHAR(50) CHECK (regulatory_compliance_status IN (
        'compliant',
        'non_compliant',
        'pending_review',
        'not_applicable'
    )),

    -- Notes
    achievements TEXT[],
    challenges TEXT[],
    action_items TEXT[],
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- =============================================
-- Green Certifications Table
-- =============================================

CREATE TABLE IF NOT EXISTS green_certifications (
    -- Primary Key
    certification_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Certification Details
    certification_name VARCHAR(255) NOT NULL,
    certification_body VARCHAR(255) NOT NULL, -- "LEED", "Green Key", "EarthCheck", etc.
    certification_level VARCHAR(100), -- "Gold", "Platinum", "5 Star", etc.

    certification_type VARCHAR(50) CHECK (certification_type IN (
        'building',
        'operations',
        'food_service',
        'meetings',
        'spa',
        'overall'
    )),

    -- Status
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'pursuing',
        'in_progress',
        'certified',
        'recertifying',
        'lapsed',
        'denied'
    )),

    -- Dates
    application_date DATE,
    certification_date DATE,
    expiry_date DATE,
    recertification_due_date DATE,

    -- Requirements
    total_requirements INTEGER,
    completed_requirements INTEGER,
    completion_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_requirements > 0 THEN (completed_requirements::DECIMAL / total_requirements) * 100
            ELSE NULL
        END
    ) STORED,

    -- Score/Points
    points_earned INTEGER,
    points_required INTEGER,
    points_possible INTEGER,

    -- Documentation
    certificate_number VARCHAR(100),
    certificate_url TEXT,
    audit_report_url TEXT,

    -- Costs
    application_fee DECIMAL(10,2),
    annual_fee DECIMAL(10,2),
    audit_fee DECIMAL(10,2),
    total_investment DECIMAL(12,2),

    -- Benefits
    marketing_value TEXT,
    cost_savings_realized DECIMAL(12,2),

    -- Audit Schedule
    next_audit_date DATE,
    audit_frequency VARCHAR(50), -- "annual", "biennial", "triennial"
    last_audit_score DECIMAL(5,2),

    -- Requirements Tracking
    pending_requirements JSONB, -- Array of pending items
    completed_requirements_details JSONB,

    -- Notes
    notes TEXT,

    -- Audit Fields
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- =============================================
-- Carbon Offset Programs
-- =============================================

CREATE TABLE IF NOT EXISTS carbon_offset_programs (
    -- Primary Key
    program_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Program Details
    program_name VARCHAR(255) NOT NULL,
    program_type VARCHAR(50) CHECK (program_type IN (
        'reforestation',
        'renewable_energy',
        'methane_capture',
        'ocean_cleanup',
        'wildlife_conservation',
        'community_project',
        'other'
    )),

    provider_name VARCHAR(255),
    provider_url TEXT,

    -- Offset Details
    total_credits_purchased INTEGER DEFAULT 0,
    credits_remaining INTEGER DEFAULT 0,
    cost_per_credit DECIMAL(10,2),
    total_cost DECIMAL(12,2),

    carbon_offset_kg DECIMAL(12,2), -- Total CO2 offset

    -- Guest Participation
    guest_opt_in_count INTEGER DEFAULT 0,
    guest_donations_received DECIMAL(10,2) DEFAULT 0.00,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Marketing
    marketing_materials_url TEXT,
    certificate_template_url TEXT,

    -- Impact Reporting
    impact_report_url TEXT,
    verified_impact BOOLEAN DEFAULT FALSE,
    verification_body VARCHAR(255),

    -- Notes
    notes TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

-- =============================================
-- Sustainability Initiatives
-- =============================================

CREATE TABLE IF NOT EXISTS sustainability_initiatives (
    -- Primary Key
    initiative_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Initiative Details
    initiative_name VARCHAR(255) NOT NULL,
    initiative_description TEXT,

    category VARCHAR(50) CHECK (category IN (
        'energy',
        'water',
        'waste',
        'carbon',
        'biodiversity',
        'community',
        'procurement',
        'transportation',
        'education',
        'other'
    )),

    -- Timeline
    start_date DATE NOT NULL,
    target_completion_date DATE,
    actual_completion_date DATE,

    -- Status
    status VARCHAR(50) DEFAULT 'planned' CHECK (status IN (
        'planned',
        'in_progress',
        'completed',
        'on_hold',
        'cancelled'
    )),

    -- Goals
    goal_description TEXT,
    target_metric VARCHAR(100),
    baseline_value DECIMAL(12,2),
    target_value DECIMAL(12,2),
    current_value DECIMAL(12,2),

    progress_percentage DECIMAL(5,2),

    -- Budget
    estimated_budget DECIMAL(12,2),
    actual_cost DECIMAL(12,2),
    roi_expected DECIMAL(10,2),
    roi_actual DECIMAL(10,2),

    -- Impact
    environmental_impact TEXT,
    social_impact TEXT,
    financial_impact TEXT,

    -- Team
    project_lead UUID REFERENCES users(id),
    team_members UUID[],

    -- Notes
    notes TEXT,
    lessons_learned TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);


COMMENT ON TABLE sustainability_metrics IS 'Comprehensive ESG metrics tracking energy, water, waste, carbon, and sustainability KPIs';
COMMENT ON TABLE green_certifications IS 'Green building and operations certifications (LEED, Green Key, EarthCheck, etc.)';
COMMENT ON TABLE carbon_offset_programs IS 'Carbon offset programs and guest participation tracking';
COMMENT ON TABLE sustainability_initiatives IS 'Sustainability projects and initiatives with goals, budgets, and impact tracking';
COMMENT ON COLUMN sustainability_metrics.renewable_energy_percentage IS 'Percentage of total energy from renewable sources (computed)';
COMMENT ON COLUMN sustainability_metrics.waste_diversion_rate IS 'Percentage of waste diverted from landfill via recycling/composting (computed)';
COMMENT ON COLUMN sustainability_metrics.net_carbon_emissions_kg IS 'Total emissions minus carbon offsets (computed)';
