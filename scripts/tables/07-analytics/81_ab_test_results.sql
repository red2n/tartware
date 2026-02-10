
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

COMMENT ON COLUMN ab_test_results.result_id IS 'Unique identifier for the A/B test result';
COMMENT ON COLUMN ab_test_results.tenant_id IS 'Tenant owning this experiment';
COMMENT ON COLUMN ab_test_results.property_id IS 'Property where the experiment was conducted';
COMMENT ON COLUMN ab_test_results.test_name IS 'Descriptive name of the A/B test experiment';
COMMENT ON COLUMN ab_test_results.test_category IS 'Category of experiment (e.g. pricing, marketing, UX)';
COMMENT ON COLUMN ab_test_results.test_status IS 'Lifecycle status: draft, running, completed, or cancelled';
COMMENT ON COLUMN ab_test_results.variant_a_config IS 'Configuration for the control variant (A) as JSON';
COMMENT ON COLUMN ab_test_results.variant_b_config IS 'Configuration for the treatment variant (B) as JSON';
COMMENT ON COLUMN ab_test_results.start_date IS 'Date the experiment began accepting traffic';
COMMENT ON COLUMN ab_test_results.end_date IS 'Date the experiment stopped accepting traffic';
COMMENT ON COLUMN ab_test_results.variant_a_sample_size IS 'Number of observations assigned to variant A';
COMMENT ON COLUMN ab_test_results.variant_b_sample_size IS 'Number of observations assigned to variant B';
COMMENT ON COLUMN ab_test_results.variant_a_conversions IS 'Conversion count for variant A';
COMMENT ON COLUMN ab_test_results.variant_b_conversions IS 'Conversion count for variant B';
COMMENT ON COLUMN ab_test_results.variant_a_conversion_rate IS 'Conversion rate percentage for variant A';
COMMENT ON COLUMN ab_test_results.variant_b_conversion_rate IS 'Conversion rate percentage for variant B';
COMMENT ON COLUMN ab_test_results.winning_variant IS 'Which variant won the test (A or B)';
COMMENT ON COLUMN ab_test_results.confidence_level IS 'Statistical confidence level of the result (e.g. 95.00)';
COMMENT ON COLUMN ab_test_results.statistical_significance IS 'Whether the result reached statistical significance';
COMMENT ON COLUMN ab_test_results.results IS 'Detailed experiment results and metrics as JSON';

\echo 'ab_test_results table created successfully!'
