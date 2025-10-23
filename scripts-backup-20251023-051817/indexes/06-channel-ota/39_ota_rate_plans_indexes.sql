-- Indexes for ota_rate_plans table

-- Primary lookup indexes
CREATE INDEX idx_ota_rate_plan_tenant_property
    ON ota_rate_plans(tenant_id, property_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_ota_rate_plan_ota_config
    ON ota_rate_plans(ota_configuration_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_ota_rate_plan_rate
    ON ota_rate_plans(rate_id)
    WHERE deleted_at IS NULL;

-- Active rate plans
CREATE INDEX idx_ota_rate_plan_active
    ON ota_rate_plans(ota_configuration_id, is_active, priority)
    WHERE deleted_at IS NULL AND is_active = true;

-- Mapping lookup
CREATE INDEX idx_ota_rate_plan_ota_id
    ON ota_rate_plans(ota_configuration_id, ota_rate_plan_id)
    WHERE deleted_at IS NULL;

-- Rate mapping type
CREATE INDEX idx_ota_rate_plan_type
    ON ota_rate_plans(tenant_id, property_id, mapping_type)
    WHERE deleted_at IS NULL;

-- Foreign key indexes
CREATE INDEX idx_ota_rate_plan_created_by ON ota_rate_plans(created_by);
CREATE INDEX idx_ota_rate_plan_updated_by ON ota_rate_plans(updated_by);

-- Timestamp indexes
CREATE INDEX idx_ota_rate_plan_created_at ON ota_rate_plans(created_at);
CREATE INDEX idx_ota_rate_plan_updated_at ON ota_rate_plans(updated_at);

-- Composite index for rate lookup with restrictions
CREATE INDEX idx_ota_rate_plan_booking_window
    ON ota_rate_plans(ota_configuration_id, min_advance_booking_days, max_advance_booking_days)
    WHERE deleted_at IS NULL AND is_active = true;
