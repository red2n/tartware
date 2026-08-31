-- ============================================================================
-- Migration: add-override-reason-categories
-- Version: 007
-- Created: 2026-08-31T00:00:00+00:00
-- ============================================================================
--
-- Why: two blocking controls in the product were hard throws with no override
-- path at all (audit finding A05).
--
--   * `GUEST_BLACKLISTED` refuses `reservation.create` for a blacklisted guest.
--     Its message told the operator that "a GM override with documented reason
--     is required to proceed" — a mechanism that did not exist anywhere in the
--     repo, so the only way past it was to edit `guests.is_blacklisted`.
--   * `CREDIT_LIMIT_EXCEEDED` refuses a payment authorize/capture past a
--     guest's block threshold, and a city-ledger transfer past an AR account's
--     available credit. A front office that cannot take a corporate guest's
--     folio to the ledger on the night their limit is one dollar short has to
--     raise the limit instead, which loses the fact that anything happened.
--
-- Both now take a reason code from a category of their own, resolved and
-- authorised before the block is lifted. Separate categories rather than one
-- OVERRIDE bucket: the two decisions are made by different people for different
-- reasons, and a blacklist clearance filed alongside a credit extension makes
-- the "why was this overridden" report unanswerable — which is what the column
-- is for.
--
-- This migration also makes `approval_level` mean something for the first time.
-- The column has existed since the table was created, with a CHECK constraint
-- and a comment reading "minimum role to approve", and no code has ever read
-- it. Nothing here changes existing rows: every code seeded before today keeps
-- the default 'NONE', so no override that works today starts refusing.
--
-- Additive. Existing rows are untouched.

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
        'BLACKLIST',
        'CREDIT_LIMIT',
        'OTHER'
    )
);

COMMENT ON COLUMN public.reason_codes.reason_category IS 'Category grouping: ROOM_MOVE, RATE_OVERRIDE, DEPOSIT_OVERRIDE, CANCELLATION, COMP, NIGHT_AUDIT, BLACKLIST, CREDIT_LIMIT, etc.';

COMMENT ON COLUMN public.reason_codes.approval_level IS 'Minimum authority an override under this code takes. Translated to a membership role by approvalLevelMinRole in @tartware/schemas: SUPERVISOR and MANAGER both map to MANAGER (the product has one tier there), DIRECTOR to ADMIN, GM to OWNER. NONE asks for nothing beyond the command''s own floor.';

COMMIT;

-- Rollback: only safe while no row carries either new category.
-- BEGIN;
-- DELETE FROM public.reason_codes WHERE reason_category IN ('BLACKLIST','CREDIT_LIMIT');
-- ALTER TABLE public.reason_codes DROP CONSTRAINT IF EXISTS reason_codes_reason_category_check;
-- ALTER TABLE public.reason_codes ADD CONSTRAINT reason_codes_reason_category_check CHECK (
--     reason_category IN ('ROOM_MOVE','RATE_OVERRIDE','DEPOSIT_OVERRIDE','CANCELLATION','COMP',
--         'REFUND','WALK','OVERBOOKING','EARLY_DEPARTURE','LATE_CHECKOUT','MAINTENANCE',
--         'COMPLAINT','WRITE_OFF','REVERSAL','NIGHT_AUDIT','OTHER'));
-- COMMIT;
