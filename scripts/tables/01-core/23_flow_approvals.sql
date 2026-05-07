-- =====================================================
-- 23_flow_approvals.sql
-- Universal Flow Approval Record Table
-- Industry Standard: SOX §302/404, COSO Internal Controls
-- Pattern: Every gate bypass across all 12 PMS flows persists an immutable approval record
-- Date: 2026-05-07
-- =====================================================

-- =====================================================
-- FLOW_APPROVALS TABLE
-- Captures every gate bypass / override decision made
-- across all PMS flows. Immutable audit trail — no
-- UPDATE or DELETE permitted (append-only).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.flow_approvals (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Unique approval record ID

    -- Multi-Tenancy
    tenant_id       UUID         NOT NULL,                               -- Owning tenant
    property_id     UUID,                                                -- Property scope (nullable for tenant-level)

    -- Flow & Gate Identification
    flow_name       VARCHAR(80)  NOT NULL,                               -- e.g. 'reservation.lifecycle', 'housekeeping', 'night_audit'
    gate_name       VARCHAR(100) NOT NULL,                               -- e.g. 'deposit_waiver', 'blacklist_override', 'skip_inspection'

    -- Entity Reference
    entity_type     VARCHAR(60)  NOT NULL,                               -- e.g. 'reservation', 'folio', 'room', 'ar_account'
    entity_id       UUID         NOT NULL,                               -- ID of the entity being bypassed

    -- Approver Details (immutable snapshot at time of approval)
    approved_by     UUID         NOT NULL,                               -- Actor UUID (FK to users)
    role_at_approval VARCHAR(60) NOT NULL,                               -- Role snapshot at approval time (e.g. 'GM', 'FRONT_DESK_MANAGER')

    -- Reason
    reason_code     VARCHAR(60)  NOT NULL,                               -- Structured reason code
    reason_notes    TEXT,                                                 -- Free-text explanation

    -- Timing
    approved_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),                  -- When the bypass was approved
    expires_at      TIMESTAMPTZ,                                          -- For time-limited approvals (e.g. dunning suppression)

    -- Audit
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),                  -- Record creation timestamp
    correlation_id  UUID                                                   -- Links to the command that triggered this bypass
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_flow_approvals_tenant
    ON public.flow_approvals (tenant_id);

CREATE INDEX IF NOT EXISTS idx_flow_approvals_entity
    ON public.flow_approvals (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_flow_approvals_flow_gate
    ON public.flow_approvals (flow_name, gate_name);

CREATE INDEX IF NOT EXISTS idx_flow_approvals_approved_by
    ON public.flow_approvals (approved_by);

CREATE INDEX IF NOT EXISTS idx_flow_approvals_approved_at
    ON public.flow_approvals (approved_at DESC);

-- Catalog comments
COMMENT ON TABLE public.flow_approvals IS 'Immutable audit log of all gate bypass decisions across all 12 PMS flows. Append-only — no UPDATE or DELETE.';
COMMENT ON COLUMN public.flow_approvals.flow_name IS 'The PMS flow containing the bypassed gate (e.g. reservation.lifecycle, housekeeping, night_audit)';
COMMENT ON COLUMN public.flow_approvals.gate_name IS 'The specific gate that was bypassed (e.g. deposit_waiver, blacklist_override, skip_inspection)';
COMMENT ON COLUMN public.flow_approvals.role_at_approval IS 'Snapshot of the approver role at the moment of approval — immutable even if role later changes';
COMMENT ON COLUMN public.flow_approvals.reason_code IS 'Structured code for categorising bypass reasons (e.g. VIP_GUEST, EMERGENCY, REVENUE_PRESSURE)';
COMMENT ON COLUMN public.flow_approvals.expires_at IS 'For time-limited approvals (e.g. dunning suppression); NULL means permanent';

\echo 'flow_approvals table created successfully!'
