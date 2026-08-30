-- ============================================================================
-- Migration: add-approval-request-command-columns
-- Version: 005
-- Created: 2026-08-30T00:00:00+00:00
-- ============================================================================
--
-- Why: `approval_requests` was built for operations raised over REST and named
-- by a free-text `operation_type`. It now also holds commands the Command
-- Center refused to dispatch on one person's authority, and those need four
-- things the table could not carry: which command to run when the request is
-- released, the idempotency key of the submission that raised it (so a
-- resubmitted key re-reads the request instead of queueing a second write-off),
-- the role the requester held (it travels into the dispatched envelope and on
-- to `flow_approvals.role_at_approval` — see A03), and the id of the command
-- the approval actually dispatched.
--
-- All four are nullable and additive: the REST-raised billing requests leave
-- them NULL and behave exactly as before.

BEGIN;

ALTER TABLE public.approval_requests ADD COLUMN IF NOT EXISTS command_name VARCHAR(120);
ALTER TABLE public.approval_requests ADD COLUMN IF NOT EXISTS request_id VARCHAR(128);
ALTER TABLE public.approval_requests ADD COLUMN IF NOT EXISTS requested_by_role VARCHAR(60);
ALTER TABLE public.approval_requests ADD COLUMN IF NOT EXISTS dispatched_command_id UUID;

COMMENT ON COLUMN public.approval_requests.command_name    IS 'Command this approval releases; NULL for REST-raised billing requests';
COMMENT ON COLUMN public.approval_requests.request_id      IS 'Idempotency key of the submission that raised the request — resubmitting it re-reads this row rather than raising a second';
COMMENT ON COLUMN public.approval_requests.requested_by_role IS 'Role the requester held at submission, carried into the dispatched command envelope';
COMMENT ON COLUMN public.approval_requests.dispatched_command_id IS 'command_dispatches.id of the command this approval released, set when it is approved';

-- One approval per (tenant, command, idempotency key).
CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_requests_command_request
    ON public.approval_requests (tenant_id, command_name, request_id)
    WHERE command_name IS NOT NULL AND request_id IS NOT NULL;

COMMIT;

-- Rollback:
-- BEGIN;
-- DROP INDEX IF EXISTS uq_approval_requests_command_request;
-- ALTER TABLE public.approval_requests DROP COLUMN IF EXISTS dispatched_command_id;
-- ALTER TABLE public.approval_requests DROP COLUMN IF EXISTS requested_by_role;
-- ALTER TABLE public.approval_requests DROP COLUMN IF EXISTS request_id;
-- ALTER TABLE public.approval_requests DROP COLUMN IF EXISTS command_name;
-- COMMIT;
