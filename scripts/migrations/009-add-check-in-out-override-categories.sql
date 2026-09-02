-- ============================================================================
-- Migration: add-check-in-out-override-categories
-- Version: 009
-- Created: 2026-09-02T00:00:00+00:00
-- ============================================================================
--
-- Why: A08 said `requires_approval` is honoured only by room move and that
-- `force` proceeds "on the authority of the caller". Room move and the three
-- reversals were fixed on 2 September. Check-in and check-out were not — and
-- they are the only three controls the flow registry declares as `kind: "gate"`
-- rather than "record":
--
--   * `reservation_status_check`  — check-in over a lifecycle guard (NO_SHOW → CHECKED_IN)
--   * `deposit_required_check`    — check-in over a blocking deposit schedule
--   * `folio_settlement_check`    — check-out over an unsettled folio, which
--                                   transfers the balance to city-ledger AR
--
-- All three sat inside `if (command.force)`, wrote a `flow_approvals` row, and
-- checked nothing. Each also passed a hardcoded reason code —
-- "FORCE_CHECK_IN_REINSTATE", "FORCE_CHECK_IN", "FORCE_CHECK_OUT" — none of
-- which exists in this table. That is the same defect the night-audit work
-- removed when it replaced the "SKIP_PRECONDITIONS" literal with a resolved
-- `skip_reason_code`: a code that needs no row cannot be grouped, and its
-- `requires_approval` / `approval_level` are therefore unreadable.
--
-- The two halves are coupled, which is why these were skipped rather than
-- half-done: with no real code there is no `approval_level`, and with no
-- `approval_level` there is nothing for an authority check to measure.
--
-- One category per *command*, not per gate. A forced check-in can trip both of
-- its gates, and the payload carries one `reason_code` — the same shape room
-- move has, where one code covers a do-not-move flag, an approval-required code
-- and a dirty room, because forcing past three conditions on one check-in is
-- one decision by one person at one moment.
--
-- `DEPOSIT_OVERRIDE` was deliberately not reused, despite existing since the
-- table was created with four seeded codes and correct approval levels, and
-- being read by nothing. It names a *gate*, and a command carries one code: a
-- forced check-in that is really a status reinstatement would then have to file
-- itself as a deposit waiver. It is left alone rather than moved, since a
-- tenant may have added rows under it.
--
-- Additive. Existing rows are untouched, and no override that works today
-- starts refusing — nothing could have been using these categories.

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
        'CHECK_IN_OVERRIDE',
        'CHECK_OUT_OVERRIDE',
        'OTHER'
    )
);

-- Reference data the handlers *require* ships with the schema, under the
-- all-zero system tenant, so it resolves for every property rather than only
-- the demo one. `resolveReasonCode` reads property → tenant → system.
INSERT INTO public.reason_codes
    (tenant_id, reason_code, reason_name, reason_description, reason_category, requires_approval, approval_level, has_financial_impact, display_order)
VALUES
    -- CHECK_IN_OVERRIDE — forcing past the deposit gate or the lifecycle guard.
    ('00000000-0000-0000-0000-000000000000', 'CI_CORP_ACCOUNT',   'Corporate account',      'The stay is guaranteed by a corporate account in good standing.',        'CHECK_IN_OVERRIDE',  FALSE, 'NONE',       FALSE, 1),
    ('00000000-0000-0000-0000-000000000000', 'CI_PAYMENT_PENDING','Payment not yet posted', 'Payment was taken but has not settled against the deposit schedule.',   'CHECK_IN_OVERRIDE',  FALSE, 'SUPERVISOR', FALSE, 2),
    ('00000000-0000-0000-0000-000000000000', 'CI_GUEST_ARRIVED',  'Guest arrived late',     'The guest arrived after a no-show was recorded; the booking is reinstated.', 'CHECK_IN_OVERRIDE', FALSE, 'SUPERVISOR', FALSE, 3),
    ('00000000-0000-0000-0000-000000000000', 'CI_DEPOSIT_WAIVED', 'Deposit waived',         'The front office manager waived the deposit for this arrival.',         'CHECK_IN_OVERRIDE',  TRUE,  'MANAGER',    TRUE,  4),
    ('00000000-0000-0000-0000-000000000000', 'CI_VIP',            'VIP arrival',            'Arrival cleared by management despite the outstanding requirement.',    'CHECK_IN_OVERRIDE',  TRUE,  'DIRECTOR',   TRUE,  5),
    -- CHECK_OUT_OVERRIDE — leaving with a balance, which becomes city-ledger AR.
    ('00000000-0000-0000-0000-000000000000', 'CO_TO_CITY_LEDGER', 'Billed to company',      'The balance is billed to an approved company account.',                 'CHECK_OUT_OVERRIDE', FALSE, 'NONE',       TRUE,  1),
    ('00000000-0000-0000-0000-000000000000', 'CO_LATE_DEPARTURE', 'Departed before settle', 'The guest departed before the folio could be settled at the desk.',     'CHECK_OUT_OVERRIDE', FALSE, 'SUPERVISOR', TRUE,  2),
    ('00000000-0000-0000-0000-000000000000', 'CO_DISPUTE_OPEN',   'Charge disputed',        'A charge is disputed and the balance is held pending review.',          'CHECK_OUT_OVERRIDE', TRUE,  'MANAGER',    TRUE,  3),
    ('00000000-0000-0000-0000-000000000000', 'CO_GOODWILL',       'Carried as goodwill',    'Management carried the balance rather than pursue it at departure.',    'CHECK_OUT_OVERRIDE', TRUE,  'DIRECTOR',   TRUE,  4)
-- Bare, like every other seed in this table: the unique constraint is
-- (tenant_id, property_id, reason_code, reason_category), and naming a
-- narrower inference target here matches no index and raises 42P10.
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN public.reason_codes.reason_category IS 'Category grouping: ROOM_MOVE, RATE_OVERRIDE, DEPOSIT_OVERRIDE, CANCELLATION, COMP, NIGHT_AUDIT, BLACKLIST, CREDIT_LIMIT, CHECK_IN_OVERRIDE, CHECK_OUT_OVERRIDE, etc.';

COMMIT;

-- Rollback: only safe while no row carries either new category.
-- BEGIN;
-- DELETE FROM public.reason_codes WHERE reason_category IN ('CHECK_IN_OVERRIDE','CHECK_OUT_OVERRIDE');
-- ALTER TABLE public.reason_codes DROP CONSTRAINT IF EXISTS reason_codes_reason_category_check;
-- ALTER TABLE public.reason_codes ADD CONSTRAINT reason_codes_reason_category_check CHECK (
--     reason_category IN ('ROOM_MOVE','RATE_OVERRIDE','DEPOSIT_OVERRIDE','CANCELLATION','COMP',
--         'REFUND','WALK','OVERBOOKING','EARLY_DEPARTURE','LATE_CHECKOUT','MAINTENANCE',
--         'COMPLAINT','WRITE_OFF','REVERSAL','NIGHT_AUDIT','BLACKLIST','CREDIT_LIMIT','OTHER'));
-- COMMIT;
