-- =====================================================
-- 41_gds_connections.sql
-- Global Distribution System (GDS) Connection Profiles
--
-- Purpose: Manage Sabre/Amadeus/Galileo connection credentials,
--          status, and capabilities for enterprise distribution.
-- Industry Standard: Oracle OPERA OHIP, HTNG GDS Profiles
-- =====================================================

\c tartware

\echo 'Creating gds_connections table...'

CREATE TABLE IF NOT EXISTS gds_connections (
    -- Primary Key
    gds_connection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- GDS Details
    gds_provider VARCHAR(50) NOT NULL CHECK (gds_provider IN ('SABRE', 'AMADEUS', 'TRAVELPORT', 'PEGASUS', 'INNREQUEST', 'OTHER')),
    profile_code VARCHAR(100) NOT NULL, -- Chain code / PCC
    pseudo_city_code VARCHAR(20),
    agency_code VARCHAR(20),
    office_id VARCHAR(50),

    -- Connection & Credentials
    connection_mode VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION' CHECK (connection_mode IN ('PRODUCTION', 'CERTIFICATION', 'TEST')),
    credentials JSONB NOT NULL DEFAULT '{}'::jsonb, -- {username, password, securityToken}
    endpoint_url VARCHAR(500),
    message_version VARCHAR(50) DEFAULT 'HTNG 2.0',

    -- Capabilities
    supports_availability BOOLEAN DEFAULT TRUE,
    supports_rate_update BOOLEAN DEFAULT TRUE,
    supports_reservation_push BOOLEAN DEFAULT TRUE,
    supports_cancellation BOOLEAN DEFAULT TRUE,
    supports_modifications BOOLEAN DEFAULT TRUE,

    -- Status & Monitoring
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXPIRED')),
    last_connected_at TIMESTAMP,
    last_successful_sync TIMESTAMP,
    last_error_at TIMESTAMP,
    last_error_message TEXT,
    retry_backoff_seconds INTEGER DEFAULT 0,

    -- Audit
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_at TIMESTAMP,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT uq_gds_profile UNIQUE (tenant_id, property_id, gds_provider, profile_code, connection_mode)
);

COMMENT ON TABLE gds_connections IS 'GDS connection profiles and credentials per tenant/property.';
COMMENT ON COLUMN gds_connections.gds_provider IS 'GDS provider: SABRE, AMADEUS, TRAVELPORT, PEGASUS, etc.';
COMMENT ON COLUMN gds_connections.profile_code IS 'Chain or profile code used with the GDS.';
COMMENT ON COLUMN gds_connections.connection_mode IS 'Environment: PRODUCTION, CERTIFICATION, TEST.';
COMMENT ON COLUMN gds_connections.credentials IS 'Credential bundle (HTNG / SOAP security tokens).';
COMMENT ON COLUMN gds_connections.status IS 'Operational status of the connection.';

\echo '✓ Table created: gds_connections'
