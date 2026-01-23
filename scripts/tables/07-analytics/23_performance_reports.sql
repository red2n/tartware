-- =====================================================
-- performance_reports.sql
-- Store generated performance reports
-- =====================================================

\c tartware

\echo 'Creating performance_reports table...'

CREATE TABLE IF NOT EXISTS performance_reports (
    -- Primary Key
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Report Classification
    report_type VARCHAR(50) NOT NULL,
    report_name VARCHAR(200) NOT NULL,

    -- Report Content
    report_data JSONB NOT NULL,

    -- Severity & Status
    severity VARCHAR(20) DEFAULT 'INFO',
    status VARCHAR(20) DEFAULT 'PENDING',

    -- Timestamps
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,

    -- Distribution
    recipients TEXT[],

    -- Constraints
    CONSTRAINT chk_severity CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    CONSTRAINT chk_status CHECK (status IN ('PENDING', 'SENT', 'FAILED'))
);

COMMENT ON TABLE performance_reports IS
'Stores generated performance reports with JSON data';

\echo '✓ performance_reports created.'
