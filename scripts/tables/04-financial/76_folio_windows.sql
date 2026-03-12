-- =====================================================
-- Table: folio_windows
-- Description: Date-based billing windows within a single folio
-- Category: 04-financial
-- Dependencies: folios, reservations, properties
-- =====================================================
-- DEV DOC
-- Purpose: Enables split billing within a single stay using date ranges.
-- Example: "Company pays Mon-Fri, guest pays Sat-Sun" — each window
-- defines a date range with a billing entity (billed_to + billed_to_type).
-- Charge postings are routed to the appropriate window based on the
-- posting date. Windows must not overlap within the same folio.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.folio_windows (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Tenant Isolation
    tenant_id UUID NOT NULL,

    -- Foreign Keys
    property_id UUID NOT NULL,
    reservation_id UUID NOT NULL,
    folio_id UUID NOT NULL,

    -- Window date range (inclusive start, exclusive end)
    window_start DATE NOT NULL,
    window_end DATE NOT NULL,

    -- Billing entity
    billed_to VARCHAR(255) NOT NULL,                    -- Entity name (company, guest, agent)
    billed_to_type VARCHAR(20) NOT NULL CHECK (billed_to_type IN ('GUEST', 'CORPORATE', 'TRAVEL_AGENT', 'OTHER')),

    -- Totals for this window (denormalized for reporting)
    window_charges NUMERIC(12,2) DEFAULT 0,
    window_payments NUMERIC(12,2) DEFAULT 0,
    window_balance NUMERIC(12,2) DEFAULT 0,

    -- Notes
    notes TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    -- Constraints
    CONSTRAINT chk_folio_window_dates CHECK (window_end > window_start)
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_folio_windows_tenant
    ON public.folio_windows (tenant_id);

CREATE INDEX IF NOT EXISTS idx_folio_windows_folio
    ON public.folio_windows (tenant_id, folio_id);

CREATE INDEX IF NOT EXISTS idx_folio_windows_reservation
    ON public.folio_windows (tenant_id, reservation_id);

CREATE INDEX IF NOT EXISTS idx_folio_windows_dates
    ON public.folio_windows (tenant_id, folio_id, window_start, window_end);

-- ─── Comments ───────────────────────────────────────────────────────────────

COMMENT ON TABLE public.folio_windows IS 'Date-based billing windows for split billing within a single stay';
COMMENT ON COLUMN public.folio_windows.window_start IS 'Inclusive start date of the billing window';
COMMENT ON COLUMN public.folio_windows.window_end IS 'Exclusive end date of the billing window';
COMMENT ON COLUMN public.folio_windows.billed_to IS 'Name of the entity responsible for charges in this window';
COMMENT ON COLUMN public.folio_windows.billed_to_type IS 'Classification of the billing entity (GUEST, CORPORATE, TRAVEL_AGENT, OTHER)';
