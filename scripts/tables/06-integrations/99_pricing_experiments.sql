-- =============================================
-- Pricing Experiments (A/B Testing)
-- =============================================

CREATE TABLE IF NOT EXISTS pricing_experiments (
    -- Primary Key
    experiment_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

    -- Multi-tenancy
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

    -- Experiment Details
    experiment_name VARCHAR(255) NOT NULL,
    experiment_description TEXT,
    hypothesis TEXT,

    -- Variants
    control_strategy VARCHAR(255) NOT NULL,
    test_strategy VARCHAR(255) NOT NULL,

    control_rule_id UUID REFERENCES dynamic_pricing_rules_ml(rule_id),
    test_rule_id UUID REFERENCES dynamic_pricing_rules_ml(rule_id),

    -- Traffic Split
    traffic_split_percentage DECIMAL(5,2) DEFAULT 50.00, -- % to test variant

    -- Date Range
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Results
    control_bookings INTEGER DEFAULT 0,
    test_bookings INTEGER DEFAULT 0,

    control_revenue DECIMAL(12,2) DEFAULT 0.00,
    test_revenue DECIMAL(12,2) DEFAULT 0.00,

    control_avg_rate DECIMAL(10,2),
    test_avg_rate DECIMAL(10,2),

    control_occupancy DECIMAL(5,2),
    test_occupancy DECIMAL(5,2),

    -- Statistical Significance
    statistical_significance DECIMAL(5,2), -- p-value
    confidence_level DECIMAL(5,2),
    winner VARCHAR(50) CHECK (winner IN ('control', 'test', 'inconclusive', 'ongoing')),

    -- Status
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
        'draft',
        'running',
        'paused',
        'completed',
        'cancelled'
    )),

    -- Notes
    notes TEXT,
    conclusion TEXT,

    -- Audit
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id)
);

COMMENT ON TABLE pricing_experiments IS 'A/B testing framework for comparing pricing strategies';
