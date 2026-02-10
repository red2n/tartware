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

\echo 'integration_mappings table created successfully!'

\echo 'integration_mappings table created successfully!'

\echo 'integration_mappings table created successfully!'
