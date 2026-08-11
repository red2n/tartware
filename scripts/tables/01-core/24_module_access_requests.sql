-- =====================================================
-- 24_module_access_requests.sql
-- Staff-raised requests to switch on a locked module
-- Industry Standard: RBAC self-service access request workflow
-- Pattern: Non-admin hits a gated screen -> raises a ticket -> admin approves/rejects
-- Date: 2026-08-07
-- =====================================================

\echo 'Creating module_access_requests table...'

-- =====================================================
-- MODULE_ACCESS_REQUESTS TABLE
-- A member of staff hits a screen whose module the tenant
-- has not switched on. Rather than dead-ending them on the
-- "ask an administrator" message, they raise a request here
-- and an ADMIN approves (which enables the module) or rejects.
-- =====================================================

CREATE TABLE IF NOT EXISTS module_access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),          -- Unique request identifier
    tenant_id UUID NOT NULL REFERENCES tenants(id),          -- Tenant the module would be switched on for
    property_id UUID,                                        -- Property the requester was working in (context only)
    module_id VARCHAR(100) NOT NULL,                         -- Module registry id (e.g. 'analytics-bi')

    -- Requester
    requested_by UUID NOT NULL REFERENCES users(id),         -- User who raised the request
    requested_screen VARCHAR(100),                           -- Screen key they were blocked on (e.g. 'reports')
    reason TEXT,                                             -- Why they need it, in their own words

    -- Decision
    status VARCHAR(20) NOT NULL DEFAULT 'pending',           -- pending | approved | rejected | cancelled
    reviewed_by UUID REFERENCES users(id),                   -- Admin who decided
    reviewed_at TIMESTAMPTZ,                                 -- When the decision was made
    review_notes TEXT,                                       -- Admin's note back to the requester

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),           -- Row creation timestamp
    updated_at TIMESTAMPTZ,                                  -- Last modification timestamp
    version INTEGER NOT NULL DEFAULT 1,                      -- Optimistic concurrency counter
    is_deleted BOOLEAN NOT NULL DEFAULT false,               -- Soft-delete flag
    deleted_at TIMESTAMPTZ,                                  -- Soft-delete timestamp

    CONSTRAINT module_access_requests_status_check
        CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

-- One open request per module per tenant: a second person hitting the same
-- locked screen joins the existing queue rather than filing a duplicate the
-- admin has to dismiss twice. Partial, so the history of decided requests is
-- kept in full.
CREATE UNIQUE INDEX IF NOT EXISTS uq_module_access_requests_open
    ON module_access_requests (tenant_id, module_id)
    WHERE status = 'pending' AND is_deleted = false;

-- The admin panel's query: this tenant's pending requests, newest first.
CREATE INDEX IF NOT EXISTS idx_module_access_requests_tenant_status
    ON module_access_requests (tenant_id, status, created_at DESC);

-- Lets a requester see what they have already asked for.
CREATE INDEX IF NOT EXISTS idx_module_access_requests_requested_by
    ON module_access_requests (requested_by);

COMMENT ON TABLE module_access_requests IS 'Staff requests to have a locked module switched on; reviewed by tenant ADMINs';
COMMENT ON COLUMN module_access_requests.module_id IS 'Module registry id the requester needs (e.g. analytics-bi)';
COMMENT ON COLUMN module_access_requests.requested_screen IS 'Screen key the requester was blocked on, for context in the review panel';
COMMENT ON COLUMN module_access_requests.status IS 'pending until an ADMIN approves or rejects; cancelled if the requester withdraws';
COMMENT ON COLUMN module_access_requests.review_notes IS 'Admin explanation shown back to the requester, especially on a rejection';

\echo 'module_access_requests table created successfully!'
