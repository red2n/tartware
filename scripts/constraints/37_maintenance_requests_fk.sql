-- =====================================================
-- 37_maintenance_requests_fk.sql
-- Foreign Key Constraints for maintenance_requests table
--
-- Relationships: tenant, property, room, reservation, guest, user
-- =====================================================

\c tartware

-- Drop constraints if they exist (for development)
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_tenant;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_property;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_room;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_reservation;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_guest;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_previous;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_created_by;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_updated_by;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_reported_by;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_assigned_to;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_assigned_by;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_verified_by;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_completed_by;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_cancelled_by;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_escalated_to;
ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_deleted_by;

-- Tenant reference (required)
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_tenant
    FOREIGN KEY (tenant_id)
    REFERENCES tenants(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_tenant ON maintenance_requests IS 'Maintenance requests belong to a tenant';

-- Property reference (required)
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_property
    FOREIGN KEY (property_id)
    REFERENCES properties(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_property ON maintenance_requests IS 'Maintenance requests belong to a property';

-- Room reference (optional - may be public area)
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_room
    FOREIGN KEY (room_id)
    REFERENCES rooms(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_room ON maintenance_requests IS 'Room requiring maintenance';

-- Reservation reference (optional)
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_reservation
    FOREIGN KEY (reservation_id)
    REFERENCES reservations(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_reservation ON maintenance_requests IS 'Current reservation if room is occupied';

-- Guest reference (optional - if guest reported)
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_guest
    FOREIGN KEY (guest_id)
    REFERENCES guests(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_guest ON maintenance_requests IS 'Guest who reported issue';

-- Previous request (self-referential for recurring issues)
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_previous
    FOREIGN KEY (previous_request_id)
    REFERENCES maintenance_requests(request_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_previous ON maintenance_requests IS 'Previous occurrence of same issue';

-- Created by user
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_created_by
    FOREIGN KEY (created_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Updated by user
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_updated_by
    FOREIGN KEY (updated_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Reported by user
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_reported_by
    FOREIGN KEY (reported_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_reported_by ON maintenance_requests IS 'Staff who reported the issue';

-- Assigned to user (maintenance staff)
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_assigned_to
    FOREIGN KEY (assigned_to)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_assigned_to ON maintenance_requests IS 'Maintenance staff assigned to work order';

-- Assigned by user (supervisor)
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_assigned_by
    FOREIGN KEY (assigned_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_assigned_by ON maintenance_requests IS 'Supervisor who assigned the work';

-- Verified by user
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_verified_by
    FOREIGN KEY (verified_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_verified_by ON maintenance_requests IS 'Staff who verified completion';

-- Completed by user
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_completed_by
    FOREIGN KEY (completed_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_completed_by ON maintenance_requests IS 'Staff who completed the work';

-- Cancelled by user
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_cancelled_by
    FOREIGN KEY (cancelled_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_cancelled_by ON maintenance_requests IS 'User who cancelled the request';

-- Escalated to user (manager)
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_escalated_to
    FOREIGN KEY (escalated_to)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_maintenance_requests_escalated_to ON maintenance_requests IS 'Manager issue was escalated to';

-- Deleted by user
ALTER TABLE maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_deleted_by
    FOREIGN KEY (deleted_by)
    REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Success message
\echo '✓ Constraints created: maintenance_requests (37/37)'
\echo '  - 16 foreign key constraints'
\echo '  - Complete maintenance workflow tracking'
\echo ''
\echo '===================================================='
\echo '✓✓ ALL 17 CONSTRAINT FILES COMPLETE (21-37) ✓✓'
\echo '===================================================='
\echo '  Tables 21-24: Existing tables (4 files)'
\echo '  Tables 25-30: Phase 1 new tables (6 files)'
\echo '  Tables 31-37: Phase 2 new tables (7 files)'
\echo ''
\echo '  Total: 150+ foreign key constraints created'
\echo '  - Complete referential integrity'
\echo '  - Cascade and restrict behaviors'
\echo '  - Comprehensive audit trails'
\echo ''
\echo 'Next: Update master scripts'
\echo '===================================================='
\echo ''
