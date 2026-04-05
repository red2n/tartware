-- =====================================================
-- 15_settings_seed.sql
-- Settings catalog seed data — categories, sections, definitions, options
-- Industry Standard: PMS settings catalog (HTNG, Opera Cloud, Mews patterns)
-- Pattern: Upsert-safe ON CONFLICT DO UPDATE — safe to re-run at any time
-- Date: 2026-04-05
-- =====================================================

\c tartware

\echo 'Seeding settings catalog...'

-- Store tenant_id in a session-local setting so all inserts are consistent.
-- Settings catalog is seeded against the first (system) tenant.
SELECT set_config('seed.tenant_id', (SELECT id::text FROM tenants ORDER BY created_at LIMIT 1), FALSE);

-- =====================================================
-- SETTINGS_CATEGORIES
-- 13 top-level categories matching UI nav-config routes
-- =====================================================

INSERT INTO settings_categories (code, name, description, icon, color, sort_order, is_active, tenant_id)
SELECT v.code, v.name, v.description, v.icon, v.color, v.sort_order, TRUE,
       current_setting('seed.tenant_id')::uuid
FROM (VALUES
  ('ADMIN_USER_MANAGEMENT',                'Admin & Users',         'User accounts, roles, permissions, and access control policies.',            'admin_panel_settings', '#3b82f6', 10),
  ('PROPERTY_TENANT_PROFILE',              'Property & Tenant',     'Property profile, contact details, timezone, currency, and branding.',        'apartment',           '#8b5cf6', 20),
  ('ROOM_UNIT_INVENTORY',                  'Rooms & Inventory',     'Room types, numbering conventions, housekeeping defaults, and OOO rules.',    'meeting_room',        '#10b981', 30),
  ('RATE_PRICING_FINANCIAL',               'Rates & Pricing',       'Rate plans, pricing rules, deposit policies, and financial defaults.',         'request_quote',       '#f59e0b', 40),
  ('APPROVAL_WORKFLOWS',                   'Approvals',             'Multi-step approval chains, thresholds, and auto-approval rules.',             'approval',            '#ef4444', 50),
  ('INTEGRATION_CHANNEL_MANAGEMENT',       'Integrations',          'OTA connections, channel managers, POS, keycard, and third-party APIs.',      'sync_alt',            '#06b6d4', 60),
  ('BOOKING_ENGINE_GUEST',                 'Booking & Guests',      'Online booking engine, advance booking window, and guest profile controls.',  'travel_explore',      '#ec4899', 70),
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS',  'Operations',            'Housekeeping schedules, maintenance workflows, and task automation.',          'cleaning_services',   '#84cc16', 80),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT',      'Reporting',             'Scheduled reports, dashboards, night audit procedures, and data retention.',  'analytics',           '#f97316', 90),
  ('COMMUNICATION_NOTIFICATIONS',          'Notifications',         'Email, SMS, and in-app alert channels, templates, and opt-in preferences.',   'notifications',       '#6366f1', 100),
  ('SECURITY_COMPLIANCE_BACKUP',           'Security',              'Authentication, MFA, session policies, compliance, and backup controls.',     'shield',              '#dc2626', 110),
  ('UI_LOCALIZATION_CUSTOM',               'UI & Localization',     'Date/time formats, languages, display preferences, and custom fields.',       'palette',             '#14b8a6', 120),
  ('ADVANCED_TRENDING',                    'Advanced',              'Feature flags, experimental features, and system-level tuning options.',      'rocket_launch',       '#9333ea', 130)
) AS v(code, name, description, icon, color, sort_order)
ON CONFLICT (code) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  color       = EXCLUDED.color,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();

-- =====================================================
-- SETTINGS_SECTIONS
-- 2-4 sections per category
-- =====================================================

INSERT INTO settings_sections (category_id, code, name, description, icon, sort_order, is_active, tenant_id)
SELECT c.id, s.code, s.name, s.description, s.icon, s.sort_order, TRUE,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN (VALUES
  ('ADMIN_USER_MANAGEMENT',  'user_accounts',       'User Accounts',         'Create, suspend, and manage staff accounts.',             'person',           10),
  ('ADMIN_USER_MANAGEMENT',  'roles_permissions',   'Roles & Permissions',   'Role definitions and screen-level access control.',       'manage_accounts',  20),
  ('ADMIN_USER_MANAGEMENT',  'password_policy',     'Password Policy',       'Complexity rules, expiry, and lockout settings.',         'lock',             30),
  ('ADMIN_USER_MANAGEMENT',  'session_policy',      'Session Policy',        'Idle timeout, concurrent session, and device limits.',    'devices',          40),
  ('PROPERTY_TENANT_PROFILE','property_info',       'Property Information',  'Name, address, contact details, and classification.',     'business',         10),
  ('PROPERTY_TENANT_PROFILE','locale_currency',     'Locale & Currency',     'Primary timezone, locale, and base currency.',            'public',           20),
  ('PROPERTY_TENANT_PROFILE','branding',            'Branding & Display',    'Logo, colours, and front-desk display preferences.',      'palette',          30),
  ('ROOM_UNIT_INVENTORY',    'room_defaults',       'Room Defaults',         'Default room status, floor naming, and numbering rules.', 'meeting_room',     10),
  ('ROOM_UNIT_INVENTORY',    'housekeeping_rules',  'Housekeeping Rules',    'Auto-assignment, due-out priority, and DND handling.',    'cleaning_services',20),
  ('ROOM_UNIT_INVENTORY',    'ooo_oos_policy',      'OOO & OOS Policy',      'Out-of-Order and Out-of-Service approval flows.',         'block',            30),
  ('RATE_PRICING_FINANCIAL', 'rate_defaults',       'Rate Defaults',         'Default rate plan, rounding, and currency settings.',     'sell',             10),
  ('RATE_PRICING_FINANCIAL', 'deposit_policy',      'Deposit Policy',        'Deposit percentages, deadlines, and non-refund rules.',   'savings',          20),
  ('RATE_PRICING_FINANCIAL', 'tax_configuration',   'Tax Configuration',     'Tax codes, rates, and inclusive/exclusive rules.',        'receipt_long',     30),
  ('APPROVAL_WORKFLOWS',     'rate_approval',       'Rate Approval',         'Override and discount approval thresholds.',              'percent',          10),
  ('APPROVAL_WORKFLOWS',     'financial_approval',  'Financial Approval',    'Refund, write-off, and complimentary approval chains.',   'payments',         20),
  ('APPROVAL_WORKFLOWS',     'operational_approval','Operational Approvals', 'Early check-in, late check-out, and upgrade approvals.', 'schedule',         30),
  ('INTEGRATION_CHANNEL_MANAGEMENT','ota_connections','OTA Connections',     'Mapping and sync settings for OTA channels.',             'cloud_sync',       10),
  ('INTEGRATION_CHANNEL_MANAGEMENT','channel_manager','Channel Manager',     'Connectivity and rate-push settings for channel managers.','swap_horiz',      20),
  ('INTEGRATION_CHANNEL_MANAGEMENT','pos_keycard',  'POS & Keycard',         'Point-of-sale and electronic keycard system integration.','vpn_key',          30),
  ('BOOKING_ENGINE_GUEST',   'booking_rules',       'Booking Rules',         'Advance window, min/max stay, and cutoff times.',         'event_available',  10),
  ('BOOKING_ENGINE_GUEST',   'guest_profile',       'Guest Profile',         'Required fields, loyalty enrolment, and data retention.', 'badge',            20),
  ('BOOKING_ENGINE_GUEST',   'cancellation_policy', 'Cancellation Policy',   'Deadlines, fees, and no-show charge rules.',              'event_busy',       30),
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS','hk_scheduling',   'HK Scheduling', 'Shift start time, priority sorting, and room assignment.','schedule',         10),
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS','maintenance_rules','Maintenance',   'Work order priorities, SLA targets, and escalation.',     'build',            20),
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS','task_automation',  'Task Automation','Auto-triggered tasks on status change events.',          'auto_mode',        30),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','night_audit',    'Night Audit',        'Roll-over time, auto-run, and exception handling.',       'wb_twilight',      10),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','report_schedule','Report Scheduling',  'Scheduled delivery, recipients, and formats.',            'schedule_send',    20),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','data_retention', 'Data Retention',     'Archive periods and GDPR deletion schedules.',            'storage',          30),
  ('COMMUNICATION_NOTIFICATIONS','email_settings',   'Email Settings',       'SMTP/provider, sender name, and reply-to address.',       'email',            10),
  ('COMMUNICATION_NOTIFICATIONS','sms_settings',     'SMS Settings',         'SMS provider, sender ID, and character encoding.',        'sms',              20),
  ('COMMUNICATION_NOTIFICATIONS','alert_preferences','Alert Preferences',    'In-app and push notification routing by event type.',     'notifications',    30),
  ('SECURITY_COMPLIANCE_BACKUP','authentication',    'Authentication',        'MFA requirements, SSO, and login attempt limits.',        'vpn_lock',         10),
  ('SECURITY_COMPLIANCE_BACKUP','data_privacy',      'Data Privacy',          'GDPR consent, PII masking, and access audit settings.',   'privacy_tip',      20),
  ('SECURITY_COMPLIANCE_BACKUP','backup_recovery',   'Backup & Recovery',    'Backup schedules, retention, and recovery RPO/RTO.',      'backup',           30),
  ('UI_LOCALIZATION_CUSTOM', 'date_time_format',    'Date & Time Format',    'Locale-specific date, time, and week-start settings.',    'today',            10),
  ('UI_LOCALIZATION_CUSTOM', 'language',            'Language',              'UI language and translation fallback rules.',              'translate',        20),
  ('UI_LOCALIZATION_CUSTOM', 'custom_fields',       'Custom Fields',         'Tenant-specific extra fields on reservations and guests.','tune',             30),
  ('ADVANCED_TRENDING',      'feature_flags',       'Feature Flags',         'Enable or disable experimental and beta features.',       'science',          10),
  ('ADVANCED_TRENDING',      'performance_tuning',  'Performance Tuning',    'Cache TTLs, connection pool sizes, and rate limits.',      'speed',            20)
) AS s(cat_code, code, name, description, icon, sort_order)
  ON c.code = s.cat_code
ON CONFLICT ON CONSTRAINT uq_sections_category_code DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  sort_order  = EXCLUDED.sort_order,
  updated_at  = NOW();

-- =====================================================
-- SETTINGS_DEFINITIONS — one INSERT block per category
-- =====================================================

-- ── ADMIN_USER_MANAGEMENT ─────────────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('ADMIN_USER_MANAGEMENT','user_accounts',    'admin.max_staff_users',           'Max Staff Users',            'Maximum number of active staff accounts allowed.',                   'INTEGER','NUMBER_INPUT','100',         ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',10),
  ('ADMIN_USER_MANAGEMENT','user_accounts',    'admin.require_email_verification','Require Email Verification', 'New accounts must verify their email before first login.',           'BOOLEAN','TOGGLE',      'true',        ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',20),
  ('ADMIN_USER_MANAGEMENT','user_accounts',    'admin.auto_deactivate_days',      'Auto-Deactivate Inactive',   'Deactivate user after this many days of inactivity (0=disabled).',  'INTEGER','NUMBER_INPUT','90',          ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',30),
  ('ADMIN_USER_MANAGEMENT','roles_permissions','admin.default_role',              'Default New User Role',      'Role assigned automatically when a new staff account is created.',  'ENUM',  'SELECT',      '"frontdesk"', ARRAY['TENANT'],'TENANT',TRUE, 'INTERNAL',10),
  ('ADMIN_USER_MANAGEMENT','roles_permissions','admin.allow_multi_role',          'Allow Multi-Role',           'Permit a single account to hold more than one role.',                'BOOLEAN','TOGGLE',      'false',       ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',20),
  ('ADMIN_USER_MANAGEMENT','password_policy',  'admin.password_min_length',       'Minimum Password Length',    'Minimum number of characters required for staff passwords.',        'INTEGER','NUMBER_INPUT','8',           ARRAY['TENANT'],'TENANT',TRUE, 'INTERNAL',10),
  ('ADMIN_USER_MANAGEMENT','password_policy',  'admin.password_requires_upper',   'Require Uppercase',          'Password must contain at least one uppercase letter.',              'BOOLEAN','TOGGLE',      'true',        ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',20),
  ('ADMIN_USER_MANAGEMENT','password_policy',  'admin.password_requires_number',  'Require Number',             'Password must contain at least one numeric digit.',                 'BOOLEAN','TOGGLE',      'true',        ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',30),
  ('ADMIN_USER_MANAGEMENT','password_policy',  'admin.password_expiry_days',      'Password Expiry (days)',     'Force password reset after this many days (0 = never).',           'INTEGER','NUMBER_INPUT','0',           ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',40),
  ('ADMIN_USER_MANAGEMENT','session_policy',   'admin.session_idle_timeout_mins', 'Idle Session Timeout (min)', 'Automatically log out staff after this many idle minutes.',         'INTEGER','NUMBER_INPUT','30',          ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',10),
  ('ADMIN_USER_MANAGEMENT','session_policy',   'admin.max_concurrent_sessions',   'Max Concurrent Sessions',    'Maximum active sessions per user (0 = unlimited).',                 'INTEGER','NUMBER_INPUT','3',           ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── PROPERTY_TENANT_PROFILE ───────────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('PROPERTY_TENANT_PROFILE','property_info',  'property.timezone',      'Property Timezone',     'IANA timezone for all local date/time operations.',           'ENUM',  'SELECT',     '"America/New_York"',ARRAY['PROPERTY'],'PROPERTY',TRUE, 'INTERNAL',10),
  ('PROPERTY_TENANT_PROFILE','property_info',  'property.check_in_time', 'Default Check-In Time', 'Standard room-available time shown to guests.',               'TIME',  'TIME_PICKER','"15:00"',           ARRAY['PROPERTY'],'PROPERTY',TRUE, 'INTERNAL',20),
  ('PROPERTY_TENANT_PROFILE','property_info',  'property.check_out_time','Default Check-Out Time','Standard checkout deadline shown to guests.',                 'TIME',  'TIME_PICKER','"11:00"',           ARRAY['PROPERTY'],'PROPERTY',TRUE, 'INTERNAL',30),
  ('PROPERTY_TENANT_PROFILE','property_info',  'property.star_rating',   'Star Rating',           'Official star or key rating for the property.',               'ENUM',  'SELECT',     '"3"',               ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  40),
  ('PROPERTY_TENANT_PROFILE','locale_currency','property.base_currency', 'Base Currency',         'ISO 4217 currency code used for all financial transactions.',  'ENUM',  'SELECT',     '"USD"',             ARRAY['TENANT'],  'TENANT', TRUE, 'INTERNAL',10),
  ('PROPERTY_TENANT_PROFILE','locale_currency','property.locale',        'Locale',                'BCP 47 locale tag for number and date formatting.',            'ENUM',  'SELECT',     '"en-US"',           ARRAY['TENANT'],  'TENANT', TRUE, 'INTERNAL',20),
  ('PROPERTY_TENANT_PROFILE','branding',       'property.logo_url',      'Logo URL',              'HTTPS URL of the property logo used in receipts and emails.',  'STRING','TEXT_INPUT', 'null',              ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  10),
  ('PROPERTY_TENANT_PROFILE','branding',       'property.brand_color',   'Brand Colour',          'Primary HEX colour code used in guest-facing communications.', 'STRING','TEXT_INPUT', '"#1e40af"',         ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── ROOM_UNIT_INVENTORY ───────────────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('ROOM_UNIT_INVENTORY','room_defaults',    'rooms.default_status_on_checkout','Room Status After Checkout', 'Housekeeping status assigned immediately on checkout.',            'ENUM',  'SELECT',     '"DIRTY"',        ARRAY['PROPERTY'],'PROPERTY',TRUE, 'INTERNAL',10),
  ('ROOM_UNIT_INVENTORY','room_defaults',    'rooms.allow_same_day_reassign',   'Allow Same-Day Reassignment','Front desk may reassign a room on the morning of arrival.',        'BOOLEAN','TOGGLE',    'true',           ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',20),
  ('ROOM_UNIT_INVENTORY','housekeeping_rules','rooms.hk_priority_order',        'HK Priority Order',          'Criteria used to sort the housekeeping room queue.',               'ENUM',  'SELECT',     '"DUE_OUT_FIRST"',ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',10),
  ('ROOM_UNIT_INVENTORY','housekeeping_rules','rooms.dnd_max_days',             'Max DND Days',               'Alert supervisor if DND active for more than N consecutive days.',  'INTEGER','NUMBER_INPUT','2',            ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',20),
  ('ROOM_UNIT_INVENTORY','housekeeping_rules','rooms.stayover_clean_interval',  'Stayover Clean Interval',    'Schedule a room clean every N days during a stay.',                'INTEGER','NUMBER_INPUT','3',            ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',30),
  ('ROOM_UNIT_INVENTORY','ooo_oos_policy',   'rooms.ooo_requires_approval',     'OOO Requires Approval',      'Out-Of-Order status change requires manager approval.',            'BOOLEAN','TOGGLE',    'true',           ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',10)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── RATE_PRICING_FINANCIAL ────────────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('RATE_PRICING_FINANCIAL','rate_defaults',   'rates.default_rounding',           'Rate Rounding',              'Rounding rule applied when computing nightly rates.',              'ENUM',   'SELECT',     '"ROUND_HALF_UP"',ARRAY['TENANT','PROPERTY'],'TENANT',TRUE, 'INTERNAL',10),
  ('RATE_PRICING_FINANCIAL','rate_defaults',   'rates.max_discount_percent',       'Max Allowed Discount %',     'Highest discount a front-desk agent can apply without approval.',  'DECIMAL','SLIDER',     '15',             ARRAY['TENANT','PROPERTY'],'TENANT',FALSE,'INTERNAL',20),
  ('RATE_PRICING_FINANCIAL','rate_defaults',   'rates.show_rack_rate',             'Show Rack Rate to Guests',   'Display the rack rate crossed out alongside the offer rate.',     'BOOLEAN','TOGGLE',     'true',           ARRAY['PROPERTY'],         'PROPERTY',FALSE,'PUBLIC',  30),
  ('RATE_PRICING_FINANCIAL','deposit_policy',  'rates.deposit_required',           'Deposit Required',           'Whether a deposit must be collected at the time of booking.',     'BOOLEAN','TOGGLE',     'false',          ARRAY['TENANT','PROPERTY'],'TENANT',FALSE,'INTERNAL',10),
  ('RATE_PRICING_FINANCIAL','deposit_policy',  'rates.deposit_percent',            'Deposit Percentage',         'Percentage of total booking cost required as deposit.',           'DECIMAL','SLIDER',     '25',             ARRAY['TENANT','PROPERTY'],'TENANT',FALSE,'INTERNAL',20),
  ('RATE_PRICING_FINANCIAL','deposit_policy',  'rates.non_refundable_cutoff_days', 'Non-Refund Cutoff (days)',   'Deposits become non-refundable within this many days of arrival.','INTEGER','NUMBER_INPUT','3',             ARRAY['TENANT','PROPERTY'],'TENANT',FALSE,'INTERNAL',30),
  ('RATE_PRICING_FINANCIAL','tax_configuration','rates.tax_inclusive',             'Tax-Inclusive Rates',        'Whether published rates already include applicable taxes.',       'BOOLEAN','TOGGLE',     'false',          ARRAY['TENANT'],           'TENANT',FALSE,'INTERNAL',10),
  ('RATE_PRICING_FINANCIAL','tax_configuration','rates.city_tax_per_night',        'City Tax per Night',         'Fixed per-night city/tourist tax amount in base currency.',       'DECIMAL','NUMBER_INPUT','0',             ARRAY['PROPERTY'],         'PROPERTY',FALSE,'INTERNAL',20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── APPROVAL_WORKFLOWS ────────────────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('APPROVAL_WORKFLOWS','rate_approval',       'approvals.rate_override_threshold','Rate Override Threshold %', 'Discounts above this % trigger a manager approval request.',      'DECIMAL','SLIDER',     '20',       ARRAY['TENANT','PROPERTY'],'TENANT', FALSE,'INTERNAL',10),
  ('APPROVAL_WORKFLOWS','rate_approval',       'approvals.complimentary_requires', 'Complimentary Approval',    'Complimentary night or rate requires approval from this role.',   'ENUM',  'SELECT',     '"manager"',ARRAY['TENANT'],           'TENANT', FALSE,'INTERNAL',20),
  ('APPROVAL_WORKFLOWS','financial_approval',  'approvals.refund_threshold',       'Refund Approval Threshold', 'Refund amounts above this value (base currency) need approval.',  'DECIMAL','NUMBER_INPUT','200',     ARRAY['TENANT'],           'TENANT', FALSE,'INTERNAL',10),
  ('APPROVAL_WORKFLOWS','financial_approval',  'approvals.writeoff_requires',      'Write-Off Approval',        'All balance write-offs must be approved by this role.',           'ENUM',  'SELECT',     '"gm"',     ARRAY['TENANT'],           'TENANT', FALSE,'INTERNAL',20),
  ('APPROVAL_WORKFLOWS','operational_approval','approvals.late_checkout_threshold','Late Checkout Fee Threshold','Late checkout fees above this amount need manager sign-off.',    'DECIMAL','NUMBER_INPUT','50',      ARRAY['PROPERTY'],         'PROPERTY',FALSE,'INTERNAL',10),
  ('APPROVAL_WORKFLOWS','operational_approval','approvals.early_checkin_allow',    'Allow Early Check-In',      'Permit front-desk to offer early check-in without approval.',    'BOOLEAN','TOGGLE',     'true',     ARRAY['PROPERTY'],         'PROPERTY',FALSE,'INTERNAL',20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── INTEGRATION_CHANNEL_MANAGEMENT ───────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('INTEGRATION_CHANNEL_MANAGEMENT','ota_connections','integrations.ota_sync_interval_mins','OTA Sync Interval (min)', 'How often to push/pull inventory updates to OTA channels.',   'INTEGER','NUMBER_INPUT','60',    ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',10),
  ('INTEGRATION_CHANNEL_MANAGEMENT','ota_connections','integrations.ota_min_los',            'OTA Minimum LOS',         'Minimum length-of-stay pushed to all OTA channels.',          'INTEGER','NUMBER_INPUT','1',     ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',20),
  ('INTEGRATION_CHANNEL_MANAGEMENT','channel_manager','integrations.channel_rate_offset',   'Channel Rate Offset %',   'Percentage markup/markdown applied to channel rates.',        'DECIMAL','SLIDER',     '0',     ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',10),
  ('INTEGRATION_CHANNEL_MANAGEMENT','channel_manager','integrations.stop_sell_threshold',   'Stop-Sell Threshold',     'Block new OTA bookings when available rooms drop to this.',   'INTEGER','NUMBER_INPUT','2',     ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',20),
  ('INTEGRATION_CHANNEL_MANAGEMENT','pos_keycard',   'integrations.pos_auto_post',          'Auto-Post POS Charges',   'Automatically post POS charges to the guest folio.',          'BOOLEAN','TOGGLE',     'true',  ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',10),
  ('INTEGRATION_CHANNEL_MANAGEMENT','pos_keycard',   'integrations.keycard_system',         'Keycard System',          'Brand of electronic keycard system in use at this property.', 'ENUM',  'SELECT',     '"none"', ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── BOOKING_ENGINE_GUEST ──────────────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('BOOKING_ENGINE_GUEST','booking_rules',      'booking.max_advance_days',       'Max Advance Booking (days)', 'Furthest future date guests can book via the booking engine.',    'INTEGER','NUMBER_INPUT','365',   ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  10),
  ('BOOKING_ENGINE_GUEST','booking_rules',      'booking.min_advance_hours',      'Min Advance Notice (hours)', 'Minimum hours before arrival that online booking is allowed.',    'INTEGER','NUMBER_INPUT','2',     ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  20),
  ('BOOKING_ENGINE_GUEST','booking_rules',      'booking.cutoff_time',            'Booking Cutoff Time',        'Daily time after which same-day bookings are blocked.',           'TIME',  'TIME_PICKER','"20:00"',ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  30),
  ('BOOKING_ENGINE_GUEST','guest_profile',      'booking.require_phone',          'Require Guest Phone',        'Phone number is mandatory during the reservation process.',       'BOOLEAN','TOGGLE',    'false', ARRAY['TENANT'],  'TENANT', FALSE,'INTERNAL',10),
  ('BOOKING_ENGINE_GUEST','guest_profile',      'booking.auto_enroll_loyalty',    'Auto-Enrol in Loyalty',      'Enrol new guests in the loyalty programme on first booking.',     'BOOLEAN','TOGGLE',    'true',  ARRAY['TENANT'],  'TENANT', FALSE,'INTERNAL',20),
  ('BOOKING_ENGINE_GUEST','cancellation_policy','booking.free_cancel_hours',      'Free Cancel Window (hours)', 'Hours before arrival within which cancellation is free.',          'INTEGER','NUMBER_INPUT','24',   ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  10),
  ('BOOKING_ENGINE_GUEST','cancellation_policy','booking.no_show_charge_percent', 'No-Show Charge %',           'Percentage of total booking charged for a no-show.',              'DECIMAL','SLIDER',    '100',   ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── HOUSEKEEPING_MAINTENANCE_OPERATIONS ──────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS','hk_scheduling',    'ops.hk_shift_start',              'HK Shift Start',           'Time housekeeping shift begins and room queue becomes active.',  'TIME',  'TIME_PICKER', '"08:00"', ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',10),
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS','hk_scheduling',    'ops.inspections_required',        'Inspections Required',     'Rooms must pass inspection before being set CLEAN.',            'BOOLEAN','TOGGLE',      'false',   ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',20),
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS','hk_scheduling',    'ops.turndown_enabled',            'Turndown Service',         'Enable automatic turndown service scheduling.',                  'BOOLEAN','TOGGLE',      'false',   ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',30),
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS','maintenance_rules','ops.maintenance_default_priority','Default Work Order Priority','Priority level assigned to newly created maintenance work orders.','ENUM','SELECT',     '"NORMAL"', ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',10),
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS','maintenance_rules','ops.maintenance_sla_hours',       'Work Order SLA (hours)',   'Target resolution time for normal-priority maintenance tasks.', 'INTEGER','NUMBER_INPUT','24',       ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',20),
  ('HOUSEKEEPING_MAINTENANCE_OPERATIONS','task_automation',  'ops.auto_task_on_checkout',       'Auto Task on Checkout',    'Automatically create a HK task when guest checks out.',         'BOOLEAN','TOGGLE',      'true',    ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',10)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── REPORTING_ANALYTICS_NIGHT_AUDIT ──────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','night_audit',    'audit.night_audit_time',           'Night Audit Roll-Over Time', 'Local time at which the nightly audit and date roll occur.',    'TIME',  'TIME_PICKER', '"23:59"', ARRAY['PROPERTY'],'PROPERTY',TRUE, 'INTERNAL',    10),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','night_audit',    'audit.auto_run_enabled',           'Auto-Run Night Audit',       'Run night audit automatically at roll-over time.',              'BOOLEAN','TOGGLE',     'true',    ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',    20),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','night_audit',    'audit.block_checkin_during_audit', 'Block Check-In During Audit','Prevent new check-ins while the night audit is running.',       'BOOLEAN','TOGGLE',     'true',    ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',    30),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','report_schedule','audit.daily_report_recipients',    'Daily Report Recipients',    'Comma-separated email addresses for the morning report.',       'STRING','TEXT_INPUT',  '""',      ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',    10),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','report_schedule','audit.report_format',              'Default Report Format',      'File format for scheduled report delivery.',                    'ENUM',  'SELECT',      '"PDF"',    ARRAY['TENANT'],  'TENANT', FALSE,'INTERNAL',    20),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','data_retention', 'audit.reservation_archive_years', 'Reservation Archive (years)','Number of years completed reservations are retained.',          'INTEGER','NUMBER_INPUT','7',       ARRAY['TENANT'],  'TENANT', FALSE,'INTERNAL',    10),
  ('REPORTING_ANALYTICS_NIGHT_AUDIT','data_retention', 'audit.pii_deletion_months',       'PII Deletion Period (months)','Months after last stay before anonymising guest PII.',         'INTEGER','NUMBER_INPUT','26',      ARRAY['TENANT'],  'TENANT', FALSE,'CONFIDENTIAL',20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── COMMUNICATION_NOTIFICATIONS ──────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('COMMUNICATION_NOTIFICATIONS','email_settings',   'comms.email_provider',              'Email Provider',           'Transactional email service provider.',                           'ENUM',  'SELECT',    '"smtp"',   ARRAY['TENANT'],  'TENANT',  FALSE,'INTERNAL',10),
  ('COMMUNICATION_NOTIFICATIONS','email_settings',   'comms.email_from_name',             'Sender Name',              'Display name shown in the From field of outbound emails.',        'STRING','TEXT_INPUT','"Hotel"',  ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  20),
  ('COMMUNICATION_NOTIFICATIONS','email_settings',   'comms.email_reply_to',              'Reply-To Address',         'Email address guests reply to when responding to hotel emails.',  'STRING','TEXT_INPUT','""',       ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  30),
  ('COMMUNICATION_NOTIFICATIONS','sms_settings',     'comms.sms_enabled',                 'SMS Enabled',              'Enable SMS notifications for booking confirmations.',              'BOOLEAN','TOGGLE',  'false',    ARRAY['TENANT'],  'TENANT',  FALSE,'INTERNAL',10),
  ('COMMUNICATION_NOTIFICATIONS','sms_settings',     'comms.sms_provider',                'SMS Provider',             'Third-party SMS gateway used for outbound messaging.',            'ENUM',  'SELECT',    '"twilio"', ARRAY['TENANT'],  'TENANT',  FALSE,'INTERNAL',20),
  ('COMMUNICATION_NOTIFICATIONS','alert_preferences','comms.low_occupancy_alert_pct',     'Low Occupancy Alert %',    'Send staff alert when occupancy drops below this percentage.',    'INTEGER','SLIDER',   '40',       ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',10),
  ('COMMUNICATION_NOTIFICATIONS','alert_preferences','comms.maintenance_escalation_hours','Escalation After (hours)', 'Alert supervisor if a work order is unresolved after N hours.',   'INTEGER','NUMBER_INPUT','4',     ARRAY['PROPERTY'],'PROPERTY',FALSE,'INTERNAL',20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── SECURITY_COMPLIANCE_BACKUP ────────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('SECURITY_COMPLIANCE_BACKUP','authentication', 'security.mfa_required',          'MFA Required',            'Require two-factor authentication for all staff accounts.',       'BOOLEAN','TOGGLE',     'false',   ARRAY['TENANT'],'TENANT',FALSE,'CONFIDENTIAL',10),
  ('SECURITY_COMPLIANCE_BACKUP','authentication', 'security.mfa_method',            'MFA Method',              'Preferred multi-factor authentication delivery method.',          'ENUM',  'SELECT',      '"totp"',  ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',    20),
  ('SECURITY_COMPLIANCE_BACKUP','authentication', 'security.max_login_attempts',    'Max Login Attempts',      'Account locked after this many consecutive failed logins.',       'INTEGER','NUMBER_INPUT','5',       ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',    30),
  ('SECURITY_COMPLIANCE_BACKUP','data_privacy',   'security.mask_pii_in_logs',      'Mask PII in Logs',        'Redact guest PII (email, phone, card) from all log output.',      'BOOLEAN','TOGGLE',     'true',    ARRAY['TENANT'],'TENANT',FALSE,'CONFIDENTIAL',10),
  ('SECURITY_COMPLIANCE_BACKUP','data_privacy',   'security.gdpr_consent_required', 'GDPR Consent Required',   'Capture explicit marketing consent at booking creation.',         'BOOLEAN','TOGGLE',     'false',   ARRAY['TENANT'],'TENANT',FALSE,'CONFIDENTIAL',20),
  ('SECURITY_COMPLIANCE_BACKUP','backup_recovery','security.backup_frequency',      'Backup Frequency',        'How often automated DB backups are taken.',                       'ENUM',  'SELECT',      '"daily"', ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',    10),
  ('SECURITY_COMPLIANCE_BACKUP','backup_recovery','security.backup_retention_days', 'Backup Retention (days)', 'Number of days backup snapshots are retained before deletion.',   'INTEGER','NUMBER_INPUT','30',      ARRAY['TENANT'],'TENANT',FALSE,'INTERNAL',    20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── UI_LOCALIZATION_CUSTOM ────────────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('UI_LOCALIZATION_CUSTOM','date_time_format','ui.date_format',               'Date Format',             'Display format for dates throughout the PMS UI.',                 'ENUM',  'SELECT',    '"MM/DD/YYYY"',ARRAY['TENANT','PROPERTY'],'TENANT',FALSE,'PUBLIC',  10),
  ('UI_LOCALIZATION_CUSTOM','date_time_format','ui.time_format',               'Time Format',             'Display format for times (12-hour vs 24-hour clock).',            'ENUM',  'SELECT',    '"12h"',       ARRAY['TENANT','PROPERTY'],'TENANT',FALSE,'PUBLIC',  20),
  ('UI_LOCALIZATION_CUSTOM','date_time_format','ui.week_starts_on',            'Week Starts On',          'First day of week shown in calendar and date-picker.',             'ENUM',  'SELECT',    '"sunday"',    ARRAY['TENANT'],           'TENANT',FALSE,'PUBLIC',  30),
  ('UI_LOCALIZATION_CUSTOM','language',        'ui.default_language',          'Default Language',        'Language shown to staff when no personal preference is set.',      'ENUM',  'SELECT',    '"en"',        ARRAY['TENANT'],           'TENANT',FALSE,'PUBLIC',  10),
  ('UI_LOCALIZATION_CUSTOM','language',        'ui.guest_language',            'Guest-Facing Language',   'Language used in guest-facing emails and receipts.',               'ENUM',  'SELECT',    '"en"',        ARRAY['PROPERTY'],         'PROPERTY',FALSE,'PUBLIC', 20),
  ('UI_LOCALIZATION_CUSTOM','custom_fields',   'ui.reservation_custom_fields', 'Reservation Custom Fields','JSON schema defining extra fields on the reservation form.',      'JSON',  'JSON_EDITOR','[]',          ARRAY['TENANT'],           'TENANT',FALSE,'INTERNAL',10),
  ('UI_LOCALIZATION_CUSTOM','custom_fields',   'ui.guest_custom_fields',       'Guest Custom Fields',     'JSON schema defining extra fields on the guest profile form.',     'JSON',  'JSON_EDITOR','[]',          ARRAY['TENANT'],           'TENANT',FALSE,'INTERNAL',20)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- ── ADVANCED_TRENDING ─────────────────────────────────────────────
INSERT INTO settings_definitions
  (category_id, section_id, code, name, description, data_type, control_type,
   default_value, allowed_scopes, default_scope, is_required, sensitivity, sort_order, tenant_id)
SELECT c.id, sec.id, d.code, d.name, d.description, d.data_type, d.control_type,
       d.default_value::jsonb, d.allowed_scopes, d.default_scope, d.is_required, d.sensitivity, d.sort_order,
       current_setting('seed.tenant_id')::uuid
FROM settings_categories c
JOIN settings_sections sec ON sec.category_id = c.id
JOIN (VALUES
  ('ADVANCED_TRENDING','feature_flags',     'advanced.enable_dynamic_pricing', 'Dynamic Pricing',         'Enable AI-driven dynamic rate adjustment.',                         'BOOLEAN','TOGGLE',     'false',ARRAY['TENANT'],   'TENANT', FALSE,'INTERNAL',10),
  ('ADVANCED_TRENDING','feature_flags',     'advanced.enable_mobile_checkin',  'Mobile Check-In',         'Allow guests to check in via the mobile app before arrival.',       'BOOLEAN','TOGGLE',     'true', ARRAY['PROPERTY'],'PROPERTY',FALSE,'PUBLIC',  20),
  ('ADVANCED_TRENDING','feature_flags',     'advanced.enable_revenue_forecast','Revenue Forecasting',     'Show AI-generated revenue forecast on the dashboard.',              'BOOLEAN','TOGGLE',     'false',ARRAY['TENANT'],   'TENANT', FALSE,'INTERNAL',30),
  ('ADVANCED_TRENDING','performance_tuning','advanced.db_pool_size',           'DB Connection Pool Size', 'Maximum database connections per service instance.',                'INTEGER','NUMBER_INPUT','10',  ARRAY['TENANT'],   'TENANT', FALSE,'INTERNAL',10),
  ('ADVANCED_TRENDING','performance_tuning','advanced.api_rate_limit_rpm',     'API Rate Limit (req/min)','Maximum API requests per minute per tenant before throttling.',     'INTEGER','NUMBER_INPUT','1000',ARRAY['TENANT'],   'TENANT', FALSE,'INTERNAL',20),
  ('ADVANCED_TRENDING','performance_tuning','advanced.cache_ttl_seconds',      'Cache TTL (seconds)',     'Default Redis cache TTL for read-heavy endpoints.',                 'INTEGER','NUMBER_INPUT','300', ARRAY['TENANT'],   'TENANT', FALSE,'INTERNAL',30)
) AS d(cat,sec,code,name,description,data_type,control_type,default_value,allowed_scopes,default_scope,is_required,sensitivity,sort_order)
  ON c.code = d.cat AND sec.code = d.sec
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,default_value=EXCLUDED.default_value,updated_at=NOW();

-- =====================================================
-- SETTINGS_OPTIONS
-- Choices for SELECT / RADIO_GROUP / MULTI_SELECT definitions
-- =====================================================

INSERT INTO settings_options (setting_id, value, label, description, sort_order, is_default, tenant_id)
SELECT def.id, o.value, o.label, o.description, o.sort_order, o.is_default,
       current_setting('seed.tenant_id')::uuid
FROM settings_definitions def
JOIN (VALUES
  ('admin.default_role',          'frontdesk',    'Front Desk',         'Standard front-of-house role.',             10,TRUE),
  ('admin.default_role',          'housekeeping', 'Housekeeping',       'Housekeeping attendant role.',               20,FALSE),
  ('admin.default_role',          'manager',      'Manager',            'Shift or department manager role.',          30,FALSE),
  ('admin.default_role',          'gm',           'General Manager',    'Full access except system settings.',        40,FALSE),
  ('admin.default_role',          'readonly',     'Read-Only',          'View-only access across all screens.',       50,FALSE),
  ('approvals.complimentary_requires','manager',  'Manager',            'Shift manager approval required.',           10,TRUE),
  ('approvals.complimentary_requires','gm',       'General Manager',    'GM approval required.',                      20,FALSE),
  ('approvals.writeoff_requires', 'gm',           'General Manager',    'GM approval required.',                      10,TRUE),
  ('approvals.writeoff_requires', 'manager',      'Manager',            'Manager approval required.',                 20,FALSE),
  ('integrations.keycard_system', 'none',         'None',               'No integrated keycard system.',              10,TRUE),
  ('integrations.keycard_system', 'assa_abloy',   'ASSA ABLOY',         'ASSA ABLOY Vostio / VingCard.',             20,FALSE),
  ('integrations.keycard_system', 'salto',        'Salto',              'Salto JustIN Mobile / Nebula.',             30,FALSE),
  ('integrations.keycard_system', 'dormakaba',    'dormakaba',          'dormakaba Mobile Access.',                  40,FALSE),
  ('integrations.keycard_system', 'onity',        'Onity',              'Onity DirectKey.',                          50,FALSE),
  ('comms.email_provider',        'smtp',         'SMTP',               'Custom SMTP relay server.',                  10,TRUE),
  ('comms.email_provider',        'sendgrid',     'SendGrid',           'Twilio SendGrid transactional email.',       20,FALSE),
  ('comms.email_provider',        'mailgun',      'Mailgun',            'Mailgun transactional email.',               30,FALSE),
  ('comms.email_provider',        'ses',          'Amazon SES',         'AWS Simple Email Service.',                  40,FALSE),
  ('comms.sms_provider',          'twilio',       'Twilio',             'Twilio Programmable Messaging.',             10,TRUE),
  ('comms.sms_provider',          'vonage',       'Vonage',             'Vonage (Nexmo) SMS API.',                    20,FALSE),
  ('comms.sms_provider',          'messagebird',  'MessageBird',        'MessageBird SMS gateway.',                   30,FALSE),
  ('security.mfa_method',         'totp',         'Authenticator App',  'TOTP via Google Authenticator / Authy.',    10,TRUE),
  ('security.mfa_method',         'sms',          'SMS OTP',            'One-time code delivered by SMS.',            20,FALSE),
  ('security.mfa_method',         'email',        'Email OTP',          'One-time code delivered by email.',          30,FALSE),
  ('security.backup_frequency',   'hourly',       'Hourly',             'Full snapshot every hour.',                  10,FALSE),
  ('security.backup_frequency',   'daily',        'Daily',              'Full snapshot once per day.',                20,TRUE),
  ('security.backup_frequency',   'weekly',       'Weekly',             'Full snapshot once per week.',               30,FALSE),
  ('audit.report_format',         'PDF',          'PDF',                'Portable Document Format.',                  10,TRUE),
  ('audit.report_format',         'XLSX',         'Excel (XLSX)',       'Microsoft Excel spreadsheet.',               20,FALSE),
  ('audit.report_format',         'CSV',          'CSV',                'Comma-separated values.',                    30,FALSE),
  ('rooms.default_status_on_checkout','DIRTY',    'Dirty',              'Room needs cleaning.',                       10,TRUE),
  ('rooms.default_status_on_checkout','INSPECTED','Inspected',          'Room requires inspection only.',             20,FALSE),
  ('rooms.hk_priority_order',     'DUE_OUT_FIRST','Due-Out First',      'Rooms with departing guests first.',         10,TRUE),
  ('rooms.hk_priority_order',     'VIP_FIRST',    'VIP First',          'VIP and high-priority guests first.',        20,FALSE),
  ('rooms.hk_priority_order',     'FLOOR_BASED',  'Floor Based',        'Rooms sorted by floor for efficiency.',      30,FALSE),
  ('ops.maintenance_default_priority','LOW',      'Low',                'Non-urgent — resolve within SLA.',           10,FALSE),
  ('ops.maintenance_default_priority','NORMAL',   'Normal',             'Standard priority.',                         20,TRUE),
  ('ops.maintenance_default_priority','HIGH',     'High',               'Resolve before end of shift.',               30,FALSE),
  ('ops.maintenance_default_priority','CRITICAL', 'Critical',           'Immediate attention required.',              40,FALSE),
  ('rates.default_rounding',      'ROUND_HALF_UP','Round Half Up',      'Round x.5 up (standard).',                  10,TRUE),
  ('rates.default_rounding',      'ROUND_DOWN',   'Round Down',         'Always round to the lower unit.',            20,FALSE),
  ('rates.default_rounding',      'ROUND_UP',     'Round Up',           'Always round to the higher unit.',           30,FALSE),
  ('property.star_rating',        '1',            '1 Star',             'Budget / economy property.',                 10,FALSE),
  ('property.star_rating',        '2',            '2 Stars',            'Economy property.',                          20,FALSE),
  ('property.star_rating',        '3',            '3 Stars',            'Mid-scale property.',                        30,TRUE),
  ('property.star_rating',        '4',            '4 Stars',            'Upscale property.',                          40,FALSE),
  ('property.star_rating',        '5',            '5 Stars',            'Luxury / ultra-luxury property.',            50,FALSE),
  ('property.timezone',           'America/New_York',    'US Eastern',  'UTC-5 / UTC-4 (DST)',                        10,TRUE),
  ('property.timezone',           'America/Chicago',     'US Central',  'UTC-6 / UTC-5 (DST)',                        20,FALSE),
  ('property.timezone',           'America/Denver',      'US Mountain', 'UTC-7 / UTC-6 (DST)',                        30,FALSE),
  ('property.timezone',           'America/Los_Angeles', 'US Pacific',  'UTC-8 / UTC-7 (DST)',                        40,FALSE),
  ('property.timezone',           'Europe/London',       'London',      'UTC+0 / UTC+1 (BST)',                        50,FALSE),
  ('property.timezone',           'Europe/Paris',        'Paris/Berlin','UTC+1 / UTC+2 (CET/CEST)',                   60,FALSE),
  ('property.timezone',           'Asia/Singapore',      'Singapore',   'UTC+8 (no DST)',                             70,FALSE),
  ('property.timezone',           'Asia/Dubai',          'Dubai',       'UTC+4 (no DST)',                             80,FALSE),
  ('property.timezone',           'Australia/Sydney',    'Sydney',      'UTC+10 / UTC+11 (AEDT)',                     90,FALSE),
  ('property.base_currency',      'USD','US Dollar (USD)',       'United States Dollar', 10,TRUE),
  ('property.base_currency',      'EUR','Euro (EUR)',            'European Euro',         20,FALSE),
  ('property.base_currency',      'GBP','Pound Sterling (GBP)', 'British Pound',          30,FALSE),
  ('property.base_currency',      'AUD','Australian Dollar (AUD)','Australian Dollar',   40,FALSE),
  ('property.base_currency',      'SGD','Singapore Dollar (SGD)','Singapore Dollar',     50,FALSE),
  ('property.base_currency',      'AED','UAE Dirham (AED)',      'UAE Dirham',            60,FALSE),
  ('property.base_currency',      'INR','Indian Rupee (INR)',    'Indian Rupee',          70,FALSE),
  ('property.locale',             'en-US','English (US)',   'English — US conventions',  10,TRUE),
  ('property.locale',             'en-GB','English (UK)',   'English — UK conventions',  20,FALSE),
  ('property.locale',             'fr-FR','French (France)','French — France',            30,FALSE),
  ('property.locale',             'de-DE','German (Germany)','German — Germany',          40,FALSE),
  ('property.locale',             'es-ES','Spanish (Spain)','Spanish — Spain',            50,FALSE),
  ('property.locale',             'ar-AE','Arabic (UAE)',   'Arabic — UAE',               60,FALSE),
  ('ui.date_format',              'MM/DD/YYYY','MM/DD/YYYY','US format',      10,TRUE),
  ('ui.date_format',              'DD/MM/YYYY','DD/MM/YYYY','UK / EU format', 20,FALSE),
  ('ui.date_format',              'YYYY-MM-DD','YYYY-MM-DD','ISO 8601',       30,FALSE),
  ('ui.time_format',              '12h','12-hour (AM/PM)','12-hour clock', 10,TRUE),
  ('ui.time_format',              '24h','24-hour',        '24-hour clock', 20,FALSE),
  ('ui.week_starts_on',           'sunday','Sunday','Week starts on Sunday',10,TRUE),
  ('ui.week_starts_on',           'monday','Monday','Week starts on Monday',20,FALSE),
  ('ui.default_language',         'en','English',  '',10,TRUE),
  ('ui.default_language',         'fr','Français', '',20,FALSE),
  ('ui.default_language',         'de','Deutsch',  '',30,FALSE),
  ('ui.default_language',         'es','Español',  '',40,FALSE),
  ('ui.default_language',         'ar','العربية',  '',50,FALSE),
  ('ui.guest_language',           'en','English',  '',10,TRUE),
  ('ui.guest_language',           'fr','Français', '',20,FALSE),
  ('ui.guest_language',           'de','Deutsch',  '',30,FALSE),
  ('ui.guest_language',           'es','Español',  '',40,FALSE),
  ('ui.guest_language',           'ar','العربية',  '',50,FALSE)
) AS o(setting_code, value, label, description, sort_order, is_default)
  ON def.code = o.setting_code
ON CONFLICT ON CONSTRAINT uq_options_setting_value DO UPDATE SET
  label       = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order  = EXCLUDED.sort_order,
  is_default  = EXCLUDED.is_default,
  updated_at  = NOW();

\echo 'Settings catalog seed complete — categories, sections, definitions, options loaded.'
