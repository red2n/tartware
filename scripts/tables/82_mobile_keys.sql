-- =====================================================
-- Mobile Keys Table
-- =====================================================

CREATE TABLE IF NOT EXISTS mobile_keys (
    key_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    guest_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    room_id UUID NOT NULL,

    key_code VARCHAR(255) UNIQUE NOT NULL,
    key_type VARCHAR(50) CHECK (key_type IN ('bluetooth', 'nfc', 'qr_code', 'pin')) DEFAULT 'bluetooth',

    status VARCHAR(50) CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'used')) DEFAULT 'pending',

    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,

    access_granted_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,

    device_id VARCHAR(255),
    device_type VARCHAR(100),

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

CREATE INDEX idx_mobile_keys_tenant ON mobile_keys(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_property ON mobile_keys(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_guest ON mobile_keys(guest_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_reservation ON mobile_keys(reservation_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_room ON mobile_keys(room_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_code ON mobile_keys(key_code) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_status ON mobile_keys(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_mobile_keys_valid ON mobile_keys(valid_from, valid_to) WHERE status = 'active' AND is_deleted = FALSE;

COMMENT ON TABLE mobile_keys IS 'Manages digital/mobile room keys for contactless access';
