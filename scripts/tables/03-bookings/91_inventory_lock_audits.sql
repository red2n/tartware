-- =====================================================
-- inventory_lock_audits.sql
-- Audit trail for manual lock releases & administrative actions
-- =====================================================

\c tartware

\echo 'Creating inventory_lock_audits table...'

CREATE TABLE IF NOT EXISTS inventory_lock_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL,
    performed_by_id VARCHAR(100) NOT NULL,
    performed_by_name VARCHAR(150) NOT NULL,
    performed_by_email VARCHAR(255),
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE inventory_lock_audits IS 'Audit trail for Availability Guard lock operations';
COMMENT ON COLUMN inventory_lock_audits.lock_id IS 'Reference to inventory_locks_shadow.id';
COMMENT ON COLUMN inventory_lock_audits.action IS 'Action name (e.g., MANUAL_RELEASE)';
COMMENT ON COLUMN inventory_lock_audits.metadata IS 'Structured payload describing context for the action';

CREATE INDEX IF NOT EXISTS idx_inventory_lock_audits_lock
    ON inventory_lock_audits(lock_id);

CREATE INDEX IF NOT EXISTS idx_inventory_lock_audits_tenant
    ON inventory_lock_audits(tenant_id);

\echo 'inventory_lock_audits table created.'
