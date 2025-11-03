-- =====================================================
-- 71_general_ledger_entries_indexes.sql
-- Indexes for General Ledger Entries
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating general_ledger_entries indexes...'

CREATE INDEX idx_gl_entries_batch
    ON general_ledger_entries(gl_batch_id)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_gl_entries_tenant_posting
    ON general_ledger_entries(tenant_id, property_id, posting_date)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_gl_entries_account
    ON general_ledger_entries(gl_account_code, posting_date)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_gl_entries_source
    ON general_ledger_entries(source_table, source_id)
    WHERE source_table IS NOT NULL AND source_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_gl_entries_status
    ON general_ledger_entries(status, posted_at)
    WHERE status IN ('READY', 'POSTED') AND is_deleted = FALSE;

CREATE INDEX idx_gl_entries_folio
    ON general_ledger_entries(folio_id)
    WHERE folio_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_gl_entries_reservation
    ON general_ledger_entries(reservation_id)
    WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_gl_entries_currency
    ON general_ledger_entries(currency, exchange_rate)
    WHERE is_deleted = FALSE;

\echo 'general_ledger_entries indexes created.'
