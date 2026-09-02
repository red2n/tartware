-- ============================================================================
-- Migration: add-night-audit-reason-category
-- Version: 006
-- Created: 2026-08-30T00:00:00+00:00
-- ============================================================================
--
-- Why: `billing.night_audit.execute` accepts `skip_preconditions`, which
-- bypasses the three gates the NIGHT_AUDIT flow declares — open arrivals, open
-- departures, unbalanced folios. The bypass was recorded to `flow_approvals`
-- with the hardcoded literal reason code "SKIP_PRECONDITIONS": a code that did
-- not have to exist as a row, could not be grouped or reported on, and carried
-- neither `requires_approval` nor `approval_level`. Every other override in the
-- product (room move, the three reversals) resolves its reason code against
-- this table and refuses an unknown one.
--
-- The operator now supplies `skip_reason_code`, resolved against the category
-- added here. A new category rather than reusing OTHER: the whole point of the
-- column is that "why was this overridden" can be answered by grouping, and a
-- night-audit skip filed under OTHER answers nothing.
--
-- Additive. Existing rows are untouched; nothing is written with the new
-- category until an operator skips a precondition.

BEGIN;

ALTER TABLE public.reason_codes DROP CONSTRAINT IF EXISTS reason_codes_reason_category_check;

ALTER TABLE public.reason_codes ADD CONSTRAINT reason_codes_reason_category_check CHECK (
    reason_category IN (
        'ROOM_MOVE',
        'RATE_OVERRIDE',
        'DEPOSIT_OVERRIDE',
        'CANCELLATION',
        'COMP',
        'REFUND',
        'WALK',
        'OVERBOOKING',
        'EARLY_DEPARTURE',
        'LATE_CHECKOUT',
        'MAINTENANCE',
        'COMPLAINT',
        'WRITE_OFF',
        'REVERSAL',
        'NIGHT_AUDIT',
        'OTHER'
    )
);

COMMENT ON COLUMN public.reason_codes.reason_category IS 'Category grouping: ROOM_MOVE, RATE_OVERRIDE, DEPOSIT_OVERRIDE, CANCELLATION, COMP, NIGHT_AUDIT, etc.';

COMMIT;

-- Rollback: only safe while no row carries the new category.
-- BEGIN;
-- DELETE FROM public.reason_codes WHERE reason_category = 'NIGHT_AUDIT';
-- ALTER TABLE public.reason_codes DROP CONSTRAINT IF EXISTS reason_codes_reason_category_check;
-- ALTER TABLE public.reason_codes ADD CONSTRAINT reason_codes_reason_category_check CHECK (
--     reason_category IN ('ROOM_MOVE','RATE_OVERRIDE','DEPOSIT_OVERRIDE','CANCELLATION','COMP',
--         'REFUND','WALK','OVERBOOKING','EARLY_DEPARTURE','LATE_CHECKOUT','MAINTENANCE',
--         'COMPLAINT','WRITE_OFF','REVERSAL','OTHER'));
-- COMMIT;
