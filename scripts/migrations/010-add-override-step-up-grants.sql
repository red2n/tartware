-- ============================================================================
-- Migration: add-override-step-up-grants
-- Version: 010
-- Created: 2026-09-02T00:00:00+00:00
-- ============================================================================
--
-- Why: the override audit closed all eleven of its findings and left exactly
-- one sentence standing — authority is **checked, never re-proven**.
--
-- Twelve override points now ask whether the acting role clears the reason
-- code's `approval_level` and refuse otherwise. What every one of them measures
-- is the session that happens to be open at that terminal, not a credential
-- entered at the moment of the decision. OPERA's override is an interruption:
-- the operator lacks the right, a supervisor enters *their own* credentials
-- there and then, the action proceeds and is recorded against the supervisor.
--
-- The gap is narrow and it is the common case — a clerk at the desk with a
-- guest in front of them who needs a manager's authority for the next thirty
-- seconds. Until now the answer was a queued approval, or a manager logging the
-- clerk out of their own terminal.
--
-- What this deliberately does NOT do: it does not touch dual control. The five
-- commands in COMMAND_DUAL_CONTROL — ar.city_ledger.write_off,
-- billing.ar.write_off, billing.suspense.write_off, billing.fiscal_period.reopen,
-- billing.date_roll.manual — still require a second actor asynchronously through
-- `approval_requests`, and the mint path refuses to issue a grant for any of
-- them, so no grant for one can exist to be spent. Nothing recovers a write-off;
-- the authority for it is asked for beforehand and away from a pressured
-- counter. A credential typed at a desk is a second person, but it is not
-- deliberation, and a control satisfiable in thirty seconds at the point of
-- maximum pressure is the one that gets rubber-stamped.
--
-- The grant is scoped to one command AND one record. A supervisor authorising a
-- room move for one booking must not move a different guest, which is the claim
-- a command-only grant would quietly let the audit trail make.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS override_step_up_grants (
    grant_id            UUID          NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id           UUID          NOT NULL,
    property_id         UUID,
    command_name        VARCHAR(120)  NOT NULL,
    entity_id           UUID,
    supervisor_id       UUID          NOT NULL,
    supervisor_role     VARCHAR(60)   NOT NULL,
    requested_by        VARCHAR(100)  NOT NULL,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ   NOT NULL,
    consumed_at         TIMESTAMPTZ,
    consumed_command_id UUID,

    CONSTRAINT pk_override_step_up_grants PRIMARY KEY (grant_id)
);

COMMENT ON TABLE override_step_up_grants IS
    'Supervisor step-up: one credential, one command, one record, once. Minted by core-service, claimed by the gateway, recorded on the override.';
COMMENT ON COLUMN override_step_up_grants.command_name IS
    'The command this grant authorises. Never a dual-control command — those go through approval_requests.';
COMMENT ON COLUMN override_step_up_grants.entity_id IS
    'The record authorised against. NULL only for commands that name no single record; a NULL grant is not a wildcard for one that names an entity.';
COMMENT ON COLUMN override_step_up_grants.supervisor_id IS
    'The authority the override is recorded against.';
COMMENT ON COLUMN override_step_up_grants.requested_by IS
    'The operator who asked. Stays the actor of record on the command.';
COMMENT ON COLUMN override_step_up_grants.consumed_at IS
    'Claimed by a conditional UPDATE, so two commands racing for one grant cannot both win.';

CREATE INDEX IF NOT EXISTS idx_step_up_grants_tenant_pending
    ON override_step_up_grants (tenant_id, expires_at)
    WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_step_up_grants_supervisor
    ON override_step_up_grants (tenant_id, supervisor_id, created_at DESC);

COMMIT;
