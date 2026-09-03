-- =====================================================
-- override_step_up_grants.sql
-- A supervisor's authorisation of one override, at the terminal.
--
-- The override audit closed eleven findings and left one sentence standing:
-- authority is checked, never re-proven. Twelve override points ask whether the
-- logged-in operator clears a reason code's `approval_level` — but that measures
-- the session that happens to be open, not a credential entered at the moment
-- of the decision. This table is where the second credential is recorded.
--
-- A row is minted by core-service (which owns password verification), claimed
-- exactly once by the gateway's accept path, and travels onward as
-- `metadata.stepUp` on the command envelope. It is deliberately NOT reachable
-- for the five commands in COMMAND_DUAL_CONTROL: those need a second actor
-- asynchronously, through `approval_requests`, and a credential typed at a
-- counter is a second person but not deliberation.
--
-- Shape lives in schema/src/api/override-step-up.ts (OverrideStepUpGrantRow).
-- =====================================================

\echo 'Creating override_step_up_grants table...'

CREATE TABLE IF NOT EXISTS override_step_up_grants (
    grant_id            UUID          NOT NULL DEFAULT uuid_generate_v4(),
    tenant_id           UUID          NOT NULL, -- Tenant scope; checked again at spend time
    property_id         UUID, -- Where the terminal is, when the caller says
    command_name        VARCHAR(120)  NOT NULL, -- The one command this authorises
    entity_id           UUID, -- The one record, when the command names one
    supervisor_id       UUID          NOT NULL, -- Who stood at the terminal
    supervisor_role     VARCHAR(60)   NOT NULL, -- Their membership role in this tenant
    requested_by        VARCHAR(100)  NOT NULL, -- The operator who asked; actor of record
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ   NOT NULL, -- Short: it covers one confirmation
    consumed_at         TIMESTAMPTZ, -- Single use. NULL until claimed.
    consumed_command_id UUID, -- Which command spent it

    CONSTRAINT pk_override_step_up_grants PRIMARY KEY (grant_id)
);

COMMENT ON TABLE override_step_up_grants IS
    'Supervisor step-up: one credential, one command, one record, once. Minted by core-service, claimed by the gateway, recorded on the override.';
COMMENT ON COLUMN override_step_up_grants.command_name IS
    'The command this grant authorises. Never a dual-control command — those go through approval_requests.';
COMMENT ON COLUMN override_step_up_grants.entity_id IS
    'The record authorised against. NULL only for commands that name no single record; a NULL grant is not a wildcard for one that names an entity.';
COMMENT ON COLUMN override_step_up_grants.supervisor_id IS
    'The authority the override is recorded against — "recorded against the supervisor", which is the half of the model that makes the trail worth keeping.';
COMMENT ON COLUMN override_step_up_grants.requested_by IS
    'The operator who asked. Stays the actor of record on the command: collapsing the two would lose which is which.';
COMMENT ON COLUMN override_step_up_grants.consumed_at IS
    'Claimed by a conditional UPDATE, so two commands racing for one grant cannot both win.';

-- The spend path reads by id and claims conditionally; the index is for the
-- expiry sweep and for showing an operator what they were granted.
CREATE INDEX IF NOT EXISTS idx_step_up_grants_tenant_pending
    ON override_step_up_grants (tenant_id, expires_at)
    WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_step_up_grants_supervisor
    ON override_step_up_grants (tenant_id, supervisor_id, created_at DESC);

\echo 'override_step_up_grants table created.'
