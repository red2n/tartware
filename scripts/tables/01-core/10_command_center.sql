-- =====================================================
-- 10_command_center.sql
-- Command Center catalog + routing tables
-- Enables centralized command ingestion and routing to downstream services
-- Date: 2025-12-19
-- Notes: Backed by Kafka via transactional outbox dispatcher
-- =====================================================

\c tartware \echo 'Creating command center catalog tables...'

CREATE TABLE IF NOT EXISTS command_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                  -- Unique template identifier
    command_name VARCHAR(150) NOT NULL UNIQUE,                       -- Dot-notation command key (reservation.create)
    version VARCHAR(20) NOT NULL DEFAULT '1.0',                      -- Semantic version of command schema
    description TEXT,                                                -- Human-readable command description
    default_target_service VARCHAR(150) NOT NULL,                    -- Service handling this command by default
    default_topic VARCHAR(150) NOT NULL DEFAULT 'commands.primary',  -- Kafka topic for command routing
    required_modules TEXT[] NOT NULL DEFAULT ARRAY[]::text[],        -- Licensed modules required to use command
    payload_schema JSONB NOT NULL DEFAULT '{}'::jsonb,               -- JSON Schema for payload validation
    sample_payload JSONB NOT NULL DEFAULT '{}'::jsonb,               -- Example payload for docs/testing
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                     -- Arbitrary extension metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                   -- Row creation timestamp
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                    -- Row last-update timestamp
);

COMMENT ON TABLE command_templates IS 'Canonical catalog of Commands (schema, owner, default routing)';
COMMENT ON COLUMN command_templates.command_name IS 'Unique dot-notation command identifier (e.g., reservation.create)';
COMMENT ON COLUMN command_templates.version IS 'Semantic version of the command schema';
COMMENT ON COLUMN command_templates.default_target_service IS 'Service that handles this command by default';
COMMENT ON COLUMN command_templates.default_topic IS 'Kafka topic for command routing';
COMMENT ON COLUMN command_templates.required_modules IS 'Modules that must be licensed to use this command';
COMMENT ON COLUMN command_templates.payload_schema IS 'JSON Schema for command payload validation';
COMMENT ON COLUMN command_templates.sample_payload IS 'Example payload for documentation/testing';

CREATE TABLE IF NOT EXISTS command_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                                                    -- Unique route identifier
    command_name VARCHAR(150) NOT NULL REFERENCES command_templates (command_name) ON DELETE CASCADE,  -- Command being routed
    environment VARCHAR(50) NOT NULL DEFAULT 'development',                                           -- Target environment (dev/staging/prod)
    tenant_id UUID,                                                                                   -- NULL = default; set for tenant override
    service_id VARCHAR(150) NOT NULL,                                                                 -- Target service for this route
    topic VARCHAR(150) NOT NULL DEFAULT 'commands.primary',                                           -- Kafka topic override
    weight INTEGER NOT NULL DEFAULT 100 CHECK (weight > 0 AND weight <= 100),                         -- Routing weight for load balancing (1-100)
    status command_route_status NOT NULL DEFAULT 'active',                                            -- Route status (active/disabled/shadow)
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                                                      -- Arbitrary extension metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                                    -- Row creation timestamp
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                                                     -- Row last-update timestamp
);

CREATE INDEX IF NOT EXISTS idx_command_routes_lookup
    ON command_routes (command_name, environment, tenant_id);

COMMENT ON TABLE command_routes IS 'Environment and tenant-specific command routing overrides. Allows routing same command to different services per environment/tenant.';
COMMENT ON COLUMN command_routes.environment IS 'Target environment (development, staging, production)';
COMMENT ON COLUMN command_routes.tenant_id IS 'NULL for default routes; set for tenant-specific overrides';
COMMENT ON COLUMN command_routes.service_id IS 'Target service identifier for this route';
COMMENT ON COLUMN command_routes.topic IS 'Kafka topic override for this route';
COMMENT ON COLUMN command_routes.weight IS 'Routing weight for load balancing (1-100)';
COMMENT ON COLUMN command_routes.status IS 'Route status: active, disabled, shadow';

CREATE TABLE IF NOT EXISTS command_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),                                                    -- Unique feature-flag identifier
    command_name VARCHAR(150) NOT NULL REFERENCES command_templates (command_name) ON DELETE CASCADE,  -- Command being configured
    environment VARCHAR(50) NOT NULL DEFAULT 'development',                                           -- Target environment (dev/staging/prod)
    tenant_id UUID,                                                                                   -- NULL = default; set for tenant override
    status command_feature_status NOT NULL DEFAULT 'enabled',                                         -- Feature status (enabled/disabled/beta/deprecated)
    max_per_minute INTEGER,                                                                           -- Rate limit per minute (NULL = unlimited)
    burst INTEGER,                                                                                    -- Burst allowance above rate limit
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                                                      -- Arbitrary extension metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                                    -- Row creation timestamp
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                                                     -- Row last-update timestamp
);

CREATE INDEX IF NOT EXISTS idx_command_features_lookup
    ON command_features (command_name, environment, tenant_id);

COMMENT ON TABLE command_features IS 'Feature flags and rate limiting configuration per command/environment/tenant. Controls command availability and throttling.';
COMMENT ON COLUMN command_features.status IS 'Feature status: enabled, disabled, beta, deprecated';
COMMENT ON COLUMN command_features.max_per_minute IS 'Rate limit: max commands per minute (NULL = unlimited)';
COMMENT ON COLUMN command_features.burst IS 'Burst allowance above rate limit for short spikes';

CREATE TABLE IF NOT EXISTS command_dispatches (
    id UUID PRIMARY KEY,                                                                              -- Client-provided ID for idempotency
    command_name VARCHAR(150) NOT NULL REFERENCES command_templates (command_name) ON DELETE CASCADE,  -- Dispatched command name
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,                                -- Owning tenant
    target_service VARCHAR(150) NOT NULL,                                                             -- Resolved target service
    target_topic VARCHAR(150) NOT NULL,                                                               -- Resolved Kafka topic
    correlation_id VARCHAR(120),                                                                      -- Distributed tracing correlation ID
    request_id VARCHAR(120) NOT NULL,                                                                 -- Client request ID for deduplication
    status command_dispatch_status NOT NULL DEFAULT 'ACCEPTED',                                       -- Dispatch lifecycle status
    payload_hash VARCHAR(130) NOT NULL,                                                               -- SHA-256 hash for payload integrity
    outbox_event_id UUID NOT NULL REFERENCES transactional_outbox (event_id) ON DELETE CASCADE,       -- Linked outbox event for Kafka delivery
    routing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                                              -- Routing decision context
    initiated_by JSONB,                                                                               -- Actor who initiated the command
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                                     -- Command issuance timestamp
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,                                                      -- Arbitrary extension metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),                                                    -- Row creation timestamp
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()                                                     -- Row last-update timestamp
);

CREATE INDEX IF NOT EXISTS idx_command_dispatches_tenant
    ON command_dispatches (tenant_id, command_name);

CREATE INDEX IF NOT EXISTS idx_command_dispatches_status
    ON command_dispatches (status, issued_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_command_dispatches_request_dedupe
    ON command_dispatches (tenant_id, command_name, request_id);

COMMENT ON TABLE command_dispatches IS 'Audit log of all dispatched commands. Tracks command lifecycle from acceptance through execution. Used for idempotency, debugging, and compliance.';
COMMENT ON COLUMN command_dispatches.id IS 'Command dispatch ID (client-provided for idempotency)';
COMMENT ON COLUMN command_dispatches.correlation_id IS 'Correlation ID for distributed tracing across services';
COMMENT ON COLUMN command_dispatches.request_id IS 'Client request ID for deduplication within tenant/command';
COMMENT ON COLUMN command_dispatches.status IS 'Dispatch status: ACCEPTED, DISPATCHED, DELIVERED, PROCESSED, FAILED, REJECTED';
COMMENT ON COLUMN command_dispatches.payload_hash IS 'SHA-256 hash of payload for integrity verification';
COMMENT ON COLUMN command_dispatches.outbox_event_id IS 'Reference to transactional outbox event for Kafka delivery';
COMMENT ON COLUMN command_dispatches.routing_metadata IS 'Routing decision context (resolved route, topic, partition)';
COMMENT ON COLUMN command_dispatches.initiated_by IS 'Actor who initiated the command (user_id, service, system)';

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
        ('reservation.no_show', 'Mark a reservation as no-show and apply fee', 'reservations-command-service', ARRAY['core']),
        ('reservation.batch_no_show', 'Sweep all overdue reservations as no-show for a property', 'reservations-command-service', ARRAY['core']),
        ('reservation.walkin_checkin', 'Walk-in guest express check-in', 'reservations-command-service', ARRAY['core']),
        ('reservation.waitlist_add', 'Add guest to room type waitlist', 'reservations-command-service', ARRAY['core']),
        ('reservation.waitlist_convert', 'Convert waitlist entry to reservation', 'reservations-command-service', ARRAY['core']),
        ('reservation.send_quote', 'Send a quote for an inquiry reservation', 'reservations-command-service', ARRAY['core']),
        ('reservation.convert_quote', 'Convert a quoted reservation to a pending booking', 'reservations-command-service', ARRAY['core']),
        ('reservation.expire', 'Expire an inquiry, quoted, or pending reservation', 'reservations-command-service', ARRAY['core']),
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
        ('billing.folio.close', 'Close/settle a folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.payment.authorize', 'Pre-authorize a payment hold on a guest card', 'billing-service', ARRAY['finance-automation']),
        ('billing.payment.void', 'Void an authorized payment', 'billing-service', ARRAY['finance-automation']),
        ('billing.night_audit.execute', 'Execute nightly audit: post room charges, mark no-shows, advance business date', 'billing-service', ARRAY['finance-automation']),
        ('billing.charge.void', 'Void a charge posting and create reversal entry', 'billing-service', ARRAY['finance-automation']),
        ('billing.invoice.finalize', 'Finalize an invoice, locking it from edits', 'billing-service', ARRAY['finance-automation']),
        ('settings.value.set', 'Set a configuration value', 'settings-service', ARRAY['core']),
        ('settings.value.bulk_set', 'Bulk set configuration values', 'settings-service', ARRAY['core']),
        ('settings.value.approve', 'Approve a pending setting value', 'settings-service', ARRAY['core']),
        ('settings.value.revert', 'Revert a setting value', 'settings-service', ARRAY['core']),
        ('integration.ota.sync_request', 'Request an OTA sync', 'reservations-command-service', ARRAY['marketing-channel']),
        ('integration.ota.rate_push', 'Push OTA rates', 'reservations-command-service', ARRAY['marketing-channel']),
        ('integration.webhook.retry', 'Retry a webhook delivery', 'reservations-command-service', ARRAY['marketing-channel']),
        ('integration.mapping.update', 'Update integration mapping', 'reservations-command-service', ARRAY['marketing-channel']),
        ('analytics.metric.ingest', 'Ingest analytics metric', 'analytics-command-service', ARRAY['analytics-bi']),
        ('analytics.report.schedule', 'Schedule analytics report', 'analytics-command-service', ARRAY['analytics-bi']),
        ('operations.maintenance.request', 'Create maintenance request', 'operations-command-service', ARRAY['facility-maintenance']),
        ('operations.incident.report', 'Report an incident', 'operations-command-service', ARRAY['facility-maintenance']),
        ('operations.asset.update', 'Update asset status or location', 'operations-command-service', ARRAY['facility-maintenance']),
        ('operations.inventory.adjust', 'Adjust inventory levels', 'operations-command-service', ARRAY['facility-maintenance']),
        ('reservation.waitlist_offer', 'Offer a freed room to a waitlisted guest', 'reservations-command-service', ARRAY['core']),
        ('reservation.waitlist_expire_sweep', 'Sweep and expire stale waitlist offers', 'reservations-command-service', ARRAY['core']),
        ('reservation.walk_guest', 'Walk a guest to an alternate property or compensation', 'reservations-command-service', ARRAY['core']),
        ('notification.send', 'Send a templated notification to a guest', 'notification-service', ARRAY['core']),
        ('notification.template.create', 'Create a new communication template', 'notification-service', ARRAY['core']),
        ('notification.template.update', 'Update an existing communication template', 'notification-service', ARRAY['core']),
        ('notification.template.delete', 'Delete a communication template', 'notification-service', ARRAY['core']),
        ('notification.automated.create', 'Create an automated message rule', 'notification-service', ARRAY['core']),
        ('notification.automated.update', 'Update an automated message rule', 'notification-service', ARRAY['core']),
        ('notification.automated.delete', 'Delete an automated message rule', 'notification-service', ARRAY['core']),
        ('billing.cashier.open', 'Open a new cashier/till session', 'billing-service', ARRAY['finance-automation']),
        ('billing.cashier.close', 'Close and reconcile a cashier session', 'billing-service', ARRAY['finance-automation']),
        ('operations.schedule.create', 'Create a staff schedule entry', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('operations.schedule.update', 'Update an existing staff schedule entry', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('compliance.breach.report', 'Report a data breach incident', 'core-service', ARRAY['core']),
        ('compliance.breach.notify', 'Notify authority/subjects of a data breach', 'core-service', ARRAY['core']),
        ('loyalty.points.earn', 'Earn loyalty points for a guest', 'guests-service', ARRAY['loyalty']),
        ('loyalty.points.redeem', 'Redeem loyalty points for a guest', 'guests-service', ARRAY['loyalty'])
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
