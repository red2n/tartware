-- ============================================================================
-- Migration: add-folio-close-override-category
-- Version: 011
-- Created: 2026-09-03T00:00:00+00:00
-- ============================================================================
--
-- Why: three `force` paths bypassed a control on nobody's authority, and they
-- were invisible to the guardrail that exists to catch exactly that. The rule
-- added with A08 fires on files that write `forced: true` to `flow_approvals` —
-- which trusts a bypass to declare itself. These three wrote no row at all:
--
--   * `billing.folio.close`      closes a folio carrying an outstanding balance
--   * `billing.group.checkout`   departs a group over unsettled member folios
--   * `group.check_in`           forces up to 500 arrivals past their deposits
--
-- The last two bypass, in bulk, the two controls the flow registry declares as
-- `kind: "gate"` on the single-reservation path — `folio_settlement_check` and
-- `deposit_required_check`. Since A08 the single departure has needed a reason
-- code and an authority; the group departure needed neither. A control with a
-- cheaper bulk route is not a control.
--
-- The two group commands reuse the categories their single-reservation
-- equivalents already have (CHECK_OUT_OVERRIDE, CHECK_IN_OVERRIDE): it is the
-- same decision at a different scale, and `flow_approvals.gate_name` then
-- groups the bulk bypass with the single one, which is how an auditor would
-- want to read it.
--
-- `billing.folio.close` needs its own, and this migration is that category.
-- CHECK_OUT_OVERRIDE was the first choice and is wrong. Those codes describe a
-- balance that *goes* somewhere — `CO_TO_CITY_LEDGER` is level NONE precisely
-- because billing an approved company account is not a loss. Closing a folio
-- moves nothing: no city-ledger transfer, no write-off entry, the balance
-- simply stops being collectable through the folio. Reusing that category would
-- have let an operator name a transfer that does not happen and, because the
-- code is level NONE, waive the authority check while doing it.
--
-- So every code below sits at SUPERVISOR or above. There is no unremarkable
-- close over a balance, which is the difference from check-out.
--
-- `FC_UNCOLLECTABLE` names the write-off in its own description on purpose. A
-- balance nobody is pursuing should be written off, where dual control and the
-- amount ladder apply; closing the folio instead reaches the same outcome with
-- neither. The code exists so that choice is recorded rather than hidden, and
-- sits at DIRECTOR so it is not the easy path.
--
-- Additive. Existing rows are untouched, and nothing that works today starts
-- refusing on this migration alone — the refusal comes from the handler, which
-- now requires a reason code whenever `force` is set.

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
        'FOLIO_CLOSE_OVERRIDE',
        'OTHER'
    )
);

-- Reference data the handler *requires* ships under the all-zero system tenant,
-- so it resolves for every property rather than only the demo one.
-- `resolveReasonCode` reads property -> tenant -> system.
INSERT INTO public.reason_codes
    (tenant_id, reason_code, reason_name, reason_description, reason_category, requires_approval, approval_level, has_financial_impact, display_order)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'FC_SMALL_BALANCE', 'Residual under tolerance', 'A rounding residual below the property''s write-off tolerance.',                     'FOLIO_CLOSE_OVERRIDE', TRUE, 'SUPERVISOR', TRUE, 1),
    ('00000000-0000-0000-0000-000000000000', 'FC_DUPLICATE',     'Folio opened in error',    'The folio duplicates another; the balance on it is an artefact.',                    'FOLIO_CLOSE_OVERRIDE', TRUE, 'SUPERVISOR', TRUE, 2),
    ('00000000-0000-0000-0000-000000000000', 'FC_DISPUTE_HELD',  'Charge disputed',          'A charge is disputed and the folio is closed pending the review.',                   'FOLIO_CLOSE_OVERRIDE', TRUE, 'MANAGER',    TRUE, 3),
    ('00000000-0000-0000-0000-000000000000', 'FC_UNCOLLECTABLE', 'Judged uncollectable',     'The balance is not being pursued. Prefer a write-off, which is recorded as one.',    'FOLIO_CLOSE_OVERRIDE', TRUE, 'DIRECTOR',   TRUE, 4),
    ('00000000-0000-0000-0000-000000000000', 'FC_MANAGEMENT',    'Closed by management',     'Closed on management instruction, documented outside the folio.',                    'FOLIO_CLOSE_OVERRIDE', TRUE, 'GM',         TRUE, 5)
ON CONFLICT DO NOTHING;

COMMIT;

-- Rollback: only safe while no row carries the new category, and while no
-- forced folio close is relying on it. Rolling this back re-opens the bypass.
-- BEGIN;
-- DELETE FROM public.reason_codes WHERE reason_category = 'FOLIO_CLOSE_OVERRIDE';
-- ALTER TABLE public.reason_codes DROP CONSTRAINT IF EXISTS reason_codes_reason_category_check;
-- ALTER TABLE public.reason_codes ADD CONSTRAINT reason_codes_reason_category_check CHECK (
--     reason_category IN ('ROOM_MOVE','RATE_OVERRIDE','DEPOSIT_OVERRIDE','CANCELLATION','COMP',
--         'REFUND','WALK','OVERBOOKING','EARLY_DEPARTURE','LATE_CHECKOUT','MAINTENANCE',
--         'COMPLAINT','WRITE_OFF','REVERSAL','NIGHT_AUDIT','BLACKLIST','CREDIT_LIMIT',
--         'CHECK_IN_OVERRIDE','CHECK_OUT_OVERRIDE','OTHER'));
-- COMMIT;
