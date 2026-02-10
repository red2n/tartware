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

\echo 'qr_codes table created successfully!'

\echo 'qr_codes table created successfully!'

\echo 'qr_codes table created successfully!'
