-- =====================================================
-- 37_maintenance_requests_indexes.sql
-- Indexes for maintenance_requests table
--
-- Performance optimization for maintenance tracking
-- =====================================================

\c tartware

-- Drop indexes if they exist (for development)
DROP INDEX IF EXISTS idx_maintenance_tenant;
DROP INDEX IF EXISTS idx_maintenance_room;
DROP INDEX IF EXISTS idx_maintenance_status;
DROP INDEX IF EXISTS idx_maintenance_assigned;
DROP INDEX IF EXISTS idx_maintenance_priority;
DROP INDEX IF EXISTS idx_maintenance_oos;
DROP INDEX IF EXISTS idx_maintenance_category;

-- Multi-tenancy index
CREATE INDEX idx_maintenance_tenant
    ON maintenance_requests(tenant_id, property_id, reported_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_maintenance_tenant IS 'Tenant/property maintenance tracking';

-- Room maintenance history
CREATE INDEX idx_maintenance_room
    ON maintenance_requests(room_id, request_status, reported_at DESC)
    WHERE deleted_at IS NULL AND room_id IS NOT NULL;

COMMENT ON INDEX idx_maintenance_room IS 'Room-specific maintenance history';

-- Status filtering
CREATE INDEX idx_maintenance_status
    ON maintenance_requests(property_id, request_status, priority, reported_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_maintenance_status IS 'Status and priority filtering';

-- Assigned work orders
CREATE INDEX idx_maintenance_assigned
    ON maintenance_requests(assigned_to, request_status, scheduled_date)
    WHERE deleted_at IS NULL AND assigned_to IS NOT NULL;

COMMENT ON INDEX idx_maintenance_assigned IS 'Staff workload tracking';

-- High priority/emergency requests
CREATE INDEX idx_maintenance_priority
    ON maintenance_requests(property_id, priority, reported_at DESC)
    WHERE deleted_at IS NULL AND priority IN ('URGENT', 'EMERGENCY');

COMMENT ON INDEX idx_maintenance_priority IS 'Urgent maintenance requests';

-- Out-of-service rooms
CREATE INDEX idx_maintenance_oos
    ON maintenance_requests(property_id, room_id, room_out_of_service, oos_from)
    WHERE deleted_at IS NULL AND room_out_of_service = TRUE;

COMMENT ON INDEX idx_maintenance_oos IS 'Rooms out of service for maintenance';

-- Issue category analysis
CREATE INDEX idx_maintenance_category
    ON maintenance_requests(property_id, issue_category, reported_at DESC)
    WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_maintenance_category IS 'Maintenance issue categorization';

-- Success message
\echo '✓ Indexes created: maintenance_requests (37/37)'
\echo '  - 7 performance indexes'
\echo '  - Maintenance operations optimized'
\echo ''
\echo '================================================'
\echo '✓✓ ALL 13 INDEX FILES COMPLETE (25-37) ✓✓'
\echo '================================================'
\echo '  Total: 80+ performance indexes created'
\echo '  - Multi-tenancy optimized'
\echo '  - Partial indexes for efficiency'
\echo '  - Date-based query optimization'
\echo ''
\echo 'Next: Create constraint files (21-37)'
\echo '================================================'
\echo ''
