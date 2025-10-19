-- Indexes for ota_configurations table

-- Primary lookup indexes
CREATE INDEX idx_ota_config_tenant_property
    ON ota_configurations(tenant_id, property_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_ota_config_property
    ON ota_configurations(property_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_ota_config_ota_code
    ON ota_configurations(ota_code)
    WHERE deleted_at IS NULL;

-- Status and sync indexes
CREATE INDEX idx_ota_config_active
    ON ota_configurations(tenant_id, property_id, is_active)
    WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX idx_ota_config_sync_status
    ON ota_configurations(sync_status, last_sync_at)
    WHERE deleted_at IS NULL AND sync_enabled = true;

CREATE INDEX idx_ota_config_sync_enabled
    ON ota_configurations(tenant_id, property_id, sync_enabled)
    WHERE deleted_at IS NULL AND sync_enabled = true;

-- Foreign key indexes
CREATE INDEX idx_ota_config_created_by ON ota_configurations(created_by);
CREATE INDEX idx_ota_config_updated_by ON ota_configurations(updated_by);

-- Timestamp indexes
CREATE INDEX idx_ota_config_created_at ON ota_configurations(created_at);
CREATE INDEX idx_ota_config_last_sync_at ON ota_configurations(last_sync_at);

-- Partial index for failed syncs
CREATE INDEX idx_ota_config_sync_failed
    ON ota_configurations(tenant_id, property_id, last_sync_at)
    WHERE sync_status = 'FAILED' AND deleted_at IS NULL;
