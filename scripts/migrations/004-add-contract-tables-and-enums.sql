-- ============================================================================
-- Migration: add-contract-tables-and-enums
-- Version: 004
-- Created: 2026-08-10T00:00:00+00:00
-- ============================================================================
--
-- Why: the second half of the sql-contract-check backlog. Service code reads
-- two tables that were never created, writes three enum labels that were never
-- defined, and joins on five columns that do not exist. Each was judged a real
-- modelling gap rather than a drifted name — there is no existing table or
-- column carrying the meaning, and a shipped code path depends on it.
--
-- Enum labels are added outside the transaction: PostgreSQL forbids using a
-- label in the same transaction that adds it, and ALTER TYPE ... ADD VALUE is
-- not transactional in the way the rest of this migration is.

-- ─── enum labels ────────────────────────────────────────────────────────────
-- Advance deposits are a distinct payment transaction in a PMS: money taken
-- before arrival against a future stay, then applied to the folio or refunded.
-- billing/deposit.ts has always written these three values.
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'ADVANCE_DEPOSIT';
ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'DEPOSIT_REFUND';

-- The state a deposit reaches when it is consumed by a folio. Distinct from
-- COMPLETED (money received) and REFUNDED (money returned).
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'APPLIED';

-- A held room, as opposed to OUT_OF_ORDER (unsellable, damaged) or
-- OUT_OF_SERVICE (unsellable, still counted). rooms.is_blocked already exists;
-- room-command-service sets both to keep one source of truth.
ALTER TYPE room_status ADD VALUE IF NOT EXISTS 'BLOCKED';

BEGIN;

-- ─── travel_agents ──────────────────────────────────────────────────────────
-- Agents are currently modelled only as companies, so there is no row to hang
-- an agent identity, IATA number or default commission terms on. Commission
-- calculation in billing and check-out both resolve an agent to its company.
CREATE TABLE IF NOT EXISTS travel_agents (
    agent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants (id),
    property_id UUID,

    -- The agency this agent books on behalf of. Commission rules and
    -- statements are keyed on the company, which is why every commission
    -- lookup starts by resolving agent -> company.
    company_id UUID REFERENCES companies (company_id),

    agent_code VARCHAR(50) NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    agent_email VARCHAR(255),
    agent_phone VARCHAR(50),

    -- Industry identifiers used for commission settlement.
    iata_number VARCHAR(20),
    consortium VARCHAR(100),

    default_commission_rate DECIMAL(5, 2),
    commission_currency VARCHAR(3),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID,
    updated_by UUID,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    version INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_travel_agents_code
    ON travel_agents (tenant_id, agent_code) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_travel_agents_company
    ON travel_agents (company_id) WHERE company_id IS NOT NULL;

COMMENT ON TABLE travel_agents IS 'Travel agents booking on behalf of an agency; commission resolves agent -> company';
COMMENT ON COLUMN travel_agents.company_id IS 'Agency the agent belongs to; commission rules and statements are keyed on this';
COMMENT ON COLUMN travel_agents.iata_number IS 'IATA identifier used for commission settlement';

-- ─── channel_sync_logs ──────────────────────────────────────────────────────
-- Per-run log of an OTA/channel inventory or rate sync. The night audit report
-- reads the most recent run per mapping to show what failed overnight.
CREATE TABLE IF NOT EXISTS channel_sync_logs (
    sync_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants (id),
    property_id UUID,

    channel_mapping_id UUID REFERENCES channel_mappings (id) ON DELETE CASCADE,
    channel_name VARCHAR(100),

    -- inventory | rates | restrictions | reservations
    sync_type VARCHAR(50) NOT NULL,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'running',

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    records_processed INTEGER NOT NULL DEFAULT 0,
    records_updated INTEGER NOT NULL DEFAULT 0,
    records_failed INTEGER NOT NULL DEFAULT 0,

    error_message TEXT,
    -- Who or what started the run: a user id, 'scheduler', or 'night-audit'.
    triggered_by VARCHAR(100),

    payload JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,

    CONSTRAINT channel_sync_logs_status_check
        CHECK (sync_status IN ('running', 'succeeded', 'failed', 'partial'))
);

-- The night-audit query: latest runs for one mapping, newest first.
CREATE INDEX IF NOT EXISTS idx_channel_sync_logs_mapping
    ON channel_sync_logs (channel_mapping_id, started_at DESC);
-- Failure sweeps across a tenant.
CREATE INDEX IF NOT EXISTS idx_channel_sync_logs_failed
    ON channel_sync_logs (tenant_id, sync_status) WHERE sync_status = 'failed';

COMMENT ON TABLE channel_sync_logs IS 'Per-run log of channel/OTA sync attempts; one row per run, read by the night audit';
COMMENT ON COLUMN channel_sync_logs.triggered_by IS 'User id, or scheduler/night-audit for automated runs';

-- ─── agent references on commission tables ──────────────────────────────────
-- Both tables key on company_id today, so a commission cannot be attributed to
-- the individual agent who made the booking.
ALTER TABLE travel_agent_commissions ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE commission_statements ADD COLUMN IF NOT EXISTS agent_id UUID;

ALTER TABLE travel_agent_commissions DROP CONSTRAINT IF EXISTS fk_tac_agent_id;
ALTER TABLE travel_agent_commissions
    ADD CONSTRAINT fk_tac_agent_id FOREIGN KEY (agent_id)
    REFERENCES travel_agents (agent_id) ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE commission_statements DROP CONSTRAINT IF EXISTS fk_cs_agent_id;
ALTER TABLE commission_statements
    ADD CONSTRAINT fk_cs_agent_id FOREIGN KEY (agent_id)
    REFERENCES travel_agents (agent_id) ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

COMMENT ON COLUMN travel_agent_commissions.agent_id IS 'Individual agent the commission is attributed to (company_id remains the settlement party)';
COMMENT ON COLUMN commission_statements.agent_id IS 'Individual agent the statement covers, when narrower than the company';

-- ─── direct-bill routing target ─────────────────────────────────────────────
-- A DIRECT_BILL routing rule sends charges to an AR account, but the rule had
-- nowhere to record which one.
ALTER TABLE folio_routing_rules ADD COLUMN IF NOT EXISTS target_account_id UUID;

ALTER TABLE folio_routing_rules DROP CONSTRAINT IF EXISTS fk_frr_target_account_id;
ALTER TABLE folio_routing_rules
    ADD CONSTRAINT fk_frr_target_account_id FOREIGN KEY (target_account_id)
    REFERENCES ar_accounts (ar_account_id) ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

COMMENT ON COLUMN folio_routing_rules.target_account_id IS 'AR account a DIRECT_BILL rule routes charges to';

-- ─── guest linkage on inbound queues ────────────────────────────────────────
-- Both queues carry guest name/email but no guest reference, so a GDPR erasure
-- request cannot reach a reservation still sitting in the queue.
ALTER TABLE gds_reservation_queue ADD COLUMN IF NOT EXISTS guest_id UUID;
ALTER TABLE ota_reservations_queue ADD COLUMN IF NOT EXISTS guest_id UUID;

CREATE INDEX IF NOT EXISTS idx_gds_queue_guest
    ON gds_reservation_queue (guest_id) WHERE guest_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ota_queue_guest
    ON ota_reservations_queue (guest_id) WHERE guest_id IS NOT NULL;

COMMENT ON COLUMN gds_reservation_queue.guest_id IS 'Matched guest, once resolved; lets privacy erasure reach queued reservations';
COMMENT ON COLUMN ota_reservations_queue.guest_id IS 'Matched guest, once resolved; lets privacy erasure reach queued reservations';

-- ─── folio routing uniqueness ───────────────────────────────────────────────
-- group-billing relies on ON CONFLICT DO NOTHING to avoid creating a duplicate
-- routing rule per reservation; without a matching unique index that clause
-- raises 42P10. Partial so superseded (soft-deleted) rules do not block a new one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_folio_routing_rule_target
    ON folio_routing_rules (tenant_id, source_reservation_id, charge_code_pattern, destination_folio_id)
    WHERE is_deleted = FALSE AND source_reservation_id IS NOT NULL;

-- Direction and created-count, read by the night-audit channel sync report.
ALTER TABLE channel_sync_logs ADD COLUMN IF NOT EXISTS sync_direction VARCHAR(20);
ALTER TABLE channel_sync_logs ADD COLUMN IF NOT EXISTS records_created INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN channel_sync_logs.sync_direction IS 'inbound (channel -> PMS) or outbound (PMS -> channel)';
COMMENT ON COLUMN channel_sync_logs.records_created IS 'Rows created by the run, as distinct from records_updated';

COMMIT;

-- ROLLBACK SQL (enum labels cannot be removed without recreating the type):
-- BEGIN;
-- DROP INDEX IF EXISTS idx_ota_queue_guest;
-- DROP INDEX IF EXISTS idx_gds_queue_guest;
-- ALTER TABLE ota_reservations_queue DROP COLUMN IF EXISTS guest_id;
-- ALTER TABLE gds_reservation_queue DROP COLUMN IF EXISTS guest_id;
-- ALTER TABLE folio_routing_rules DROP CONSTRAINT IF EXISTS fk_frr_target_account_id;
-- ALTER TABLE folio_routing_rules DROP COLUMN IF EXISTS target_account_id;
-- ALTER TABLE commission_statements DROP CONSTRAINT IF EXISTS fk_cs_agent_id;
-- ALTER TABLE commission_statements DROP COLUMN IF EXISTS agent_id;
-- ALTER TABLE travel_agent_commissions DROP CONSTRAINT IF EXISTS fk_tac_agent_id;
-- ALTER TABLE travel_agent_commissions DROP COLUMN IF EXISTS agent_id;
-- DROP TABLE IF EXISTS channel_sync_logs;
-- DROP INDEX IF EXISTS uq_folio_routing_rule_target;
-- DROP TABLE IF EXISTS travel_agents;
-- COMMIT;
