-- ============================================================================
-- Schema Migrations Tracking Table
-- Provides versioned, auditable migration tracking for production deployments
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'schema',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by VARCHAR(100) NOT NULL DEFAULT CURRENT_USER,
    execution_time_ms INTEGER,
    checksum VARCHAR(64),
    rollback_sql TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'failed', 'rolled_back', 'pending')),
    notes TEXT
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_category ON schema_migrations(category);

-- Metadata comment
COMMENT ON TABLE schema_migrations IS 'Tracks all applied database migrations for version control and audit';
COMMENT ON COLUMN schema_migrations.version IS 'Migration version (format: YYYY-MM-DD-NNN or semantic version)';
COMMENT ON COLUMN schema_migrations.checksum IS 'SHA-256 hash of migration file for integrity verification';
COMMENT ON COLUMN schema_migrations.rollback_sql IS 'SQL to reverse this migration (for planned rollbacks)';

-- Function to check if migration was already applied
CREATE OR REPLACE FUNCTION migration_exists(p_version VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE version = p_version AND status = 'success'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record successful migration
CREATE OR REPLACE FUNCTION record_migration(
    p_version VARCHAR,
    p_name VARCHAR,
    p_category VARCHAR DEFAULT 'schema',
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_checksum VARCHAR DEFAULT NULL,
    p_rollback_sql TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
BEGIN
    INSERT INTO schema_migrations (
        version, name, category, execution_time_ms,
        checksum, rollback_sql, notes, status
    ) VALUES (
        p_version, p_name, p_category, p_execution_time_ms,
        p_checksum, p_rollback_sql, p_notes, 'success'
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark migration as rolled back
CREATE OR REPLACE FUNCTION rollback_migration(p_version VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE schema_migrations
    SET status = 'rolled_back',
        notes = COALESCE(notes || E'\n', '') || 'Rolled back at ' || NOW()
    WHERE version = p_version AND status = 'success';

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- View for migration status dashboard
CREATE OR REPLACE VIEW migration_status AS
SELECT
    version,
    name,
    category,
    applied_at,
    applied_by,
    execution_time_ms,
    status,
    CASE
        WHEN rollback_sql IS NOT NULL THEN 'Yes'
        ELSE 'No'
    END as has_rollback
FROM schema_migrations
ORDER BY applied_at DESC;

\echo 'Schema migrations tracking table created successfully'
