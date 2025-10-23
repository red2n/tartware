-- =====================================================
-- 11_reservation_status_history_indexes.sql
-- Indexes for reservation_status_history table
-- Performance optimization for audit trail queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for reservation_status_history table...'

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_res_history_reservation_id ON reservation_status_history(reservation_id);
CREATE INDEX IF NOT EXISTS idx_res_history_tenant_id ON reservation_status_history(tenant_id);

-- Status tracking
CREATE INDEX IF NOT EXISTS idx_res_history_new_status ON reservation_status_history(new_status);
CREATE INDEX IF NOT EXISTS idx_res_history_previous_status ON reservation_status_history(previous_status);

-- Timeline queries
CREATE INDEX IF NOT EXISTS idx_res_history_changed_at ON reservation_status_history(changed_at DESC);

-- Composite index for reservation timeline (most common query)
CREATE INDEX IF NOT EXISTS idx_res_history_reservation_timeline ON reservation_status_history(reservation_id, changed_at DESC);

-- Changed by user tracking
CREATE INDEX IF NOT EXISTS idx_res_history_changed_by ON reservation_status_history(changed_by);

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_res_history_metadata_gin ON reservation_status_history USING GIN(metadata);

-- Status transition analysis
CREATE INDEX IF NOT EXISTS idx_res_history_transition ON reservation_status_history(previous_status, new_status, changed_at);

\echo '✓ Reservation_status_history indexes created successfully!'
