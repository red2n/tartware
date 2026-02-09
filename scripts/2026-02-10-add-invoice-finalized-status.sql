-- Migration: Add FINALIZED value to invoice_status enum
-- Date: 2026-02-10
-- Purpose: Support invoice finalization workflow (P2-12)

\c tartware

-- Add FINALIZED status to invoice_status enum (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'FINALIZED'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status')
    ) THEN
        ALTER TYPE invoice_status ADD VALUE 'FINALIZED' AFTER 'REFUNDED';
    END IF;
END
$$;

\echo '✓ invoice_status enum: FINALIZED value added'
