-- =====================================================
-- ota_rate_plans.sql
-- OTA Rate Plans Mapping Table
-- Industry Standard: Channel Manager rate mapping
-- Pattern: Maps internal rate plans to OTA-specific rate plan codes
-- Date: 2025-10-17
-- =====================================================

-- =====================================================
-- OTA_RATE_PLANS TABLE
-- Maps internal rate plans to OTA-specific rate plan codes
-- =====================================================

CREATE TABLE IF NOT EXISTS ota_rate_plans (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-tenancy
    tenant_id UUID NOT NULL,
    property_id UUID NOT NULL,

    -- Foreign Keys
    ota_configuration_id UUID NOT NULL,
    rate_id UUID NOT NULL, -- Internal rate plan

    -- OTA Rate Plan Identification
    ota_rate_plan_id VARCHAR(100) NOT NULL, -- OTA's rate plan identifier
    ota_rate_plan_name VARCHAR(200),

    -- Mapping Configuration
    mapping_type VARCHAR(50) DEFAULT 'STANDARD', -- 'STANDARD', 'PROMOTIONAL', 'LAST_MINUTE', 'OPAQUE'
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,

    -- Booking Restrictions
    min_advance_booking_days INTEGER DEFAULT 0,
    max_advance_booking_days INTEGER,
    min_length_of_stay INTEGER DEFAULT 1,
    max_length_of_stay INTEGER,

    -- Inclusions
    include_breakfast BOOLEAN DEFAULT false,
    include_taxes BOOLEAN DEFAULT false,

    -- Policies
    cancellation_policy_code VARCHAR(50),

    -- Price Adjustments
    markup_percentage DECIMAL(5,2) DEFAULT 0,
    markdown_percentage DECIMAL(5,2) DEFAULT 0,
    fixed_adjustment_amount DECIMAL(10,2) DEFAULT 0,

    -- Additional Configuration
    configuration_json JSONB,

    -- Audit Fields
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Foreign Keys
    CONSTRAINT fk_ota_rate_plan_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_ota_rate_plan_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    CONSTRAINT fk_ota_rate_plan_ota_config FOREIGN KEY (ota_configuration_id) REFERENCES ota_configurations(id) ON DELETE CASCADE,
    CONSTRAINT fk_ota_rate_plan_rate FOREIGN KEY (rate_id) REFERENCES rates(id) ON DELETE CASCADE,
    CONSTRAINT fk_ota_rate_plan_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_ota_rate_plan_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_ota_rate_plan_markup CHECK (markup_percentage >= 0 AND markup_percentage <= 100),
    CONSTRAINT chk_ota_rate_plan_markdown CHECK (markdown_percentage >= 0 AND markdown_percentage <= 100),
    CONSTRAINT chk_ota_rate_plan_min_los CHECK (min_length_of_stay >= 1),
    CONSTRAINT uq_ota_rate_plan_mapping UNIQUE (ota_configuration_id, rate_id, ota_rate_plan_id)
);

-- Add comments
COMMENT ON TABLE ota_rate_plans IS 'Mapping between internal rates and OTA rate plans';
COMMENT ON COLUMN ota_rate_plans.mapping_type IS 'Type of rate mapping: STANDARD, PROMOTIONAL, LAST_MINUTE, OPAQUE';
COMMENT ON COLUMN ota_rate_plans.markup_percentage IS 'Percentage markup applied to base rate';
COMMENT ON COLUMN ota_rate_plans.markdown_percentage IS 'Percentage discount applied to base rate';
