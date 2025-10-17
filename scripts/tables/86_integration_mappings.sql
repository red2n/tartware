-- =====================================================
-- Integration Mappings Table
-- =====================================================

CREATE TABLE IF NOT EXISTS integration_mappings (
    mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    property_id UUID,

    integration_name VARCHAR(255) NOT NULL,
    integration_type VARCHAR(100) CHECK (integration_type IN ('pms', 'ota', 'payment', 'crm', 'accounting', 'marketing', 'other')),

    source_system VARCHAR(255) NOT NULL,
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

CREATE INDEX idx_integration_mappings_tenant ON integration_mappings(tenant_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_property ON integration_mappings(property_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_integration ON integration_mappings(integration_name) WHERE is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_type ON integration_mappings(integration_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_active ON integration_mappings(is_active) WHERE is_active = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_integration_mappings_sync ON integration_mappings(sync_frequency, next_sync_at) WHERE is_deleted = FALSE;

COMMENT ON TABLE integration_mappings IS 'Manages field mappings and transformations between integrated systems';
