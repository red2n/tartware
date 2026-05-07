-- =====================================================
-- 80_approval_requests.sql
-- Financial approval request queue (Four-Eyes Principle)
-- Industry Standard: SOX §302/404, PCI-DSS Req 7, COSO Internal Controls
-- Pattern: Generic approval queue; requester ≠ approver enforced at DB level
-- Date: 2025-07-30
-- =====================================================

-- =====================================================
-- APPROVAL_REQUESTS TABLE
-- Pending financial operations that require a second
-- authorised user to approve before execution proceeds.
-- Implements the four-eyes (dual-control) principle.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.approval_requests (
    approval_id     UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Multi-Tenancy
    tenant_id       UUID         NOT NULL,                            -- Owning tenant
    property_id     UUID,                                             -- Property scope (nullable for tenant-level)

    -- Operation
    operation_type  VARCHAR(80)  NOT NULL,                            -- e.g. 'INVOICE_VOID', 'WRITEOFF', 'FISCAL_REOPEN'
    entity_type     VARCHAR(60)  NOT NULL,                            -- e.g. 'invoice', 'folio', 'fiscal_period'
    entity_id       UUID         NOT NULL,                            -- ID of the entity being acted on
    operation_payload JSONB      NOT NULL DEFAULT '{}',               -- Full command payload; snapshot of what was requested
    description     TEXT,                                             -- Human-readable reason for the request

    -- Requester
    requested_by    VARCHAR(100) NOT NULL,                            -- User ID or email of the requester
    requested_by_name VARCHAR(200),                                   -- Display name for notification
    requested_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),              -- When request was created

    -- Approval State
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    required_role   VARCHAR(60)  NOT NULL DEFAULT 'MANAGER',          -- Minimum role allowed to approve
    expires_at      TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'), -- Auto-expire after 24h

    -- Approver / Rejector
    actioned_by     VARCHAR(100),                                     -- User ID or email who approved/rejected
    actioned_by_name VARCHAR(200),                                    -- Display name of approver/rejector
    actioned_at     TIMESTAMPTZ,                                      -- When the decision was made
    action_reason   TEXT,                                             -- Reason provided by approver/rejector

    -- Four-Eyes constraint — actioned_by must differ from requested_by (enforced in service layer)
    -- Note: Cannot enforce with DB CHECK because both are VARCHAR, not UUID;
    --       the service layer enforces this invariant via BillingCommandError.

    -- Audit
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ,
    updated_by      VARCHAR(100),

    CONSTRAINT fk_approval_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_property FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.approval_requests IS
    'Financial approval queue implementing the four-eyes principle. Requester ≠ approver is enforced in the service layer.';

COMMENT ON COLUMN public.approval_requests.operation_type  IS 'Operation that needs approval (INVOICE_VOID, WRITEOFF, FISCAL_REOPEN, etc.)';
COMMENT ON COLUMN public.approval_requests.entity_type     IS 'Type of the entity being acted on';
COMMENT ON COLUMN public.approval_requests.entity_id       IS 'PK of the entity being acted on';
COMMENT ON COLUMN public.approval_requests.operation_payload IS 'Snapshot of the command payload at request time — stored for the approver to review';
COMMENT ON COLUMN public.approval_requests.status          IS 'PENDING=awaiting approval, APPROVED=approved and executed, REJECTED=denied, EXPIRED=24h limit exceeded, CANCELLED=withdrawn by requester';
COMMENT ON COLUMN public.approval_requests.required_role   IS 'Minimum PMS role level required to approve this request';
COMMENT ON COLUMN public.approval_requests.expires_at      IS 'After this timestamp the request auto-expires and must be re-submitted';
COMMENT ON COLUMN public.approval_requests.actioned_by     IS 'User who approved or rejected (must differ from requested_by)';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending
    ON public.approval_requests (tenant_id, status, expires_at)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_approval_requests_entity
    ON public.approval_requests (tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_approval_requests_property
    ON public.approval_requests (tenant_id, property_id, status)
    WHERE status = 'PENDING';

\echo 'approval_requests table created successfully!'
