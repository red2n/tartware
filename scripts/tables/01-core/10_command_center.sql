-- =====================================================
-- 10_command_center.sql
-- Command Center catalog + routing tables
-- Enables centralized command ingestion and routing to downstream services
-- Date: 2025-12-19
-- Notes: Backed by Kafka via transactional outbox dispatcher
-- =====================================================

\c tartware \echo 'Creating command center catalog tables...'

CREATE TABLE IF NOT EXISTS command_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command_name VARCHAR(150) NOT NULL UNIQUE,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    description TEXT,
    default_target_service VARCHAR(150) NOT NULL,
    default_topic VARCHAR(150) NOT NULL DEFAULT 'commands.primary',
    required_modules TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    payload_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    sample_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE command_templates IS 'Canonical catalog of Commands (schema, owner, default routing)';

CREATE TABLE IF NOT EXISTS command_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command_name VARCHAR(150) NOT NULL REFERENCES command_templates (command_name) ON DELETE CASCADE,
    environment VARCHAR(50) NOT NULL DEFAULT 'development',
    tenant_id UUID,
    service_id VARCHAR(150) NOT NULL,
    topic VARCHAR(150) NOT NULL DEFAULT 'commands.primary',
    weight INTEGER NOT NULL DEFAULT 100 CHECK (weight > 0 AND weight <= 100),
    status command_route_status NOT NULL DEFAULT 'active',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_command_routes_lookup
    ON command_routes (command_name, environment, tenant_id);

CREATE TABLE IF NOT EXISTS command_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    command_name VARCHAR(150) NOT NULL REFERENCES command_templates (command_name) ON DELETE CASCADE,
    environment VARCHAR(50) NOT NULL DEFAULT 'development',
    tenant_id UUID,
    status command_feature_status NOT NULL DEFAULT 'enabled',
    max_per_minute INTEGER,
    burst INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_command_features_lookup
    ON command_features (command_name, environment, tenant_id);

CREATE TABLE IF NOT EXISTS command_dispatches (
    id UUID PRIMARY KEY,
    command_name VARCHAR(150) NOT NULL REFERENCES command_templates (command_name) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    target_service VARCHAR(150) NOT NULL,
    target_topic VARCHAR(150) NOT NULL,
    correlation_id VARCHAR(120),
    request_id VARCHAR(120) NOT NULL,
    status command_dispatch_status NOT NULL DEFAULT 'ACCEPTED',
    payload_hash VARCHAR(130) NOT NULL,
    outbox_event_id UUID NOT NULL REFERENCES transactional_outbox (event_id) ON DELETE CASCADE,
    routing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    initiated_by JSONB,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_command_dispatches_tenant
    ON command_dispatches (tenant_id, command_name);

CREATE INDEX IF NOT EXISTS idx_command_dispatches_status
    ON command_dispatches (status, issued_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_command_dispatches_request_dedupe
    ON command_dispatches (tenant_id, command_name, request_id);

WITH seed_commands(command_name, description, default_target_service, required_modules) AS (
    VALUES
        ('reservation.create', 'Create reservations asynchronously', 'reservations-command-service', ARRAY['core']),
        ('reservation.modify', 'Modify existing reservations', 'reservations-command-service', ARRAY['core']),
        ('reservation.cancel', 'Cancel a reservation', 'reservations-command-service', ARRAY['core']),
        ('reservation.check_in', 'Check in a reservation', 'reservations-command-service', ARRAY['core']),
        ('reservation.check_out', 'Check out a reservation', 'reservations-command-service', ARRAY['core']),
        ('reservation.assign_room', 'Assign a room to a reservation', 'reservations-command-service', ARRAY['core']),
        ('reservation.unassign_room', 'Unassign a room from a reservation', 'reservations-command-service', ARRAY['core']),
        ('reservation.extend_stay', 'Extend an existing stay', 'reservations-command-service', ARRAY['core']),
        ('reservation.rate_override', 'Override reservation rates', 'reservations-command-service', ARRAY['core']),
        ('reservation.add_deposit', 'Add a reservation deposit', 'reservations-command-service', ARRAY['core']),
        ('reservation.release_deposit', 'Release a reservation deposit', 'reservations-command-service', ARRAY['core']),
        ('guest.register', 'Create or import guest profiles', 'guests-service', ARRAY['core']),
        ('guest.merge', 'Merge duplicate guest profiles', 'guests-service', ARRAY['core']),
        ('guest.update_profile', 'Update guest profile details', 'guests-service', ARRAY['core']),
        ('guest.update_contact', 'Update guest contact details', 'guests-service', ARRAY['core']),
        ('guest.set_loyalty', 'Update guest loyalty tier or points', 'guests-service', ARRAY['core']),
        ('guest.set_vip', 'Update guest VIP status', 'guests-service', ARRAY['core']),
        ('guest.set_blacklist', 'Update guest blacklist status', 'guests-service', ARRAY['core']),
        ('guest.gdpr.erase', 'Erase guest data for GDPR requests', 'guests-service', ARRAY['core']),
        ('guest.preference.update', 'Update guest preferences', 'guests-service', ARRAY['core']),
        ('rooms.inventory.block', 'Block rooms for maintenance', 'rooms-service', ARRAY['core']),
        ('rooms.inventory.release', 'Release a room block', 'rooms-service', ARRAY['core']),
        ('rooms.status.update', 'Update room status', 'rooms-service', ARRAY['core']),
        ('rooms.housekeeping_status.update', 'Update room housekeeping status', 'rooms-service', ARRAY['core']),
        ('rooms.out_of_order', 'Mark a room out of order', 'rooms-service', ARRAY['core']),
        ('rooms.out_of_service', 'Mark a room out of service', 'rooms-service', ARRAY['core']),
        ('rooms.move', 'Move a guest between rooms', 'rooms-service', ARRAY['core']),
        ('rooms.features.update', 'Update room features and amenities', 'rooms-service', ARRAY['core']),
        ('housekeeping.task.assign', 'Assign housekeeping task', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('housekeeping.task.complete', 'Complete housekeeping task workflow', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('housekeeping.task.create', 'Create housekeeping task', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('housekeeping.task.reassign', 'Reassign housekeeping task', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('housekeeping.task.reopen', 'Reopen housekeeping task', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('housekeeping.task.add_note', 'Add housekeeping task note', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('housekeeping.task.bulk_status', 'Bulk update housekeeping task status', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('billing.payment.capture', 'Capture payment for outstanding folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.payment.refund', 'Issue a refund for a transaction', 'billing-service', ARRAY['finance-automation']),
        ('billing.invoice.create', 'Create an invoice', 'billing-service', ARRAY['finance-automation']),
        ('billing.invoice.adjust', 'Adjust an invoice amount', 'billing-service', ARRAY['finance-automation']),
        ('billing.charge.post', 'Post a charge to a folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.payment.apply', 'Apply a payment to an invoice or reservation', 'billing-service', ARRAY['finance-automation']),
        ('billing.folio.transfer', 'Transfer a folio balance between reservations', 'billing-service', ARRAY['finance-automation']),
        ('settings.value.set', 'Set a configuration value', 'settings-service', ARRAY['core']),
        ('settings.value.bulk_set', 'Bulk set configuration values', 'settings-service', ARRAY['core']),
        ('settings.value.approve', 'Approve a pending setting value', 'settings-service', ARRAY['core']),
        ('settings.value.revert', 'Revert a setting value', 'settings-service', ARRAY['core']),
        ('integration.ota.sync_request', 'Request an OTA sync', 'integrations-command-service', ARRAY['marketing-channel']),
        ('integration.ota.rate_push', 'Push OTA rates', 'integrations-command-service', ARRAY['marketing-channel']),
        ('integration.webhook.retry', 'Retry a webhook delivery', 'integrations-command-service', ARRAY['marketing-channel']),
        ('integration.mapping.update', 'Update integration mapping', 'integrations-command-service', ARRAY['marketing-channel']),
        ('analytics.metric.ingest', 'Ingest analytics metric', 'analytics-command-service', ARRAY['analytics-bi']),
        ('analytics.report.schedule', 'Schedule analytics report', 'analytics-command-service', ARRAY['analytics-bi']),
        ('operations.maintenance.request', 'Create maintenance request', 'operations-command-service', ARRAY['facility-maintenance']),
        ('operations.incident.report', 'Report an incident', 'operations-command-service', ARRAY['facility-maintenance']),
        ('operations.asset.update', 'Update asset status or location', 'operations-command-service', ARRAY['facility-maintenance']),
        ('operations.inventory.adjust', 'Adjust inventory levels', 'operations-command-service', ARRAY['facility-maintenance'])
)
INSERT INTO command_templates (command_name, description, default_target_service, required_modules, metadata)
SELECT
    sc.command_name,
    sc.description,
    sc.default_target_service,
    sc.required_modules,
    jsonb_build_object('seeded', true)
FROM seed_commands sc
ON CONFLICT (command_name) DO UPDATE
SET
    description = EXCLUDED.description,
    default_target_service = EXCLUDED.default_target_service,
    required_modules = EXCLUDED.required_modules,
    metadata = command_templates.metadata || jsonb_build_object('seeded', true);

INSERT INTO command_routes (command_name, environment, tenant_id, service_id, topic, metadata)
SELECT
    ct.command_name,
    'development',
    NULL,
    ct.default_target_service,
    ct.default_topic,
    jsonb_build_object('seeded', true)
FROM command_templates ct
WHERE NOT EXISTS (
    SELECT 1
    FROM command_routes cr
    WHERE cr.command_name = ct.command_name
      AND cr.environment = 'development'
      AND cr.tenant_id IS NULL
);

INSERT INTO command_features (command_name, environment, tenant_id, status, metadata)
SELECT
    ct.command_name,
    'development',
    NULL,
    'enabled',
    jsonb_build_object('seeded', true)
FROM command_templates ct
WHERE NOT EXISTS (
    SELECT 1
    FROM command_features cf
    WHERE cf.command_name = ct.command_name
      AND cf.environment = 'development'
      AND cf.tenant_id IS NULL
);

\echo 'Command center catalog ready.'
