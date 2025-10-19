-- =====================================================
-- 14_reservation_services_fk.sql
-- Foreign Key Constraints for reservation_services
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating foreign key constraints for reservation_services...'

-- Foreign key to reservations table
ALTER TABLE reservation_services
ADD CONSTRAINT fk_reservation_services_reservation_id
FOREIGN KEY (reservation_id)
REFERENCES reservations(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to services table
ALTER TABLE reservation_services
ADD CONSTRAINT fk_reservation_services_service_id
FOREIGN KEY (service_id)
REFERENCES services(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Foreign key to tenants table
ALTER TABLE reservation_services
ADD CONSTRAINT fk_reservation_services_tenant_id
FOREIGN KEY (tenant_id)
REFERENCES tenants(id)
ON DELETE RESTRICT
ON UPDATE CASCADE;

COMMENT ON CONSTRAINT fk_reservation_services_reservation_id ON reservation_services IS
'Ensures reservation exists. RESTRICT prevents deleting reservations with services (financial record).';

COMMENT ON CONSTRAINT fk_reservation_services_service_id ON reservation_services IS
'Ensures service exists. RESTRICT prevents deleting services with reservations.';

COMMENT ON CONSTRAINT fk_reservation_services_tenant_id ON reservation_services IS
'Ensures tenant exists. RESTRICT prevents deleting tenants with reservation services.';

\echo '✓ Reservation_services foreign keys created successfully!'
