-- =====================================================
-- mobile_keys.sql
-- Mobile Keys Table
-- Industry Standard: Contactless digital room access
-- Pattern: Mobile key generation and tracking for contactless check-in
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- MOBILE_KEYS TABLE
-- Digital room keys for mobile app access
-- =====================================================

CREATE TABLE IF NOT EXISTS mobile_keys (
    -- Primary Key
    key_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Foreign Keys
    guest_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    room_id UUID NOT NULL,

    -- Key Configuration
    key_code VARCHAR(255) UNIQUE NOT NULL,
    key_type VARCHAR(50) CHECK (key_type IN ('bluetooth', 'nfc', 'qr_code', 'pin')) DEFAULT 'bluetooth',

    -- Key Status
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


COMMENT ON TABLE mobile_keys IS 'Manages digital/mobile room keys for contactless access';
COMMENT ON COLUMN mobile_keys.key_id IS 'Unique identifier for the mobile key';
COMMENT ON COLUMN mobile_keys.tenant_id IS 'Tenant owning this mobile key';
COMMENT ON COLUMN mobile_keys.property_id IS 'Property where the mobile key grants access';
COMMENT ON COLUMN mobile_keys.guest_id IS 'Guest to whom the mobile key is issued';
COMMENT ON COLUMN mobile_keys.reservation_id IS 'Reservation associated with this mobile key';
COMMENT ON COLUMN mobile_keys.room_id IS 'Room that this mobile key unlocks';
COMMENT ON COLUMN mobile_keys.key_code IS 'Unique encoded key value transmitted to the lock';
COMMENT ON COLUMN mobile_keys.key_type IS 'Technology used for key transmission (bluetooth, nfc, qr_code, pin)';
COMMENT ON COLUMN mobile_keys.status IS 'Current lifecycle status of the key (pending, active, expired, revoked, used)';
COMMENT ON COLUMN mobile_keys.valid_from IS 'Start of the time window during which the key is valid';
COMMENT ON COLUMN mobile_keys.valid_to IS 'End of the time window during which the key is valid';
COMMENT ON COLUMN mobile_keys.access_granted_at IS 'Timestamp when access was first granted using this key';
COMMENT ON COLUMN mobile_keys.last_used_at IS 'Timestamp of the most recent use of the key';
COMMENT ON COLUMN mobile_keys.usage_count IS 'Total number of times the key has been used';
COMMENT ON COLUMN mobile_keys.device_id IS 'Identifier of the mobile device bound to this key';
COMMENT ON COLUMN mobile_keys.device_type IS 'Type or model of the mobile device (e.g. iPhone, Android)';

\echo 'mobile_keys table created successfully!'
