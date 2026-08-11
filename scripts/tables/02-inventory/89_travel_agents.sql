-- =====================================================
-- 89_travel_agents.sql
-- Travel agents booking on behalf of an agency
-- Industry Standard: agent -> agency (company) commission attribution
-- Must precede 93_travel_agent_commissions.sql, which references agent_id.
-- Date: 2026-08-10
-- =====================================================

\echo 'Creating travel_agents table...'

CREATE TABLE IF NOT EXISTS travel_agents (
    agent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants (id),
    property_id UUID,

    -- The agency this agent books on behalf of. Commission rules and
    -- statements are keyed on the company, which is why every commission
    -- lookup starts by resolving agent -> company.
    company_id UUID REFERENCES companies (company_id),

    agent_code VARCHAR(50) NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    agent_email VARCHAR(255),
    agent_phone VARCHAR(50),

    -- Industry identifiers used for commission settlement.
    iata_number VARCHAR(20),
    consortium VARCHAR(100),

    default_commission_rate DECIMAL(5, 2),
    commission_currency VARCHAR(3),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_travel_agents_code
    ON travel_agents (tenant_id, agent_code) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_travel_agents_company
    ON travel_agents (company_id) WHERE company_id IS NOT NULL;

COMMENT ON TABLE travel_agents IS 'Travel agents booking on behalf of an agency; commission resolves agent -> company';
COMMENT ON COLUMN travel_agents.company_id IS 'Agency the agent belongs to; commission rules and statements are keyed on this';
COMMENT ON COLUMN travel_agents.iata_number IS 'IATA identifier used for commission settlement';

\echo 'travel_agents table created successfully!'
