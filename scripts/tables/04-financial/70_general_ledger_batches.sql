-- =====================================================
-- 70_general_ledger_batches.sql
-- General Ledger Export Batches
--
-- Purpose: Group folio/charge totals for export to external finance
--          systems (USALI-compliant).
-- =====================================================

\c tartware

\echo 'Creating general_ledger_batches table...'

CREATE TABLE IF NOT EXISTS general_ledger_batches (
    -- Primary Key
    gl_batch_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Batch Details
    batch_number VARCHAR(50) NOT NULL,
    batch_date DATE NOT NULL,
    accounting_period VARCHAR(20) NOT NULL,
    source_module VARCHAR(30) NOT NULL CHECK (source_module IN ('PMS', 'SPA', 'POS', 'EVENTS', 'OTHER')),
    currency CHAR(3) DEFAULT 'USD',

    -- Totals
    debit_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    credit_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    entry_count INTEGER NOT NULL DEFAULT 0,
    variance DECIMAL(15,2) GENERATED ALWAYS AS (debit_total - credit_total) STORED,

    -- Status
    batch_status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (batch_status IN ('OPEN', 'REVIEW', 'POSTED', 'ERROR')),
    exported_at TIMESTAMP,
    exported_by UUID,
    export_format VARCHAR(30) DEFAULT 'USALI',
    export_file_url VARCHAR(500),

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT uq_gl_batch UNIQUE (tenant_id, property_id, batch_number)
);

COMMENT ON TABLE general_ledger_batches IS 'GL export batches for posting to accounting systems.';
COMMENT ON COLUMN general_ledger_batches.batch_status IS 'Workflow status for GL batch.';
COMMENT ON COLUMN general_ledger_batches.export_format IS 'Format type: USALI, CSV, XML, API.';

\echo '✓ Table created: general_ledger_batches'
