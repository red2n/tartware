-- =====================================================
-- reservation_services.sql
-- Reservation Services Table
-- Industry Standard: Guest service consumption
-- Pattern: Oracle OPERA Charges, Service Usage
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating reservation_services table...'

-- =====================================================
-- RESERVATION_SERVICES TABLE
-- Services consumed by guests during stay
-- Links reservations to services
-- =====================================================

CREATE TABLE IF NOT EXISTS reservation_services (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign Keys
    reservation_id UUID NOT NULL,
    service_id UUID NOT NULL,
    tenant_id UUID NOT NULL,

    -- Service Details (snapshot at time of consumption)
    service_name VARCHAR(255) NOT NULL,
    service_code VARCHAR(50),

    -- Quantity & Pricing
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',

    -- Tax
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    tax_amount DECIMAL(15,2) DEFAULT 0.00,

    -- Service Date/Time
    service_date DATE NOT NULL DEFAULT CURRENT_DATE,
    service_time TIME,

    -- Status
    status VARCHAR(50) DEFAULT 'pending',

    -- Booking Details (for scheduled services)
    booking_date TIMESTAMP,
    scheduled_time TIMESTAMP,
    completed_time TIMESTAMP,

    -- Notes
    notes TEXT,
    guest_instructions TEXT,

    -- Staff Assignment
    assigned_to VARCHAR(100),

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT reservation_services_quantity_check CHECK (quantity > 0),
    CONSTRAINT reservation_services_price_check CHECK (unit_price >= 0 AND total_price >= 0)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE reservation_services IS 'Services consumed by guests during their stay';
COMMENT ON COLUMN reservation_services.id IS 'Unique service consumption record (UUID)';
COMMENT ON COLUMN reservation_services.reservation_id IS 'Reference to reservations.id';
COMMENT ON COLUMN reservation_services.service_id IS 'Reference to services.id';
COMMENT ON COLUMN reservation_services.service_name IS 'Service name snapshot';
COMMENT ON COLUMN reservation_services.quantity IS 'Quantity consumed';
COMMENT ON COLUMN reservation_services.unit_price IS 'Price per unit (snapshot)';
COMMENT ON COLUMN reservation_services.total_price IS 'Total charge (quantity * unit_price)';
COMMENT ON COLUMN reservation_services.service_date IS 'Date service was consumed';
COMMENT ON COLUMN reservation_services.service_time IS 'Time service was consumed';
COMMENT ON COLUMN reservation_services.status IS 'Status: pending, confirmed, in_progress, completed, cancelled';
COMMENT ON COLUMN reservation_services.scheduled_time IS 'Scheduled time (for bookable services)';
COMMENT ON COLUMN reservation_services.assigned_to IS 'Staff member assigned to provide service';
COMMENT ON COLUMN reservation_services.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Reservation_services table created successfully!'
