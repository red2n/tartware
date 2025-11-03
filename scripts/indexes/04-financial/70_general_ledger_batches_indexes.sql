-- =====================================================
-- 70_general_ledger_batches_indexes.sql
-- Indexes for General Ledger Batches
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating general_ledger_batches indexes...'

CREATE INDEX idx_gl_batches_tenant
    ON general_ledger_batches(tenant_id, property_id, batch_status)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_gl_batches_batch_date
    ON general_ledger_batches(batch_date, accounting_period)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_gl_batches_source_status
    ON general_ledger_batches(source_module, batch_status)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_gl_batches_exported
    ON general_ledger_batches(exported_at DESC)
    WHERE exported_at IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_gl_batches_variance
    ON general_ledger_batches(variance)
    WHERE variance <> 0 AND is_deleted = FALSE;

\echo 'general_ledger_batches indexes created.'
