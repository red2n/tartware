-- =====================================================
-- 67_accounts_receivable_indexes.sql
-- Accounts Receivable Table Indexes
-- Date: 2025-10-17
-- =====================================================

\c tartware

\echo 'Creating accounts_receivable indexes...'

CREATE INDEX idx_accounts_receivable_tenant ON accounts_receivable(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_property ON accounts_receivable(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_number ON accounts_receivable(ar_number) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_account ON accounts_receivable(account_type, account_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_guest ON accounts_receivable(guest_id) WHERE guest_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_company ON accounts_receivable(company_id) WHERE company_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_source ON accounts_receivable(source_type, source_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_reservation ON accounts_receivable(reservation_id) WHERE reservation_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_invoice ON accounts_receivable(invoice_id) WHERE invoice_id IS NOT NULL AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_status ON accounts_receivable(ar_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_overdue ON accounts_receivable(is_overdue, days_overdue) WHERE is_overdue = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_aging ON accounts_receivable(aging_bucket, outstanding_balance DESC) WHERE ar_status IN ('open', 'overdue') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_due_date ON accounts_receivable(due_date) WHERE ar_status IN ('open', 'partial') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_collection ON accounts_receivable(in_collection, collection_started_date) WHERE in_collection = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_disputed ON accounts_receivable(disputed, dispute_resolved) WHERE disputed = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_written_off ON accounts_receivable(written_off, write_off_date) WHERE written_off = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_payment_plan ON accounts_receivable(has_payment_plan, next_installment_due_date) WHERE has_payment_plan = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_legal ON accounts_receivable(legal_action_taken) WHERE legal_action_taken = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_priority ON accounts_receivable(priority, outstanding_balance DESC) WHERE ar_status IN ('open', 'overdue') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_manager ON accounts_receivable(account_manager_id, ar_status) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_gl_posted ON accounts_receivable(gl_posted) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_metadata ON accounts_receivable USING gin(metadata) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_tags ON accounts_receivable USING gin(tags) WHERE is_deleted = FALSE;
-- Composite Indexes for Common Queries
CREATE INDEX idx_accounts_receivable_property_overdue ON accounts_receivable(property_id, is_overdue, due_date) WHERE ar_status IN ('open', 'overdue') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_property_aging ON accounts_receivable(property_id, aging_bucket, outstanding_balance DESC) WHERE ar_status IN ('open', 'overdue') AND is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_property_collection ON accounts_receivable(property_id, in_collection, outstanding_balance DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_accounts_receivable_outstanding ON accounts_receivable(property_id, ar_status, outstanding_balance DESC) WHERE ar_status IN ('open', 'partial', 'overdue') AND is_deleted = FALSE;

\echo 'Accounts Receivable indexes created successfully!'
