-- ============================================================================
-- Backup History Tracking Table
-- Records all backup operations for audit and recovery planning
-- ============================================================================

CREATE TABLE IF NOT EXISTS backup_history (
    id SERIAL PRIMARY KEY,
    backup_name VARCHAR(255) NOT NULL,
    backup_type VARCHAR(50) NOT NULL
        CHECK (backup_type IN ('daily', 'weekly', 'monthly', 'manual', 'tenant', 'schema')),
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    duration_seconds INTEGER,
    checksum VARCHAR(64),
    encrypted BOOLEAN DEFAULT false,
    uploaded_to_s3 BOOLEAN DEFAULT false,
    s3_path TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'failed', 'partial', 'deleted')),
    tenant_id UUID,  -- For tenant-specific backups
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    notes TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_backup_history_type ON backup_history(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);
CREATE INDEX IF NOT EXISTS idx_backup_history_created_at ON backup_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_tenant ON backup_history(tenant_id) WHERE tenant_id IS NOT NULL;

-- View for backup dashboard
CREATE OR REPLACE VIEW backup_status_dashboard AS
SELECT
    backup_type,
    COUNT(*) as total_backups,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
    MAX(created_at) as last_backup,
    pg_size_pretty(SUM(file_size_bytes)) as total_size,
    AVG(duration_seconds)::INTEGER as avg_duration_sec
FROM backup_history
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY backup_type
ORDER BY backup_type;

-- View for recovery point objectives (RPO) monitoring
CREATE OR REPLACE VIEW backup_rpo_status AS
SELECT
    backup_type,
    MAX(created_at) as last_successful_backup,
    EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/3600 as hours_since_backup,
    CASE
        WHEN backup_type = 'daily' AND NOW() - MAX(created_at) > INTERVAL '26 hours' THEN 'CRITICAL'
        WHEN backup_type = 'daily' AND NOW() - MAX(created_at) > INTERVAL '24 hours' THEN 'WARNING'
        WHEN backup_type = 'weekly' AND NOW() - MAX(created_at) > INTERVAL '8 days' THEN 'CRITICAL'
        WHEN backup_type = 'weekly' AND NOW() - MAX(created_at) > INTERVAL '7 days' THEN 'WARNING'
        ELSE 'OK'
    END as rpo_status
FROM backup_history
WHERE status = 'success'
GROUP BY backup_type;

-- Function to get latest valid backup for recovery
CREATE OR REPLACE FUNCTION get_latest_backup(p_type VARCHAR DEFAULT NULL)
RETURNS TABLE (
    backup_name VARCHAR,
    file_path TEXT,
    created_at TIMESTAMPTZ,
    file_size_bytes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bh.backup_name,
        bh.file_path,
        bh.created_at,
        bh.file_size_bytes
    FROM backup_history bh
    WHERE bh.status = 'success'
      AND (p_type IS NULL OR bh.backup_type = p_type)
    ORDER BY bh.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to mark backup as verified
CREATE OR REPLACE FUNCTION verify_backup(p_backup_name VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE backup_history
    SET verified_at = NOW()
    WHERE backup_name = p_backup_name AND status = 'success';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Retention cleanup helper
CREATE OR REPLACE FUNCTION cleanup_expired_backups()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE backup_history
    SET status = 'deleted', expired_at = NOW()
    WHERE status = 'success'
      AND (
          (backup_type = 'daily' AND created_at < NOW() - INTERVAL '30 days')
          OR (backup_type = 'weekly' AND created_at < NOW() - INTERVAL '12 weeks')
          OR (backup_type = 'monthly' AND created_at < NOW() - INTERVAL '12 months')
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE backup_history IS 'Tracks all database backup operations for audit and recovery planning';

\echo 'Backup history tracking table created successfully'
