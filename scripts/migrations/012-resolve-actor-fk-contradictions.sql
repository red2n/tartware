-- ============================================================================
-- Migration: resolve-actor-fk-contradictions
-- Version: 012
-- Created: 2026-09-03T00:00:00+00:00
-- ============================================================================
--
-- Why: eight columns were declared NOT NULL while their foreign key promised
-- ON DELETE SET NULL. Postgres accepts both definitions happily and then fails
-- the delete at runtime with a not-null violation, so every one of these
-- constraints was unable to do what its own comment said it did:
--
--     -- Note: SET NULL to preserve audit trail if user is deleted
--     ... ON DELETE SET NULL
--     user_id UUID NOT NULL
--
-- In practice it is latent: nothing in the application hard-deletes a user
-- (`users.is_deleted` is a soft-delete flag and that is the only path). It bites
-- on manual cleanup, which is how it was found, and it would bite hard the day
-- an erasure job was written against it.
--
-- The eight do not all deserve the same answer, and giving them one would be
-- the real mistake. What separates them is whether the row can still say who
-- acted once the id is gone:
--
--   SET NULL (drop NOT NULL) -- the row keeps a denormalised actor
--     audit_logs.user_id       user_email / user_name / user_role sit beside it
--     guest_notes.created_by   created_by_name / created_by_role
--
--   RESTRICT -- the column is the only record of who acted
--     folios.created_by
--     incident_reports.created_by
--     maintenance_requests.reported_by
--     night_audit_log.initiated_by
--     rate_overrides.requested_by
--     refunds.requested_by
--
-- The second group is where the uniform answer goes wrong. Nulling
-- `refunds.requested_by` or `rate_overrides.requested_by` keeps a financial
-- control record and erases its author -- the half that makes it a control. A
-- refund nobody requested is not an audit trail, it is a hole in one. Since
-- staff are soft-deleted, RESTRICT blocks nothing the product actually does; it
-- refuses precisely the operation that would silently destroy attribution.
--
-- Nothing in the running system changes: no delete of a user succeeds today
-- (the not-null violation stopped it), and none succeeds after this either --
-- it now fails with a message that says what it is protecting, or, for the two
-- with a name copy, succeeds and leaves the trail readable.

BEGIN;

-- ── Group 1: the FK's stated intent, now actually reachable ─────────────────

ALTER TABLE public.audit_logs ALTER COLUMN user_id DROP NOT NULL;
COMMENT ON COLUMN public.audit_logs.user_id IS
    'Who performed the action. NULL once that user is deleted -- user_email / user_name / user_role keep the trail readable.';

ALTER TABLE public.guest_notes ALTER COLUMN created_by DROP NOT NULL;
COMMENT ON COLUMN public.guest_notes.created_by IS
    'Who wrote the note. NULL once that user is deleted -- created_by_name / created_by_role keep the authorship readable.';

-- ── Group 2: attribution is the record, so the delete is refused ────────────

ALTER TABLE public.folios DROP CONSTRAINT IF EXISTS fk_folios_created_by;
ALTER TABLE public.folios
    ADD CONSTRAINT fk_folios_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.incident_reports DROP CONSTRAINT IF EXISTS fk_incident_reports_created_by;
ALTER TABLE public.incident_reports
    ADD CONSTRAINT fk_incident_reports_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE RESTRICT;

ALTER TABLE public.maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_reported_by;
ALTER TABLE public.maintenance_requests
    ADD CONSTRAINT fk_maintenance_requests_reported_by
    FOREIGN KEY (reported_by) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_initiated_by;
ALTER TABLE public.night_audit_log
    ADD CONSTRAINT fk_night_audit_log_initiated_by
    FOREIGN KEY (initiated_by) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_requested_by;
ALTER TABLE public.rate_overrides
    ADD CONSTRAINT fk_rate_overrides_requested_by
    FOREIGN KEY (requested_by) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS fk_refunds_requested_by;
ALTER TABLE public.refunds
    ADD CONSTRAINT fk_refunds_requested_by
    FOREIGN KEY (requested_by) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

-- Rollback: restores the contradiction, so only for getting back to a known
-- state -- the SET NULL constraints below cannot fire while the columns are
-- NOT NULL, which is the defect this migration removes.
-- BEGIN;
-- ALTER TABLE public.audit_logs ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.guest_notes ALTER COLUMN created_by SET NOT NULL;
-- ALTER TABLE public.folios DROP CONSTRAINT IF EXISTS fk_folios_created_by;
-- ALTER TABLE public.folios ADD CONSTRAINT fk_folios_created_by
--     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE public.incident_reports DROP CONSTRAINT IF EXISTS fk_incident_reports_created_by;
-- ALTER TABLE public.incident_reports ADD CONSTRAINT fk_incident_reports_created_by
--     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
-- ALTER TABLE public.maintenance_requests DROP CONSTRAINT IF EXISTS fk_maintenance_requests_reported_by;
-- ALTER TABLE public.maintenance_requests ADD CONSTRAINT fk_maintenance_requests_reported_by
--     FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE public.night_audit_log DROP CONSTRAINT IF EXISTS fk_night_audit_log_initiated_by;
-- ALTER TABLE public.night_audit_log ADD CONSTRAINT fk_night_audit_log_initiated_by
--     FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE public.rate_overrides DROP CONSTRAINT IF EXISTS fk_rate_overrides_requested_by;
-- ALTER TABLE public.rate_overrides ADD CONSTRAINT fk_rate_overrides_requested_by
--     FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE public.refunds DROP CONSTRAINT IF EXISTS fk_refunds_requested_by;
-- ALTER TABLE public.refunds ADD CONSTRAINT fk_refunds_requested_by
--     FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
-- COMMIT;
