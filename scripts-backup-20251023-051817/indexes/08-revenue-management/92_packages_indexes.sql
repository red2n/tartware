-- =============================================
-- Indexes for 92_packages
-- =============================================

CREATE INDEX idx_packages_tenant ON packages(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_packages_property ON packages(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_packages_code ON packages(package_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_packages_active ON packages(is_active, is_published) WHERE is_deleted = FALSE;
CREATE INDEX idx_packages_dates ON packages(valid_from, valid_to) WHERE is_active = TRUE;
CREATE INDEX idx_packages_type ON packages(package_type) WHERE is_active = TRUE;
CREATE INDEX idx_packages_featured ON packages(featured, display_order) WHERE is_published = TRUE;
CREATE INDEX idx_package_components_package ON package_components(package_id);
CREATE INDEX idx_package_components_type ON package_components(component_type);
CREATE INDEX idx_package_components_active ON package_components(is_active, display_order);
CREATE INDEX idx_package_bookings_package ON package_bookings(package_id);
CREATE INDEX idx_package_bookings_reservation ON package_bookings(reservation_id);
CREATE INDEX idx_package_bookings_status ON package_bookings(status);
