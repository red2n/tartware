-- ============================================================================
-- Migration: add-command-batches
-- Version: 2026-08-28-002
-- Created: 2026-08-28T00:00:00+00:00
-- ============================================================================
--
-- Why: WS-04's batch envelope needs somewhere to put its per-item outcomes.
-- A batch command is accepted with 202 and runs asynchronously, so there is no
-- response left to return them in, and the command consumer discards handler
-- return values — which is why `group.check_in` has always built a detailed
-- per-reservation summary and thrown it away.
--
-- An operator who mass-cancels 200 bookings has to be able to find out which
-- ones did not cancel, after the request has ended. That is what these two
-- tables are for: one row per run, one row per requested item, always.
--
-- Table DDL lives in scripts/tables/01-core/25_command_batches.sql and the
-- catalogue entries in scripts/tables/01-core/10_command_center.sql; both are
-- only applied on a fresh database, so an existing install needs this.
-- ============================================================================

BEGIN;

-- CREATE TYPE has no IF NOT EXISTS, and this migration must be re-runnable.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'command_batch_status') THEN
        CREATE TYPE command_batch_status AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'command_batch_item_outcome') THEN
        CREATE TYPE command_batch_item_outcome AS ENUM ('SUCCEEDED', 'FAILED', 'SKIPPED');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS command_batches (
    batch_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    property_id UUID,
    command_name VARCHAR(150) NOT NULL,
    status command_batch_status NOT NULL DEFAULT 'RUNNING',
    total INTEGER NOT NULL DEFAULT 0,
    succeeded INTEGER NOT NULL DEFAULT 0,
    failed INTEGER NOT NULL DEFAULT 0,
    skipped INTEGER NOT NULL DEFAULT 0,
    dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    correlation_id VARCHAR(120),
    actor_id UUID,
    error_code VARCHAR(100),
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT command_batches_counts_account_for_every_item
        CHECK (succeeded + failed + skipped <= total)
);

CREATE INDEX IF NOT EXISTS idx_command_batches_tenant_command
    ON command_batches (tenant_id, command_name, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_command_batches_property
    ON command_batches (tenant_id, property_id, started_at DESC)
    WHERE property_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS command_batch_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES command_batches (batch_id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    item_index INTEGER NOT NULL,
    target_id UUID,
    outcome command_batch_item_outcome NOT NULL,
    event_id UUID,
    error_code VARCHAR(100),
    error_message TEXT,
    duration_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT command_batch_items_failure_carries_a_code
        CHECK (outcome <> 'FAILED' OR error_code IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_command_batch_items_position
    ON command_batch_items (batch_id, item_index);

CREATE INDEX IF NOT EXISTS idx_command_batch_items_failures
    ON command_batch_items (batch_id, outcome)
    WHERE outcome = 'FAILED';

CREATE INDEX IF NOT EXISTS idx_command_batch_items_target
    ON command_batch_items (tenant_id, target_id)
    WHERE target_id IS NOT NULL;

-- Both tables carry tenant_id and are absent from the exclusion list in
-- scripts/tables/98_row_level_security.sql, so its dynamic pass gives them a
-- tenant_isolation policy. Re-run that script after this migration on an
-- install that relies on RLS.

INSERT INTO command_templates (
    command_name, description, default_target_service, required_modules, metadata
)
VALUES
    ('reservation.mass_cancel',
     'Cancel many reservations in one batch',
     'reservations-command-service', ARRAY['core'], jsonb_build_object('seeded', true)),
    ('reservation.mass_check_in',
     'Check in many reservations in one batch',
     'reservations-command-service', ARRAY['core'], jsonb_build_object('seeded', true)),
    ('reservation.mass_update',
     'Apply one set of changes to many reservations',
     'reservations-command-service', ARRAY['core'], jsonb_build_object('seeded', true))
ON CONFLICT (command_name) DO UPDATE SET
    description = EXCLUDED.description,
    default_target_service = EXCLUDED.default_target_service,
    required_modules = EXCLUDED.required_modules;

INSERT INTO command_routes (command_name, environment, tenant_id, service_id, topic, metadata)
SELECT
    ct.command_name,
    'development',
    NULL,
    ct.default_target_service,
    ct.default_topic,
    jsonb_build_object('seeded', true)
FROM command_templates ct
WHERE ct.command_name IN (
        'reservation.mass_cancel',
        'reservation.mass_check_in',
        'reservation.mass_update'
      )
  AND NOT EXISTS (
        SELECT 1 FROM command_routes cr
        WHERE cr.command_name = ct.command_name
          AND cr.environment = 'development'
          AND cr.tenant_id IS NULL
      );

-- Ship disabled, like every other command in the catalogue. One mistyped batch
-- cancels two hundred bookings, so this is the last set of commands that should
-- arrive switched on.
INSERT INTO command_features (command_name, environment, tenant_id, status, metadata)
SELECT
    ct.command_name,
    'development',
    NULL,
    'disabled',
    jsonb_build_object('seeded', true, 'requires_activation', true)
FROM command_templates ct
WHERE ct.command_name IN (
        'reservation.mass_cancel',
        'reservation.mass_check_in',
        'reservation.mass_update'
      )
  AND NOT EXISTS (
        SELECT 1 FROM command_features cf
        WHERE cf.command_name = ct.command_name
          AND cf.environment = 'development'
          AND cf.tenant_id IS NULL
      );

COMMIT;
