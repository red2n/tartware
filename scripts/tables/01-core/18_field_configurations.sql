-- =====================================================
-- 18_field_configurations.sql
-- Dynamic Field Configuration Table
-- Industry Standard: Configurable fields per entity type
-- Pattern: Per-tenant field visibility, validation, and ordering
--          for Profiles, Groups, AR, and other entity forms
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- FIELD_CONFIGURATIONS TABLE
-- Controls which fields are visible, required, read-only,
-- and their validation rules for configurable entity forms.
-- Allows properties to customize data collection per entity.
-- =====================================================

CREATE TABLE IF NOT EXISTS field_configurations (
    -- Primary Key
    field_config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),    -- Unique configuration identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                        -- FK tenants.id
    property_id UUID,                                               -- FK properties.id (NULL = tenant-wide default)

    -- Entity Identification
    entity_type VARCHAR(50) NOT NULL,                               -- Target entity: GUEST_PROFILE, GROUP_BOOKING, ACCOUNTS_RECEIVABLE, RESERVATION, COMPANY
    field_name VARCHAR(100) NOT NULL,                               -- Field identifier (e.g., "middle_name", "tax_id", "loyalty_number")
    field_label VARCHAR(200),                                       -- Custom display label (overrides default)

    -- Visibility & Behavior
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,                       -- Whether field appears in forms
    is_required BOOLEAN NOT NULL DEFAULT FALSE,                     -- Whether field is mandatory
    is_read_only BOOLEAN NOT NULL DEFAULT FALSE,                    -- Whether field is non-editable after creation
    is_searchable BOOLEAN NOT NULL DEFAULT FALSE,                   -- Whether field appears in search filters

    -- Ordering
    display_order INTEGER DEFAULT 0,                                -- Sort position within the entity form
    section_name VARCHAR(100),                                      -- Logical form section (e.g., "Contact Info", "Billing")

    -- Validation
    validation_type VARCHAR(50),                                    -- Validation rule: REGEX, MIN_LENGTH, MAX_LENGTH, ENUM, DATE_RANGE, NUMERIC_RANGE
    validation_rule TEXT,                                           -- Validation expression (regex pattern, enum list JSON, etc.)
    validation_message VARCHAR(500),                                -- Custom error message on validation failure

    -- Default Value
    default_value TEXT,                                             -- Default value for the field

    -- Custom Fields (extension)
    is_custom_field BOOLEAN NOT NULL DEFAULT FALSE,                 -- Whether this is a tenant-created custom field (vs. system field)
    custom_field_data_type VARCHAR(30),                             -- Data type for custom fields: TEXT, NUMBER, DATE, BOOLEAN, SELECT, MULTI_SELECT
    custom_field_options JSONB,                                     -- Options for SELECT/MULTI_SELECT custom fields

    -- Dependency Rules
    depends_on_field VARCHAR(100),                                  -- Field this depends on (conditional visibility)
    depends_on_value TEXT,                                          -- Value of parent field that triggers visibility

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                        -- Active flag

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT uq_field_config UNIQUE (tenant_id, property_id, entity_type, field_name)
);

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE field_configurations IS 'Dynamic field configuration — controls visibility, validation, and ordering of entity form fields per tenant/property';
COMMENT ON COLUMN field_configurations.entity_type IS 'Target entity: GUEST_PROFILE, GROUP_BOOKING, ACCOUNTS_RECEIVABLE, RESERVATION, COMPANY';
COMMENT ON COLUMN field_configurations.field_name IS 'System field identifier matching the column or attribute name on the target entity';
COMMENT ON COLUMN field_configurations.is_custom_field IS 'TRUE for tenant-created fields that extend the base schema; FALSE for system-defined fields';
COMMENT ON COLUMN field_configurations.validation_type IS 'Rule type: REGEX, MIN_LENGTH, MAX_LENGTH, ENUM, DATE_RANGE, NUMERIC_RANGE';
COMMENT ON COLUMN field_configurations.depends_on_field IS 'Conditional visibility — this field only shows when the parent field matches depends_on_value';

\echo 'field_configurations table created successfully!'
