-- =====================================================
-- QR Codes Table
-- =====================================================

-- =====================================================
-- qr_codes.sql
-- QR Codes Table
-- Industry Standard: Contactless service delivery via QR codes
-- Pattern: Generate and track QR codes for various hotel services
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- QR_CODES TABLE
-- QR codes for contactless service access
-- =====================================================

CREATE TABLE IF NOT EXISTS qr_codes (
    -- Primary Key
    qr_code_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- QR Code Data
    code_value VARCHAR(500) UNIQUE NOT NULL,
    code_type VARCHAR(100) CHECK (code_type IN ('checkin', 'menu', 'wifi', 'feedback', 'payment', 'room_service', 'concierge')) NOT NULL,

    target_url TEXT,
    qr_data JSONB,

    is_active BOOLEAN DEFAULT TRUE,

    scan_count INTEGER DEFAULT 0,
    last_scanned_at TIMESTAMP WITH TIME ZONE,

    valid_from DATE,
    valid_to DATE,

    location VARCHAR(255),
    room_id UUID,

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);


COMMENT ON TABLE qr_codes IS 'Manages QR codes for various hotel services and touchpoints';
COMMENT ON COLUMN qr_codes.qr_code_id IS 'Unique identifier for the QR code';
COMMENT ON COLUMN qr_codes.tenant_id IS 'Tenant owning this QR code';
COMMENT ON COLUMN qr_codes.property_id IS 'Property where the QR code is deployed';
COMMENT ON COLUMN qr_codes.code_value IS 'Encoded value embedded in the QR code image';
COMMENT ON COLUMN qr_codes.code_type IS 'Service category the QR code serves (checkin, menu, wifi, feedback, payment, room_service, concierge)';
COMMENT ON COLUMN qr_codes.target_url IS 'URL the QR code resolves to when scanned';
COMMENT ON COLUMN qr_codes.qr_data IS 'Additional structured data embedded in or associated with the QR code';
COMMENT ON COLUMN qr_codes.is_active IS 'Whether the QR code is currently active and scannable';
COMMENT ON COLUMN qr_codes.scan_count IS 'Total number of times the QR code has been scanned';
COMMENT ON COLUMN qr_codes.last_scanned_at IS 'Timestamp of the most recent scan';
COMMENT ON COLUMN qr_codes.valid_from IS 'Date from which the QR code becomes valid';
COMMENT ON COLUMN qr_codes.valid_to IS 'Date after which the QR code expires';
COMMENT ON COLUMN qr_codes.location IS 'Physical location where the QR code is placed (e.g. lobby, restaurant)';
COMMENT ON COLUMN qr_codes.room_id IS 'Room associated with this QR code, if room-specific';

\echo 'qr_codes table created successfully!'
