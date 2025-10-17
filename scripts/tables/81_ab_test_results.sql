-- =====================================================
-- ab_test_results.sql
-- A/B Test Results Table
-- Industry Standard: Experimentation and optimization tracking
-- Pattern: Store A/B test results for pricing, marketing, and UX experiments
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- AB_TEST_RESULTS TABLE
-- A/B testing results for optimization experiments
-- =====================================================

CREATE TABLE IF NOT EXISTS ab_test_results (
    -- Primary Key
    result_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Test Identification
    test_name VARCHAR(200) NOT NULL,
    test_category VARCHAR(100),

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


COMMENT ON TABLE ab_test_results IS 'Tracks A/B testing experiments and results';
