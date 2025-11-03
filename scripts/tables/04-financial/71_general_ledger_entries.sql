-- =====================================================
-- 71_general_ledger_entries.sql
-- General Ledger Entry Details
--
-- Purpose: Store debits/credits tied to GL batches for downstream
--          accounting integration (USALI chart mapping).
-- =====================================================

\c tartware

\echo 'Creating general_ledger_entries table...'

CREATE TABLE IF NOT EXISTS general_ledger_entries (
    -- Primary Key
    gl_entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Associations
    gl_batch_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,
    folio_id UUID,
    reservation_id UUID,
    department_code VARCHAR(20),

    -- Accounting
    posting_date DATE NOT NULL,
    gl_account_code VARCHAR(50) NOT NULL,
    cost_center VARCHAR(50),
    usali_category VARCHAR(100),
    description VARCHAR(255),

    -- Amounts
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    currency CHAR(3) DEFAULT 'USD',
    exchange_rate DECIMAL(12,6) DEFAULT 1.0,
    base_currency CHAR(3) DEFAULT 'USD',
    base_amount DECIMAL(15,2),

    -- Source Traceability
    source_table VARCHAR(50) CHECK (source_table IN ('charge_postings', 'spa_appointments', 'banquet_event_orders', 'manual_adjustment', 'other')),
    source_id UUID,
    reference_number VARCHAR(100),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY', 'POSTED', 'VOIDED')),
    posted_at TIMESTAMP,
    posted_by UUID,

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
    CONSTRAINT chk_gl_entry_amount CHECK (
        (debit_amount IS NULL OR debit_amount >= 0) AND
        (credit_amount IS NULL OR credit_amount >= 0)
    )
);

COMMENT ON TABLE general_ledger_entries IS 'Line-level GL entries exported to accounting.';
COMMENT ON COLUMN general_ledger_entries.gl_account_code IS 'Mapped GL account number.';
COMMENT ON COLUMN general_ledger_entries.usali_category IS 'USALI category to support hospitality accounting standards.';
COMMENT ON COLUMN general_ledger_entries.status IS 'Posting workflow state.';

\echo '✓ Table created: general_ledger_entries'
