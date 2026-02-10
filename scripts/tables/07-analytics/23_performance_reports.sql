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

COMMENT ON COLUMN performance_reports.report_id IS 'Unique identifier for the performance report';
COMMENT ON COLUMN performance_reports.report_type IS 'Classification of report (e.g. occupancy, revenue, ADR)';
COMMENT ON COLUMN performance_reports.report_name IS 'Human-readable name of the generated report';
COMMENT ON COLUMN performance_reports.report_data IS 'Full report content stored as structured JSON';
COMMENT ON COLUMN performance_reports.severity IS 'Report severity level: INFO, WARNING, or CRITICAL';
COMMENT ON COLUMN performance_reports.status IS 'Distribution status: PENDING, SENT, or FAILED';
COMMENT ON COLUMN performance_reports.generated_at IS 'Timestamp when the report was generated';
COMMENT ON COLUMN performance_reports.sent_at IS 'Timestamp when the report was distributed to recipients';
COMMENT ON COLUMN performance_reports.recipients IS 'List of email addresses or user identifiers to receive the report';

\echo '✓ performance_reports created.'
