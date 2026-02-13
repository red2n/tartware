-- =====================================================
-- 01_data_retention_policies.sql
-- Configurable data retention policies per entity type
-- Industry Standard: GDPR Art. 5(1)(e), PCI DSS 3.1
-- Pattern: Configuration table, no tenant_id (global)
-- Date: 2025-06-14
-- =====================================================

-- =====================================================
-- DATA_RETENTION_POLICIES TABLE
-- Defines how long data is kept before purge/anonymize
-- =====================================================

CREATE TABLE IF NOT EXISTS data_retention_policies (
    policy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),          -- Unique policy identifier
    tenant_id UUID NOT NULL,                                        -- Owning tenant
    property_id UUID,                                               -- NULL = tenant-wide default
    entity_type VARCHAR(100) NOT NULL,                              -- Target entity (guests, reservations, folios, audit_logs, etc.)
    retention_days INTEGER NOT NULL CHECK (retention_days > 0),     -- Days to retain before action
    action VARCHAR(50) NOT NULL DEFAULT 'anonymize' CHECK (action IN (
        'anonymize', 'delete', 'archive'
    )),                                                             -- What to do when retention expires
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                        -- Enable/disable without deleting
    legal_basis VARCHAR(200),                                       -- GDPR legal basis or regulation reference
    description TEXT,                                               -- Human-readable policy description
    exempt_statuses TEXT[],                                         -- Statuses exempt from purge (e.g., open folios)
    last_sweep_at TIMESTAMP WITH TIME ZONE,                         -- Last time sweep ran for this policy
    last_sweep_count INTEGER DEFAULT 0,                             -- Records processed in last sweep
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                    -- Extension metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- Row creation
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,  -- Row last update
    created_by UUID,                                                -- Creator
    updated_by UUID                                                 -- Last updater
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_retention_policies_entity
    ON data_retention_policies (tenant_id, property_id, entity_type)
    WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_data_retention_policies_entity_global
    ON data_retention_policies (tenant_id, entity_type)
    WHERE property_id IS NULL;

COMMENT ON TABLE data_retention_policies IS 'Configurable data retention policies per entity type. Drives automated purge/anonymization sweep jobs.';
COMMENT ON COLUMN data_retention_policies.entity_type IS 'Target entity table: guests, reservations, folios, audit_logs, charge_postings, etc.';
COMMENT ON COLUMN data_retention_policies.retention_days IS 'Number of days to retain records before applying the retention action';
COMMENT ON COLUMN data_retention_policies.action IS 'Action when retention expires: anonymize (redact PII), delete (hard remove), archive (move to cold storage)';
COMMENT ON COLUMN data_retention_policies.legal_basis IS 'GDPR legal basis or regulatory reference (e.g., GDPR Art. 6(1)(f), PCI DSS 3.1)';
COMMENT ON COLUMN data_retention_policies.exempt_statuses IS 'Record statuses exempt from purge (e.g., CHECKED_IN reservations, open folios)';
COMMENT ON COLUMN data_retention_policies.last_sweep_at IS 'Timestamp of last automated sweep for this policy';

\echo 'data_retention_policies table created successfully!'
