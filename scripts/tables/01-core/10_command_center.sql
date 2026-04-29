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
    tenant_id UUID NOT NULL DEFAULT '11111111-1111-1111-1111-111111111111', -- Owning tenant (default: seed tenant)
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
COMMENT ON COLUMN command_templates.tenant_id IS 'Owning tenant; defaults to seed tenant for system-level command definitions';

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
        ('billing.invoice.create', 'Create an invoice', 'accounts-service', ARRAY['finance-automation']),
        ('billing.invoice.adjust', 'Adjust an invoice amount', 'accounts-service', ARRAY['finance-automation']),
        ('billing.charge.post', 'Post a charge to a folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.payment.apply', 'Apply a payment to an invoice or reservation', 'billing-service', ARRAY['finance-automation']),
        ('billing.folio.transfer', 'Transfer a folio balance between reservations', 'billing-service', ARRAY['finance-automation']),
        ('billing.folio.close', 'Close/settle a folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.payment.authorize', 'Pre-authorize a payment hold on a guest card', 'billing-service', ARRAY['finance-automation']),
        ('billing.payment.void', 'Void an authorized payment', 'billing-service', ARRAY['finance-automation']),
        ('billing.night_audit.execute', 'Execute nightly audit: post room charges, mark no-shows, advance business date', 'billing-service', ARRAY['finance-automation']),
        ('billing.ledger.post', 'Rebuild the general ledger batch for a property business date from billing source tables', 'billing-service', ARRAY['finance-automation']),
        ('billing.gl_batch.export', 'Mark a GL batch as exported and record the export destination for ERP integration', 'billing-service', ARRAY['finance-automation']),
        ('billing.charge.void', 'Void a charge posting and create reversal entry', 'billing-service', ARRAY['finance-automation']),
        ('billing.invoice.finalize', 'Finalize an invoice, locking it from edits', 'accounts-service', ARRAY['finance-automation']),
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
        ('billing.date_roll.manual', 'Manually advance the business date without running full night audit', 'billing-service', ARRAY['finance-automation']),
        ('billing.ar.post', 'Post an outstanding folio balance to accounts receivable', 'accounts-service', ARRAY['finance-automation']),
        ('billing.ar.apply_payment', 'Apply a payment against an accounts receivable balance', 'accounts-service', ARRAY['finance-automation']),
        ('billing.ar.age', 'Recalculate aging buckets for accounts receivable entries', 'accounts-service', ARRAY['finance-automation']),
        ('billing.ar.write_off', 'Write off an uncollectible accounts receivable entry', 'accounts-service', ARRAY['finance-automation']),
        ('billing.tax_config.create', 'Create a new tax configuration entry', 'finance-admin-service', ARRAY['finance-automation']),
        ('billing.tax_config.update', 'Update an existing tax configuration entry', 'finance-admin-service', ARRAY['finance-automation']),
        ('billing.tax_config.delete', 'Soft-delete a tax configuration entry', 'finance-admin-service', ARRAY['finance-automation']),
        ('billing.express_checkout', 'Auto-settle zero-balance folios for express guest checkout', 'billing-service', ARRAY['finance-automation']),
        ('billing.cashier.handover', 'Close outgoing cashier session and open incoming session atomically', 'billing-service', ARRAY['finance-automation']),
        ('billing.folio.split', 'Split charges from a folio into a new folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.charge.transfer', 'Transfer a charge between folios', 'billing-service', ARRAY['finance-automation']),
        ('billing.chargeback.record', 'Record a processor-initiated chargeback', 'billing-service', ARRAY['finance-automation']),
        ('billing.payment.authorize_increment', 'Increment an existing payment authorization hold', 'billing-service', ARRAY['finance-automation']),
        ('billing.pricing.evaluate', 'Evaluate dynamic pricing rules for a room type', 'finance-admin-service', ARRAY['finance-automation']),
        ('billing.pricing.bulk_recommend', 'Bulk generate pricing recommendations', 'finance-admin-service', ARRAY['finance-automation']),
        ('billing.fiscal_period.close', 'Close a fiscal period to prevent new postings', 'finance-admin-service', ARRAY['finance-automation']),
        ('billing.fiscal_period.lock', 'Lock a closed fiscal period against all changes', 'finance-admin-service', ARRAY['finance-automation']),
        ('billing.fiscal_period.reopen', 'Reopen a closed fiscal period for adjustments', 'finance-admin-service', ARRAY['finance-automation']),
        ('billing.folio_window.create', 'Create a date-based folio window for split billing', 'billing-service', ARRAY['finance-automation']),
        ('billing.folio.create', 'Create a standalone folio (house account, city ledger, walk-in)', 'billing-service', ARRAY['finance-automation']),
        ('billing.invoice.void', 'Void a DRAFT invoice that was never issued', 'billing-service', ARRAY['finance-automation']),
        ('billing.credit_note.create', 'Create a credit note against a finalized/issued invoice', 'billing-service', ARRAY['finance-automation']),
        ('billing.invoice.reopen', 'Reopen a finalized invoice as a draft correction at a new revision', 'billing-service', ARRAY['finance-automation']),
        ('billing.folio.reopen', 'Reopen a settled/closed folio for further postings', 'billing-service', ARRAY['finance-automation']),
        ('billing.folio.merge', 'Merge a source folio''s postings into a target folio then close the source', 'billing-service', ARRAY['finance-automation']),
        ('billing.chargeback.update_status', 'Advance a chargeback through its RECEIVED→EVIDENCE_SUBMITTED→WON|LOST state machine', 'billing-service', ARRAY['finance-automation']),
        ('billing.no_show.charge', 'Post a no-show penalty charge to the reservation folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.late_checkout.charge', 'Post a tier-based late checkout fee to the reservation folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.tax_exemption.apply', 'Apply a tax exemption certificate to an open folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.cancellation.penalty', 'Post a cancellation penalty per rate plan policy to the reservation folio', 'billing-service', ARRAY['finance-automation']),
        ('billing.comp.post', 'Post a complimentary charge credit to a folio with budget tracking in comp_transactions', 'billing-service', ARRAY['finance-automation']),
        ('billing.routing_rule.create', 'Create a folio routing rule (template or active)', 'billing-service', ARRAY['finance-automation']),
        ('billing.routing_rule.update', 'Update a folio routing rule criteria, priority, or routing type', 'billing-service', ARRAY['finance-automation']),
        ('billing.routing_rule.delete', 'Soft-delete a folio routing rule', 'billing-service', ARRAY['finance-automation']),
        ('billing.routing_rule.clone_template', 'Clone a routing rule template into active rules for a specific folio pair', 'billing-service', ARRAY['finance-automation']),
        ('commission.calculate', 'Calculate and record commission for a reservation', 'finance-admin-service', ARRAY['finance-automation']),
        ('commission.approve', 'Approve a pending commission for payout', 'finance-admin-service', ARRAY['finance-automation']),
        ('commission.mark_paid', 'Mark a commission as paid out', 'finance-admin-service', ARRAY['finance-automation']),
        ('commission.statement.generate', 'Generate a commission statement for an agent or period', 'finance-admin-service', ARRAY['finance-automation']),
        ('operations.schedule.create', 'Create a staff schedule entry', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('operations.schedule.update', 'Update an existing staff schedule entry', 'housekeeping-service', ARRAY['facility-maintenance']),
        ('compliance.breach.report', 'Report a data breach incident', 'core-service', ARRAY['core']),
        ('compliance.breach.notify', 'Notify authority/subjects of a data breach', 'core-service', ARRAY['core']),
        ('loyalty.points.earn', 'Earn loyalty points for a guest', 'guests-service', ARRAY['loyalty']),
        ('loyalty.points.redeem', 'Redeem loyalty points for a guest', 'guests-service', ARRAY['loyalty']),
        ('loyalty.points.expire_sweep', 'Sweep and expire stale loyalty points', 'guests-service', ARRAY['loyalty']),
        ('metasearch.config.create', 'Create a metasearch platform configuration', 'reservations-command-service', ARRAY['distribution']),
        ('metasearch.config.update', 'Update a metasearch platform configuration', 'reservations-command-service', ARRAY['distribution']),
        ('metasearch.click.record', 'Record a click from a metasearch platform', 'reservations-command-service', ARRAY['distribution']),
        ('group.create', 'Create a new group booking with initial block request', 'reservations-command-service', ARRAY['core']),
        ('group.add_rooms', 'Add room block allocations to a group booking', 'reservations-command-service', ARRAY['core']),
        ('group.upload_rooming_list', 'Upload rooming list for a group booking', 'reservations-command-service', ARRAY['core']),
        ('group.cutoff_enforce', 'Enforce cutoff date for a group block', 'reservations-command-service', ARRAY['core']),
        ('group.billing.setup', 'Configure billing for a group booking', 'reservations-command-service', ARRAY['core']),
        ('group.check_in', 'Batch check-in group reservations with proximity-based room assignment', 'reservations-command-service', ARRAY['core']),
        ('revenue.forecast.compute', 'Compute revenue forecasts for a property', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.pricing_rule.create', 'Create a new pricing rule', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.pricing_rule.update', 'Update an existing pricing rule', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.pricing_rule.activate', 'Activate a pricing rule', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.pricing_rule.deactivate', 'Deactivate a pricing rule', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.pricing_rule.delete', 'Soft-delete a pricing rule', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.demand.update', 'Update demand level for specific dates', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.demand.import_events', 'Bulk import local events into demand calendar', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.competitor.record', 'Record a competitor rate observation', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.competitor.bulk_import', 'Bulk import competitor rates', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.competitor.configure_compset', 'Define or update the competitive set for a property', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.competitor.auto_collect', 'Trigger automated rate shopping collection from configured providers', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.competitive_response.configure', 'Create or update a competitive response pricing rule', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.restriction.set', 'Set inventory restriction per room type × rate plan × date range', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.restriction.remove', 'Remove a restriction for room type × rate plan × date range', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.restriction.bulk_set', 'Bulk set restrictions across multiple date ranges', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.hurdle_rate.set', 'Set minimum acceptable hurdle rate per room type × date', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.hurdle_rate.calculate', 'Auto-calculate hurdle rates from displacement analysis', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.goal.create', 'Create a revenue goal or budget target', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.goal.update', 'Update a revenue goal or budget target', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.goal.delete', 'Soft-delete a revenue goal', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.goal.track_actual', 'Snapshot actual performance against revenue goals', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.daily_close.process', 'End-of-day revenue processing triggered after night audit', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.booking_pace.snapshot', 'Snapshot booking pace data into demand calendar', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.forecast.adjust', 'Manually adjust a forecast with override values', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.forecast.evaluate', 'Evaluate forecast accuracy against actuals', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.group.evaluate', 'Evaluate group block displacement with ancillary and denied demand analysis', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.recommendation.generate', 'Batch-generate rate recommendations for a property date range', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.recommendation.approve', 'Approve a rate recommendation', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.recommendation.reject', 'Reject a rate recommendation with reason', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.recommendation.apply', 'Apply an accepted recommendation to live rates', 'revenue-service', ARRAY['revenue-management']),
        ('revenue.recommendation.bulk_approve', 'Bulk-approve multiple rate recommendations', 'revenue-service', ARRAY['revenue-management'])
)
INSERT INTO command_templates (command_name, description, default_target_service, required_modules, metadata)
SELECT
    sc.command_name,
    sc.description,
    sc.default_target_service,
    sc.required_modules,
    jsonb_build_object('seeded', true)
FROM seed_commands sc
ON CONFLICT (command_name) DO NOTHING;

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
    'disabled',
    jsonb_build_object('seeded', true, 'requires_activation', true)
FROM command_templates ct
WHERE NOT EXISTS (
    SELECT 1
    FROM command_features cf
    WHERE cf.command_name = ct.command_name
      AND cf.environment = 'development'
      AND cf.tenant_id IS NULL
);

-- ── Per-table autovacuum tuning ─────────────────────────────────────────────
-- command_dispatches accumulates one row per command at 20K ops/sec;
-- aggressive autovacuum prevents bloat from completed/failed rows.
ALTER TABLE command_dispatches SET (
    autovacuum_vacuum_scale_factor     = 0.01,
    autovacuum_vacuum_cost_delay       = 0,
    autovacuum_analyze_scale_factor    = 0.005
);

\echo 'Command center catalog ready.'
