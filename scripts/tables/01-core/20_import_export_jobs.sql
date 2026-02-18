-- =====================================================
-- 20_import_export_jobs.sql
-- Import/Export Jobs Table
-- Industry Standard: Bulk data import and export for
--          property onboarding, migration, and reporting
-- Pattern: Async job tracking with progress, error logging,
--          and downloadable results
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- IMPORT_EXPORT_JOBS TABLE
-- Tracks bulk import and export operations across all
-- entity types: properties, rooms, guests, reservations,
-- housekeeping, companies, rates, and AR data.
-- =====================================================

CREATE TABLE IF NOT EXISTS import_export_jobs (
    -- Primary Key
    job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),            -- Unique job identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                       -- FK tenants.id
    property_id UUID,                                              -- FK properties.id (NULL for tenant-wide ops)

    -- Job Type
    job_type VARCHAR(10) NOT NULL CHECK (job_type IN ('IMPORT', 'EXPORT')), -- Operation direction
    entity_type VARCHAR(50) NOT NULL,                              -- Target: PROPERTY, ROOM, GUEST, RESERVATION, HOUSEKEEPING_SERVICE, COMPANY, TRAVEL_AGENT, RATE, AR_ACCOUNT
    job_label VARCHAR(200),                                        -- User-provided description

    -- File Information
    source_file_name VARCHAR(500),                                 -- Original upload filename (imports)
    source_file_format VARCHAR(20),                                -- CSV, XLSX, JSON, XML
    source_file_size_bytes BIGINT,                                 -- File size in bytes
    source_file_url VARCHAR(1000),                                 -- Storage URL of uploaded file
    result_file_url VARCHAR(1000),                                 -- Storage URL of exported / error report file

    -- Job Status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')
    ),                                                             -- Current job status

    -- Progress Tracking
    total_records INTEGER DEFAULT 0,                               -- Total rows to process
    processed_records INTEGER DEFAULT 0,                           -- Rows processed so far
    success_count INTEGER DEFAULT 0,                               -- Rows successfully imported/exported
    error_count INTEGER DEFAULT 0,                                 -- Rows with errors
    warning_count INTEGER DEFAULT 0,                               -- Rows with warnings (processed but flagged)
    skipped_count INTEGER DEFAULT 0,                               -- Rows skipped (duplicates, unchanged)

    -- Error Details
    error_summary TEXT,                                            -- Human-readable error summary
    error_details JSONB DEFAULT '[]'::JSONB,                       -- Array of {row, field, error, value}

    -- Mapping & Options
    column_mapping JSONB,                                          -- Source-to-target column mapping
    import_options JSONB DEFAULT '{}'::JSONB,                      -- Options: {upsert: true, dry_run: false, skip_duplicates: true}
    export_options JSONB DEFAULT '{}'::JSONB,                      -- Options: {format: "csv", include_headers: true, date_range: {...}}

    -- Timing
    started_at TIMESTAMP WITH TIME ZONE,                           -- Processing start time
    completed_at TIMESTAMP WITH TIME ZONE,                         -- Processing completion time
    duration_ms INTEGER,                                           -- Total processing duration in milliseconds

    -- Initiated By
    initiated_by UUID,                                             -- FK users.id — who started the job

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE import_export_jobs IS 'Tracks async bulk import/export operations for property onboarding, migration, and data export';
COMMENT ON COLUMN import_export_jobs.entity_type IS 'Target: PROPERTY, ROOM, GUEST, RESERVATION, HOUSEKEEPING_SERVICE, COMPANY, TRAVEL_AGENT, RATE, AR_ACCOUNT';
COMMENT ON COLUMN import_export_jobs.status IS 'Lifecycle: PENDING → VALIDATING → PROCESSING → COMPLETED/FAILED/CANCELLED';
COMMENT ON COLUMN import_export_jobs.column_mapping IS 'Maps source columns to target fields: {"source_col": "target_field", ...}';
COMMENT ON COLUMN import_export_jobs.import_options IS 'Import behavior flags: {upsert, dry_run, skip_duplicates, batch_size}';
COMMENT ON COLUMN import_export_jobs.error_details IS 'Per-row errors: [{row: 5, field: "email", error: "invalid format", value: "bad@"}]';

\echo 'import_export_jobs table created successfully!'
