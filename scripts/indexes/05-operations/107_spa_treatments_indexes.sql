-- =====================================================
-- 107_spa_treatments_indexes.sql
-- Indexes for Spa Treatments Catalog
-- Date: 2025-11-03
-- =====================================================

\c tartware

\echo 'Creating spa_treatments indexes...'

CREATE INDEX idx_spa_treatments_tenant
    ON spa_treatments(tenant_id, property_id, is_active)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_spa_treatments_category
    ON spa_treatments(category, is_active)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_spa_treatments_duration
    ON spa_treatments(duration_minutes)
    WHERE is_deleted = FALSE;

CREATE INDEX idx_spa_treatments_default_room
    ON spa_treatments(default_room_id)
    WHERE default_room_id IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_spa_treatments_availability
    ON spa_treatments(start_date, end_date)
    WHERE (start_date IS NOT NULL OR end_date IS NOT NULL) AND is_deleted = FALSE;

CREATE INDEX idx_spa_treatments_required_resources
    ON spa_treatments USING gin(required_resources)
    WHERE required_resources IS NOT NULL AND required_resources <> '[]'::jsonb AND is_deleted = FALSE;

CREATE INDEX idx_spa_treatments_available_days
    ON spa_treatments USING gin(available_days)
    WHERE available_days IS NOT NULL AND is_deleted = FALSE;

CREATE INDEX idx_spa_treatments_metadata
    ON spa_treatments USING gin(metadata)
    WHERE metadata IS NOT NULL AND metadata <> '{}'::jsonb AND is_deleted = FALSE;

\echo 'spa_treatments indexes created.'
