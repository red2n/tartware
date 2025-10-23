-- =====================================================
-- 09_reservation_status_history_fk.sql
-- Foreign Key Constraints for reservation_status_history
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for reservation_status_history...'

-- Foreign key to reservations table
ALTER TABLE reservation_status_history
ADD CONSTRAINT fk_reservation_status_history_reservation_id
FOREIGN KEY (reservation_id)
REFERENCES reservations(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to tenants table
ALTER TABLE reservation_status_history
ADD CONSTRAINT fk_reservation_status_history_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_reservation_status_history_reservation_id ON reservation_status_history IS
'Ensures reservation exists. RESTRICT prevents deleting reservations with status history (audit trail).';

COMMENT ON CONSTRAINT fk_reservation_status_history_tenant_id ON reservation_status_history IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with status history.';

\echo '✓ Reservation_status_history foreign keys created successfully!'
