-- =====================================================
-- QR Codes Table
-- =====================================================

CREATE TABLE IF NOT EXISTS qr_codes (
    qr_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    qr_code VARCHAR(255) UNIQUE NOT NULL,
    qr_type VARCHAR(100) CHECK (qr_type IN ('menu', 'checkin', 'payment', 'feedback', 'info', 'wifi', 'service_request', 'other')),

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

CREATE INDEX idx_qr_codes_tenant ON qr_codes(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_qr_codes_property ON qr_codes(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_qr_codes_code ON qr_codes(qr_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_qr_codes_type ON qr_codes(qr_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_qr_codes_active ON qr_codes(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_qr_codes_room ON qr_codes(room_id) WHERE room_id IS NOT NULL AND is_deleted = FALSE;

COMMENT ON TABLE qr_codes IS 'Manages QR codes for various hotel services and touchpoints';
