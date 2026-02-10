-- =====================================================
-- integration_mappings.sql
-- Integration Mappings Table
-- Industry Standard: External system integration mapping
-- Pattern: Map internal entities to external system identifiers
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- INTEGRATION_MAPPINGS TABLE
-- Maps internal IDs to external system identifiers
-- =====================================================

CREATE TABLE IF NOT EXISTS integration_mappings (
    -- Primary Key
    mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id UUID NOT NULL,
    property_id UUID,

    -- Integration Configuration
    integration_name VARCHAR(200) NOT NULL,
    integration_type VARCHAR(100) CHECK (integration_type IN ('pms', 'channel_manager', 'payment', 'accounting', 'crm', 'analytics', 'other')) NOT NULL,

    -- External System
    external_system VARCHAR(200) NOT NULL,
    target_system VARCHAR(255) NOT NULL,

    source_entity VARCHAR(255) NOT NULL,
    target_entity VARCHAR(255) NOT NULL,

    field_mappings JSONB NOT NULL,
    transformation_rules JSONB,

    is_active BOOLEAN DEFAULT TRUE,
    is_bidirectional BOOLEAN DEFAULT FALSE,

    sync_frequency VARCHAR(100) CHECK (sync_frequency IN ('realtime', 'hourly', 'daily', 'weekly', 'manual')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,

    metadata JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);


COMMENT ON TABLE integration_mappings IS 'Manages field mappings and transformations between integrated systems';
COMMENT ON COLUMN integration_mappings.mapping_id IS 'Unique identifier for the integration mapping';
COMMENT ON COLUMN integration_mappings.tenant_id IS 'Tenant owning this mapping configuration';
COMMENT ON COLUMN integration_mappings.property_id IS 'Property this mapping applies to, NULL for tenant-wide';
COMMENT ON COLUMN integration_mappings.integration_name IS 'Human-readable name of the integration';
COMMENT ON COLUMN integration_mappings.integration_type IS 'Category of integration (pms, channel_manager, payment, crm, etc.)';
COMMENT ON COLUMN integration_mappings.external_system IS 'Name or identifier of the external system being mapped';
COMMENT ON COLUMN integration_mappings.target_system IS 'Destination system for the mapped data';
COMMENT ON COLUMN integration_mappings.source_entity IS 'Entity type in the source system being mapped';
COMMENT ON COLUMN integration_mappings.target_entity IS 'Corresponding entity type in the target system';
COMMENT ON COLUMN integration_mappings.field_mappings IS 'JSON definition of field-to-field mappings between systems';
COMMENT ON COLUMN integration_mappings.transformation_rules IS 'JSON rules for data transformation during mapping';
COMMENT ON COLUMN integration_mappings.is_active IS 'Whether this mapping is currently in use';
COMMENT ON COLUMN integration_mappings.is_bidirectional IS 'Whether data flows in both directions between systems';
COMMENT ON COLUMN integration_mappings.sync_frequency IS 'How often data is synchronized (realtime, hourly, daily, weekly, manual)';
COMMENT ON COLUMN integration_mappings.last_sync_at IS 'Timestamp of the most recent synchronization';
COMMENT ON COLUMN integration_mappings.next_sync_at IS 'Scheduled timestamp for the next synchronization';

\echo 'integration_mappings table created successfully!'
