-- =====================================================
-- 16_reservation_services_indexes.sql
-- Indexes for reservation_services table
-- Performance optimization for service consumption queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for reservation_services table...'

-- Foreign key indexes (critical for joins)
CREATE INDEX IF NOT EXISTS idx_res_services_reservation_id ON reservation_services(reservation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_res_services_service_id ON reservation_services(service_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_res_services_tenant_id ON reservation_services(tenant_id) WHERE deleted_at IS NULL;

-- Service date queries
CREATE INDEX IF NOT EXISTS idx_res_services_service_date ON reservation_services(service_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_res_services_service_time ON reservation_services(service_time) WHERE service_time IS NOT NULL;

-- Status tracking
CREATE INDEX IF NOT EXISTS idx_res_services_status ON reservation_services(status) WHERE deleted_at IS NULL;

-- Composite for reservation services (most common query)
CREATE INDEX IF NOT EXISTS idx_res_services_reservation_date ON reservation_services(reservation_id, service_date, deleted_at)
    WHERE deleted_at IS NULL;

-- Scheduled services
CREATE INDEX IF NOT EXISTS idx_res_services_scheduled ON reservation_services(scheduled_time) WHERE scheduled_time IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_res_services_booking_date ON reservation_services(booking_date) WHERE booking_date IS NOT NULL;

-- Completion tracking
CREATE INDEX IF NOT EXISTS idx_res_services_completed ON reservation_services(completed_time) WHERE completed_time IS NOT NULL;

-- Staff assignment
CREATE INDEX IF NOT EXISTS idx_res_services_assigned_to ON reservation_services(assigned_to) WHERE assigned_to IS NOT NULL AND deleted_at IS NULL;

-- Service code tracking
CREATE INDEX IF NOT EXISTS idx_res_services_service_code ON reservation_services(service_code) WHERE service_code IS NOT NULL;

-- Amount queries (for billing)
CREATE INDEX IF NOT EXISTS idx_res_services_total_price ON reservation_services(total_price) WHERE deleted_at IS NULL;

-- JSONB index
CREATE INDEX IF NOT EXISTS idx_res_services_metadata_gin ON reservation_services USING GIN(metadata);

-- Composite for pending services by staff
CREATE INDEX IF NOT EXISTS idx_res_services_staff_pending ON reservation_services(assigned_to, status, scheduled_time)
    WHERE status IN ('pending', 'confirmed') AND deleted_at IS NULL;

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_res_services_created_at ON reservation_services(created_at);
CREATE INDEX IF NOT EXISTS idx_res_services_updated_at ON reservation_services(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_res_services_deleted_at ON reservation_services(deleted_at) WHERE deleted_at IS NOT NULL;

\echo '✓ Reservation_services indexes created successfully!'
