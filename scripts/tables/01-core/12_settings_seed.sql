-- =====================================================
-- settings_seed.sql
-- Seed setting categories and definitions
-- =====================================================

\c tartware \echo 'Seeding setting categories and definitions...'

-- Seed setting categories from TODO.md sections 5-12
-- =====================================================
INSERT INTO
    setting_categories (
        category_key,
        display_name,
        description,
        documentation
    )
VALUES (
        'APPROVAL_WORKFLOW',
        'Approval Workflow Settings',
        'Workflow orchestration for financial and operational approvals with auditability.',
        $$Consolidated processes for rate, operational, and escalation approvals (TODO.md §5).$$
    ),
    (
        'INTEGRATION_CHANNEL',
        'Integration and Channel Management Settings',
        'Connectivity, API, and OTA configuration controls.',
        $$Merged OTA, channel manager, and third-party integration settings (TODO.md §6).$$
    ),
    (
        'BOOKING_GUEST',
        'Booking Engine and Guest Management Settings',
        'Direct booking flows, loyalty, and guest profile controls.',
        $$Online booking, personalization, and loyalty program settings (TODO.md §7).$$
    ),
    (
        'OPERATIONS',
        'Housekeeping, Maintenance, and Operations Settings',
        'Operational task automation, real-time statuses, and maintenance governance.',
        $$Integrated housekeeping, maintenance, and operations configuration (TODO.md §8).$$
    ),
    (
        'REPORTING_ANALYTICS',
        'Reporting, Analytics, and Night Audit Settings',
        'Dashboards, scheduled reports, and nightly close procedures.',
        $$Reporting, analytics dashboards, and night audit controls (TODO.md §9).$$
    ),
    (
        'COMMUNICATION_NOTIFICATION',
        'Communication and Notification Settings',
        'Messaging channels, preferences, and system alert routing.',
        $$Guest communications, opt-in preferences, and operational alerting (TODO.md §10).$$
    ),
    (
        'SECURITY_COMPLIANCE',
        'Security, Compliance, and Backup Settings',
        'Authentication, access controls, regulatory, and recovery policies.',
        $$Security hardening, compliance tooling, and business continuity settings (TODO.md §11).$$
    ),
    (
        'UI_LOCALIZATION',
        'UI, Localization, and Custom Settings',
        'Interface personalization, internationalization, and custom fields.',
        $$UI customization, multilingual support, and extensibility controls (TODO.md §12).$$
    )
ON CONFLICT (category_key) DO
UPDATE
SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    documentation = EXCLUDED.documentation,
    updated_at = CURRENT_TIMESTAMP;

-- =====================================================
-- Seed setting definitions for sections 5-12
-- =====================================================
-- Section 5: Approval Workflow Settings
INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'approval.workflow_definition', 'Workflow Definition', 'Defines sequential/parallel approval chains with routing logic and thresholds.', 'TENANT', 'JSON', $$Sequential or parallel approval chains, conditional routing by department, and auto-approval thresholds (TODO.md §5).$$, ARRAY['approvals', 'workflow']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'APPROVAL_WORKFLOW'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'approval.rate_discount_thresholds', 'Rate and Discount Approvals', 'Controls discount variance, override thresholds, cancellations, and complimentary approvals.', 'PROPERTY', 'JSON', $$Variance thresholds for discounts, override approvals for sold-out scenarios, cancellations, refunds, and complimentary stay governance (TODO.md §5).$$, ARRAY['approvals', 'revenue']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'APPROVAL_WORKFLOW'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'approval.operational_controls', 'Operational Approvals', 'Approval routing for maintenance, purchasing, expenses, and emergency overrides.', 'PROPERTY', 'JSON', $$Work order, purchasing, expense, and budget variance approvals including emergency override logic (TODO.md §5).$$, ARRAY['approvals', 'operations']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'APPROVAL_WORKFLOW'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'approval.tracking_audit', 'Tracking and Audit', 'Audit trails, dashboards for pending requests, notifications, and escalation rules.', 'TENANT', 'JSON', $$Comprehensive approval tracking, SLA deadlines, escalation rules, and audit history (TODO.md §5).$$, ARRAY['approvals', 'audit']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'APPROVAL_WORKFLOW'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

-- Section 6: Integration and Channel Management Settings
INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'integration.ota_channel_manager', 'OTA / Channel Manager', 'Mappings, API keys, sync cadence, commissions, inventory allocation, and parity rules.', 'PROPERTY', 'JSON', $$Channel manager configuration including API credentials, rate and inventory mapping, sync frequency, commission structures, parity monitoring, and no-show reporting (TODO.md §6).$$, ARRAY['integration', 'distribution']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'INTEGRATION_CHANNEL'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'integration.api_third_party', 'API and Third-Party Integrations', 'Endpoint management, authentication, webhook orchestration, and partner app connectivity.', 'TENANT', 'JSON', $$External API endpoints, OAuth credentials, webhook retries, and partner integrations for accounting, CRM, RMS, POS, and housekeeping (TODO.md §6).$$, ARRAY['integration', 'api']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'INTEGRATION_CHANNEL'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'integration.channel_priority', 'Channel Priority', 'Channel ordering, auto-stop triggers, buffers, minimum rates, and blackout logic.', 'PROPERTY', 'JSON', $$Priority rules for OTA channels including buffers, blackout windows, minimum rates, and overbooking protections (TODO.md §6).$$, ARRAY['integration', 'revenue']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'INTEGRATION_CHANNEL'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

-- Section 7: Booking Engine and Guest Management Settings
INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'booking.booking_engine_display', 'Booking Engine Display', 'Branding, responsive widgets, languages, currency formats, and search parameters.', 'TENANT', 'JSON', $$Direct booking UI configuration including widgets, branding, localization, and search filters (TODO.md §7).$$, ARRAY['booking', 'ui']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'BOOKING_GUEST'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'booking.booking_flow_restrictions', 'Booking Flow and Restrictions', 'Checkout steps, required guest data, upsells, consent capture, and cutoff rules.', 'PROPERTY', 'JSON', $$Booking flow orchestration including upsells, GDPR consent prompts, same-day cutoffs, and age restrictions (TODO.md §7).$$, ARRAY['booking', 'compliance']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'BOOKING_GUEST'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'booking.loyalty_program', 'Loyalty Program', 'Tiering, earning rules, redemption policies, expirations, and partner benefits.', 'TENANT', 'JSON', $$Loyalty configuration spanning tier thresholds, point accrual and redemption, expirations, and partner integrations (TODO.md §7).$$, ARRAY['booking', 'loyalty']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'BOOKING_GUEST'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'booking.guest_history_tracking', 'Guest History and Tracking', 'Aggregates past stay data, preferences, sentiment, and feedback for personalization.', 'TENANT', 'JSON', $$Guest profile history including stays, spend, feedback, and sentiment analytics for personalization (TODO.md §7).$$, ARRAY['booking', 'guest']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'BOOKING_GUEST'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

-- Section 8: Housekeeping, Maintenance, and Operations Settings
INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'operations.housekeeping_tasks', 'Housekeeping Tasks', 'Auto-generated task rules, workflow states, assignments, and time standards.', 'PROPERTY', 'JSON', $$Housekeeping automation for task generation, prioritization, workflow stages, assignments, and reporting (TODO.md §8).$$, ARRAY['operations', 'housekeeping']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'OPERATIONS'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'operations.status_updates', 'Status Updates', 'Real-time unit status sync, inspections, and lost & found workflows.', 'ROOM', 'JSON', $$Unit-level status updates including inspections, readiness states, and lost and found tracking (TODO.md §8).$$, ARRAY['operations', 'status']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'OPERATIONS'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'operations.maintenance_configuration', 'Maintenance Configuration', 'Preventive schedules, work order types, approvals, and asset tracking controls.', 'PROPERTY', 'JSON', $$Maintenance program configuration covering preventive schedules, asset inventory, approvals, and cost tracking (TODO.md §8).$$, ARRAY['operations', 'maintenance']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'OPERATIONS'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

-- Section 9: Reporting, Analytics, and Night Audit Settings
INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'reporting.report_types', 'Report Types', 'Catalog of financial, occupancy, and custom analytics outputs with export options.', 'TENANT', 'JSON', $$Configuration of RevPAR/ADR, occupancy, forecasting, cancellation analytics, and custom report builders (TODO.md §9).$$, ARRAY['reporting', 'analytics']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'REPORTING_ANALYTICS'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'reporting.dashboard_customization', 'Dashboard Customization', 'Widget layouts, refresh cadence, role-based visibility, and drill-down configurations.', 'USER', 'JSON', $$Dashboard personalization including widget selection, refresh rates, role visibility, and drill-down behavior (TODO.md §9).$$, ARRAY['reporting', 'dashboard']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'REPORTING_ANALYTICS'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'reporting.report_scheduling', 'Report Scheduling', 'Automated report generation cadence, delivery channels, and retention.', 'TENANT', 'JSON', $$Automated reporting schedules, distribution lists, delivery channels, and retention policies (TODO.md §9).$$, ARRAY['reporting', 'automation']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'REPORTING_ANALYTICS'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'reporting.night_audit', 'Night Audit', 'Nightly rollover procedures, validation rules, and reporting packages.', 'PROPERTY', 'JSON', $$Night audit controls detailing timing, validations, postings, and required reports (TODO.md §9).$$, ARRAY['reporting', 'night_audit']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'REPORTING_ANALYTICS'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

-- Section 10: Communication and Notification Settings
INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'communication.channels_workflows', 'Channels and Workflows', 'Template libraries, automation triggers, personalization tokens, and localization.', 'TENANT', 'JSON', $$Cross-channel messaging templates, automation triggers, personalization tokens, and localization coverage (TODO.md §10).$$, ARRAY['communication', 'automation']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'COMMUNICATION_NOTIFICATION'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'communication.preferences', 'Preferences', 'Opt-in management, frequency controls, and GDPR-compliant consent tracking.', 'TENANT', 'JSON', $$Guest communication preferences including opt-ins, frequency caps, and GDPR compliance controls (TODO.md §10).$$, ARRAY['communication', 'compliance']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'COMMUNICATION_NOTIFICATION'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'communication.system_alerts', 'System Alerts', 'Operational alert routing, thresholds, escalation paths, and delivery channels.', 'PROPERTY', 'JSON', $$Operational alert configuration for bookings, payments, inventory exceptions, and escalation routing by role (TODO.md §10).$$, ARRAY['communication', 'alerts']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'COMMUNICATION_NOTIFICATION'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

-- Section 11: Security, Compliance, and Backup Settings
INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'security.authentication_encryption', 'Authentication and Encryption', 'MFA requirements, SSO providers, password policies, and encryption standards.', 'TENANT', 'JSON', $$Security posture covering MFA, SSO, password expiry, session timeouts, and encryption/tokenization controls (TODO.md §11).$$, ARRAY['security', 'authentication']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'SECURITY_COMPLIANCE'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'security.access_controls', 'Access Controls', 'RBAC matrices, field-level permissions, API entitlements, and audit logging.', 'TENANT', 'JSON', $$Role-based access matrices, field-level permissions, API entitlements, and audit logging controls (TODO.md §11).$$, ARRAY['security', 'rbac']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'SECURITY_COMPLIANCE'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'security.compliance_features', 'Compliance Features', 'Data subject requests, anonymization workflows, breach responses, and PCI scanning.', 'TENANT', 'JSON', $$Compliance tooling for data extraction, anonymization, consent tracking, breach workflows, and PCI scans (TODO.md §11).$$, ARRAY['security', 'compliance']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'SECURITY_COMPLIANCE'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'security.backup_recovery', 'Backup and Recovery', 'Backup schedules, encryption, RTO/RPO targets, testing cadence, and storage tiers.', 'TENANT', 'JSON', $$Business continuity planning covering backup scheduling, encryption, retention, RTO/RPO targets, and recovery testing (TODO.md §11).$$, ARRAY['security', 'continuity']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'SECURITY_COMPLIANCE'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

-- Section 12: UI, Localization, and Custom Settings
INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'ui.customization', 'UI Customization', 'Themes, logos, layouts, shortcuts, and personalized dashboards.', 'USER', 'JSON', $$User interface personalization for themes, dashboards, navigation shortcuts, and branding (TODO.md §12).$$, ARRAY['ui', 'personalization']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'UI_LOCALIZATION'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'ui.mobile_features', 'Mobile App Features', 'Mobile access to reservations, housekeeping tasks, payments, and offline workflows.', 'TENANT', 'JSON', $$Mobile application configuration including reservations, housekeeping, payments, notifications, and offline sync (TODO.md §12).$$, ARRAY['ui', 'mobile']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'UI_LOCALIZATION'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'ui.localization', 'Language and Localization', 'Languages, date/time/number formats, and translation coverage for UI and templates.', 'TENANT', 'JSON', $$Localization coverage for languages, formats, and translation resources across UI and templates (TODO.md §12).$$, ARRAY['ui', 'localization']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'UI_LOCALIZATION'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

INSERT INTO
    setting_definitions (
        category_id,
        setting_key,
        setting_name,
        description,
        storage_level,
        data_type,
        documentation,
        tags
    )
SELECT sc.category_id, 'ui.custom_fields', 'Custom Fields', 'Field catalogs, validations, permissions, and dependency rules.', 'TENANT', 'JSON', $$Custom field catalogs with validations, permission controls, and dependency logic (TODO.md §12).$$, ARRAY['ui', 'extensibility']::TEXT []
FROM setting_categories sc
WHERE
    sc.category_key = 'UI_LOCALIZATION'
ON CONFLICT (setting_key) DO
UPDATE
SET
    category_id = EXCLUDED.category_id,
    setting_name = EXCLUDED.setting_name,
    description = EXCLUDED.description,
    storage_level = EXCLUDED.storage_level,
    data_type = EXCLUDED.data_type,
    documentation = EXCLUDED.documentation,
    tags = EXCLUDED.tags,
    updated_at = CURRENT_TIMESTAMP,
    is_active = TRUE;

\echo '✓ settings seed applied.'
