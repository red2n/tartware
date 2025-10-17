-- =====================================================
-- A/B Test Results Table
-- =====================================================

CREATE TABLE IF NOT EXISTS ab_test_results (
    test_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(100) CHECK (test_type IN ('pricing', 'marketing', 'ui_ux', 'email', 'features')),

    test_status VARCHAR(50) CHECK (test_status IN ('draft', 'running', 'completed', 'cancelled')) DEFAULT 'draft',

    variant_a_config JSONB NOT NULL,
    variant_b_config JSONB NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE,

    variant_a_sample_size INTEGER DEFAULT 0,
    variant_b_sample_size INTEGER DEFAULT 0,

    variant_a_conversions INTEGER DEFAULT 0,
    variant_b_conversions INTEGER DEFAULT 0,

    variant_a_conversion_rate DECIMAL(5,2),
    variant_b_conversion_rate DECIMAL(5,2),

    winning_variant VARCHAR(10),
    confidence_level DECIMAL(5,2),
    statistical_significance BOOLEAN DEFAULT FALSE,

    results JSONB,
    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

CREATE INDEX idx_ab_test_results_tenant ON ab_test_results(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ab_test_results_property ON ab_test_results(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ab_test_results_type ON ab_test_results(test_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_ab_test_results_status ON ab_test_results(test_status) WHERE is_deleted = FALSE;

COMMENT ON TABLE ab_test_results IS 'Tracks A/B testing experiments and results';
