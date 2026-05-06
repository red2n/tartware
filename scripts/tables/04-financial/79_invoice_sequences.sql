-- =====================================================
-- 79_invoice_sequences.sql
-- Invoice and credit-note sequence counters
-- Industry Standard: EU VAT Directive 2006/112/EC §226, Brazil NF-e, India GST
-- Pattern: Gap-free sequential numbering, row-level locked for concurrency safety
-- Date: 2025-07-30
-- =====================================================

-- =====================================================
-- INVOICE_SEQUENCES TABLE
-- Per-property, per-year, per-document-type sequence counters
-- ensuring gap-free numbering for tax-authority compliance.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.invoice_sequences (
    tenant_id        UUID         NOT NULL,                            -- Owning tenant
    property_id      UUID         NOT NULL,                            -- Property scope
    document_type    VARCHAR(20)  NOT NULL,                            -- 'INVOICE' or 'CREDIT_NOTE'
    fiscal_year      INTEGER      NOT NULL,                            -- Calendar year (e.g. 2025)
    last_number      INTEGER      NOT NULL DEFAULT 0,                  -- Last issued number in sequence
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),              -- Last update timestamp
    PRIMARY KEY (tenant_id, property_id, document_type, fiscal_year),
    CONSTRAINT fk_invoice_seq_tenant
        FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_invoice_seq_property
        FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE,
    CONSTRAINT invoice_seq_document_type_check
        CHECK (document_type IN ('INVOICE', 'CREDIT_NOTE')),
    CONSTRAINT invoice_seq_fiscal_year_check
        CHECK (fiscal_year >= 2000 AND fiscal_year <= 2100),
    CONSTRAINT invoice_seq_last_number_check
        CHECK (last_number >= 0)
);

COMMENT ON TABLE public.invoice_sequences IS
    'Gap-free sequence counters for invoices and credit notes per property per year. Required for tax-authority compliance (EU VAT, Brazil NF-e, India GST).';

COMMENT ON COLUMN public.invoice_sequences.tenant_id     IS 'Owning tenant';
COMMENT ON COLUMN public.invoice_sequences.property_id   IS 'Property this sequence belongs to';
COMMENT ON COLUMN public.invoice_sequences.document_type IS 'INVOICE or CREDIT_NOTE — separate sequences per type';
COMMENT ON COLUMN public.invoice_sequences.fiscal_year   IS 'Calendar year; sequences reset at year boundary';
COMMENT ON COLUMN public.invoice_sequences.last_number   IS 'Last number issued; next number = last_number + 1';

-- Index for quick lookup during number generation
CREATE INDEX IF NOT EXISTS idx_invoice_sequences_lookup
    ON public.invoice_sequences (tenant_id, property_id, document_type, fiscal_year);

\echo 'invoice_sequences table created successfully!'
