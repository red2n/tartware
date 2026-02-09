-- Migration: Add quote/expire lifecycle columns to reservations
-- Date: 2026-02-10
-- Purpose: Support INQUIRY → QUOTED → PENDING lifecycle (S8)

\c tartware

-- Add quote tracking columns (idempotent)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS quote_expires_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;

COMMENT ON COLUMN reservations.quoted_at IS 'When the quote was sent to the guest';
COMMENT ON COLUMN reservations.quote_expires_at IS 'When the quote validity expires (auto-expire target)';
COMMENT ON COLUMN reservations.expired_at IS 'When the reservation was transitioned to EXPIRED';

\echo '✓ reservations: quoted_at, quote_expires_at, expired_at columns added'
