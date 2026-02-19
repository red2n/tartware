-- =====================================================
-- 74_folio_routing_rules.sql
-- Folio Routing Rule Templates
-- Industry Standard: OPERA PMS routing instructions,
--          Protel charge mapping, Cloudbeds split billing
-- Pattern: Rule-based charge distribution across multiple
--          folios (e.g., company pays room, guest pays F&B)
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- FOLIO_ROUTING_RULES TABLE
-- Defines templates and active rules for automatically
-- routing charges to the correct folio based on charge
-- code, transaction type, or custom criteria. Supports
-- company-pays-room / guest-pays-incidentals patterns,
-- group billing splits, and travel agent commission routing.
-- =====================================================

CREATE TABLE IF NOT EXISTS folio_routing_rules (
    -- Primary Key
    rule_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),          -- Unique rule identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                      -- FK tenants.id
    property_id UUID NOT NULL,                                    -- FK properties.id

    -- Rule Identity
    rule_name VARCHAR(200) NOT NULL,                              -- Human-readable name (e.g., "Corporate — Room to Company")
    rule_code VARCHAR(50),                                        -- Short code for quick lookup (e.g., "CORP_RM")
    description TEXT,                                             -- Detailed description of routing behavior

    -- Template vs Active Rule
    is_template BOOLEAN NOT NULL DEFAULT TRUE,                    -- TRUE = reusable template; FALSE = active rule on a folio
    template_id UUID,                                             -- FK folio_routing_rules.rule_id (self-ref: template this was cloned from)

    -- Source (where charge originates)
    source_folio_id UUID,                                         -- FK folios.folio_id (NULL for templates)
    source_reservation_id UUID,                                   -- FK reservations.reservation_id (NULL for templates)

    -- Destination (where charge routes to)
    destination_folio_id UUID,                                    -- FK folios.folio_id (NULL for templates)
    destination_folio_type VARCHAR(20),                           -- GUEST, MASTER, CITY_LEDGER — used in templates

    -- Routing Criteria
    charge_code_pattern VARCHAR(100),                             -- Charge code match: exact code, wildcard ("RM%"), or comma-separated list
    transaction_type VARCHAR(50),                                 -- Filter by type: ROOM, TAX, FB, MINIBAR, PHONE, LAUNDRY, PARKING, SPA, etc.
    charge_category VARCHAR(50),                                  -- Higher-level category: ACCOMMODATION, FOOD_BEVERAGE, SERVICES, TAXES_FEES, INCIDENTALS
    min_amount DECIMAL(12,2),                                     -- Only route charges >= this amount (NULL = no minimum)
    max_amount DECIMAL(12,2),                                     -- Only route charges <= this amount (NULL = no maximum)

    -- Routing Action
    routing_type VARCHAR(20) NOT NULL DEFAULT 'FULL' CHECK (
        routing_type IN ('FULL', 'PERCENTAGE', 'FIXED_AMOUNT', 'REMAINDER')
    ),                                                            -- How to split the charge
    routing_percentage DECIMAL(5,2),                              -- Percentage to route (for PERCENTAGE type, 0-100)
    routing_fixed_amount DECIMAL(12,2),                           -- Fixed amount to route (for FIXED_AMOUNT type)

    -- Priority & Evaluation
    priority INTEGER NOT NULL DEFAULT 100,                        -- Lower = evaluated first; ties resolved by created_at
    stop_on_match BOOLEAN NOT NULL DEFAULT TRUE,                  -- Stop evaluating further rules after this match

    -- Schedule
    effective_from DATE,                                          -- Rule active from date (NULL = immediately)
    effective_until DATE,                                         -- Rule active until date (NULL = indefinitely)

    -- Auto-apply
    auto_apply_to_group BOOLEAN DEFAULT FALSE,                    -- Auto-apply this template to new group bookings
    auto_apply_to_company BOOLEAN DEFAULT FALSE,                  -- Auto-apply to reservations with this company

    -- Company / Group association (for templates)
    company_id UUID,                                              -- FK companies.company_id — associate template with a company
    group_booking_id UUID,                                        -- FK group_bookings.group_id — associate with a group

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                      -- Active flag

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
    CONSTRAINT uq_routing_rule_code UNIQUE (tenant_id, property_id, rule_code),
    CONSTRAINT chk_routing_percentage CHECK (routing_percentage IS NULL OR (routing_percentage >= 0 AND routing_percentage <= 100)),
    CONSTRAINT chk_routing_amounts CHECK (min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount),
    CONSTRAINT chk_effective_dates CHECK (effective_from IS NULL OR effective_until IS NULL OR effective_from <= effective_until)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_routing_rules_source_folio ON folio_routing_rules (source_folio_id) WHERE source_folio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_routing_rules_template ON folio_routing_rules (tenant_id, property_id, is_template) WHERE is_template = TRUE AND is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_routing_rules_charge_category ON folio_routing_rules (charge_category) WHERE charge_category IS NOT NULL;

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE folio_routing_rules IS 'Folio charge routing rules — templates and active rules for distributing charges across multiple folios (split billing)';
COMMENT ON COLUMN folio_routing_rules.is_template IS 'TRUE = reusable template (no folio_id); FALSE = active rule bound to a specific folio pair';
COMMENT ON COLUMN folio_routing_rules.charge_code_pattern IS 'Match pattern: exact code (RM101), wildcard (RM%), or CSV list (RM,TX,SVC)';
COMMENT ON COLUMN folio_routing_rules.transaction_type IS 'Charge type filter: ROOM, TAX, FB, MINIBAR, PHONE, LAUNDRY, PARKING, SPA, INTERNET, etc.';
COMMENT ON COLUMN folio_routing_rules.charge_category IS 'High-level category: ACCOMMODATION, FOOD_BEVERAGE, SERVICES, TAXES_FEES, INCIDENTALS';
COMMENT ON COLUMN folio_routing_rules.routing_type IS 'FULL = entire charge; PERCENTAGE = % split; FIXED_AMOUNT = cap; REMAINDER = leftover after other rules';
COMMENT ON COLUMN folio_routing_rules.priority IS 'Evaluation order: lower numbers first. Ties broken by created_at';
COMMENT ON COLUMN folio_routing_rules.stop_on_match IS 'When TRUE, no further rules are evaluated after this rule matches a charge';

-- =====================================================
-- SEED DATA: Common routing templates
-- =====================================================

INSERT INTO folio_routing_rules (
    tenant_id, property_id, rule_name, rule_code, description,
    is_template, transaction_type, charge_category, routing_type,
    routing_percentage, routing_fixed_amount,
    destination_folio_type, priority, is_active
)
SELECT * FROM (VALUES
    ('00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID,
     'Corporate — Room & Tax to Company', 'CORP_ROOM_TAX',
     'Routes room charges and associated taxes to the company/master folio',
     TRUE, NULL, 'ACCOMMODATION', 'FULL', NULL, NULL, 'MASTER', 10, TRUE),

    ('00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID,
     'Corporate — Incidentals to Guest', 'CORP_INC_GUEST',
     'Routes incidentals (minibar, phone, laundry) to the guest personal folio',
     TRUE, NULL, 'INCIDENTALS', 'FULL', NULL, NULL, 'GUEST', 20, TRUE),

    ('00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID,
     'Corporate — F&B to Company (capped)', 'CORP_FB_CAP',
     'Routes food & beverage up to a daily allowance to company folio',
     TRUE, NULL, 'FOOD_BEVERAGE', 'FIXED_AMOUNT', NULL, 50.00, 'MASTER', 30, TRUE),

    ('00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID,
     'Group — All Charges to Master', 'GRP_ALL_MASTER',
     'Routes all charges to the group master folio (fully hosted event)',
     TRUE, NULL, NULL, 'FULL', NULL, NULL, 'MASTER', 10, TRUE),

    ('00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID,
     'Travel Agent — Room to City Ledger', 'TA_ROOM_CL',
     'Routes room charges to travel agent city ledger for commission billing',
     TRUE, NULL, 'ACCOMMODATION', 'FULL', NULL, NULL, 'CITY_LEDGER', 10, TRUE),

    ('00000000-0000-0000-0000-000000000001'::UUID, '00000000-0000-0000-0000-000000000001'::UUID,
     'Split 50/50 — Room Between Two Guests', 'SPLIT_50_50',
     'Splits room charges equally between two guest folios',
     TRUE, NULL, 'ACCOMMODATION', 'PERCENTAGE', 50, NULL, 'GUEST', 10, TRUE)
) AS t(tenant_id, property_id, rule_name, rule_code, description,
       is_template, transaction_type, charge_category, routing_type,
       routing_percentage, routing_fixed_amount,
       destination_folio_type, priority, is_active)
ON CONFLICT ON CONSTRAINT uq_routing_rule_code DO NOTHING;

\echo 'folio_routing_rules table created successfully!'
