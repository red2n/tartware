-- =====================================================
-- 41_gds_connections_indexes.sql
-- Indexes for GDS Connections
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating gds_connections indexes...'

CREATE INDEX idx_gds_connections_tenant
    ON gds_connections(tenant_id, gds_provider, connection_mode)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_gds_connections_property_status
    ON gds_connections(property_id, status)
    WHERE property_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_gds_connections_profile
    ON gds_connections(profile_code)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_gds_connections_status
    ON gds_connections(status, last_connected_at)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_gds_connections_retry
    ON gds_connections(retry_backoff_seconds)
    WHERE retry_backoff_seconds > 0 AND is_deleted = FALSE;

CREATE INDEX idx_gds_connections_credentials
    ON gds_connections USING gin(credentials)
    WHERE credentials IS NOT NULL AND credentials <> '{}'::jsonb AND is_deleted = FALSE;

\echo 'gds_connections indexes created.'
