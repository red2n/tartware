-- =====================================================
-- 16_property_feature_flags.sql
-- Property-Level Feature Flags
-- Industry Standard: OPERA Cloud (FEATURE_SETTINGS),
--                    Mews (PROPERTY_CAPABILITIES)
-- Pattern: Configuration-driven feature toggles per property
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- PROPERTY_FEATURE_FLAGS TABLE
-- Enable/disable PMS features at the property level.
-- Used for phased rollouts, tiered subscriptions,
-- and property-specific customization.
-- =====================================================

CREATE TABLE IF NOT EXISTS property_feature_flags (
    -- Primary Key
    flag_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),        -- Unique flag identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                    -- FK tenants.id
    property_id UUID,                                           -- FK properties.id (NULL = tenant-wide default)

    -- Feature Identification
    feature_code VARCHAR(100) NOT NULL,                         -- Unique feature key (e.g., 'comp_accounting', 'mobile_checkin')
    feature_name VARCHAR(200) NOT NULL,                         -- Display name (e.g., 'Comp Accounting')
    feature_description TEXT,                                    -- Description of what the feature does

    -- Classification
    feature_module VARCHAR(50) NOT NULL CHECK (
        feature_module IN (
            'CORE',              -- Core PMS features
            'RESERVATIONS',      -- Reservation management
            'BILLING',           -- Financial/billing features
            'HOUSEKEEPING',      -- Housekeeping operations
            'REVENUE',           -- Revenue management
            'GUEST_EXPERIENCE',  -- Guest-facing features
            'INTEGRATIONS',      -- Third-party integrations
            'ANALYTICS',         -- Reporting and analytics
            'COMPLIANCE',        -- Compliance and data
            'OPERATIONS',        -- Operational features
            'EVENTS',            -- Function rooms and events
            'COMMUNICATIONS',    -- Notifications and templates
            'OTHER'              -- Uncategorized
        )
    ),                                                          -- Module grouping

    -- State
    is_enabled BOOLEAN DEFAULT FALSE,                          -- Feature on/off toggle
    enabled_at TIMESTAMP,                                       -- When feature was enabled
    enabled_by UUID,                                            -- Who enabled it
    disabled_at TIMESTAMP,                                      -- When feature was disabled
    disabled_by UUID,                                           -- Who disabled it

    -- Rollout Control
    rollout_percentage INTEGER DEFAULT 100 CHECK (
        rollout_percentage BETWEEN 0 AND 100
    ),                                                          -- Percentage of users who see the feature (for gradual rollout)
    rollout_strategy VARCHAR(20) DEFAULT 'ALL' CHECK (
        rollout_strategy IN ('ALL', 'PERCENTAGE', 'ROLE_BASED', 'USER_LIST')
    ),                                                          -- How to determine who gets the feature
    allowed_roles TEXT[],                                        -- Roles that can access (if ROLE_BASED)
    allowed_user_ids UUID[],                                    -- Specific users (if USER_LIST)

    -- Subscription
    requires_subscription_tier VARCHAR(20),                     -- Minimum subscription tier required
    is_premium BOOLEAN DEFAULT FALSE,                          -- Premium/paid add-on feature
    is_beta BOOLEAN DEFAULT FALSE,                             -- Beta/experimental feature

    -- Dependencies
    depends_on TEXT[],                                          -- Feature codes that must be enabled first
    conflicts_with TEXT[],                                      -- Feature codes that cannot be active simultaneously

    -- Configuration
    config JSONB DEFAULT '{}'::jsonb,                           -- Feature-specific configuration parameters

    -- Notes
    internal_notes TEXT,                                        -- Staff-only notes

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,                        -- Extension metadata

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- Creation timestamp
    updated_at TIMESTAMP,                                      -- Last update timestamp
    created_by UUID,                                           -- Creator identifier
    updated_by UUID,                                           -- Modifier identifier

    -- Constraints
    CONSTRAINT feature_flags_unique UNIQUE (tenant_id, property_id, feature_code)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE property_feature_flags IS 'Property-level feature flags for enabling/disabling PMS capabilities per property or tenant';
COMMENT ON COLUMN property_feature_flags.flag_id IS 'Unique feature flag identifier (UUID)';
COMMENT ON COLUMN property_feature_flags.feature_code IS 'Unique feature key used in code checks (e.g., comp_accounting, mobile_checkin)';
COMMENT ON COLUMN property_feature_flags.feature_module IS 'Module grouping: CORE, RESERVATIONS, BILLING, etc.';
COMMENT ON COLUMN property_feature_flags.is_enabled IS 'Master toggle for this feature at the given scope';
COMMENT ON COLUMN property_feature_flags.rollout_percentage IS 'Percentage of users who see the feature (0-100) for gradual rollout';
COMMENT ON COLUMN property_feature_flags.rollout_strategy IS 'How users are selected: ALL, PERCENTAGE, ROLE_BASED, USER_LIST';
COMMENT ON COLUMN property_feature_flags.depends_on IS 'Array of feature codes that must be enabled before this feature';
COMMENT ON COLUMN property_feature_flags.conflicts_with IS 'Array of feature codes that cannot be active simultaneously';
COMMENT ON COLUMN property_feature_flags.config IS 'Feature-specific configuration parameters (JSONB)';

-- =====================================================
-- SEED DATA: Standard feature flags (tenant placeholder)
-- =====================================================

INSERT INTO property_feature_flags (tenant_id, feature_code, feature_name, feature_module, is_enabled, feature_description)
VALUES
    ('00000000-0000-0000-0000-000000000000', 'mobile_checkin',       'Mobile Check-In',            'GUEST_EXPERIENCE', TRUE,  'Allow guests to check in via mobile app'),
    ('00000000-0000-0000-0000-000000000000', 'mobile_key',           'Mobile Room Key',            'GUEST_EXPERIENCE', FALSE, 'Digital room key via mobile app'),
    ('00000000-0000-0000-0000-000000000000', 'comp_accounting',      'Comp Accounting',            'BILLING',          FALSE, 'Complimentary charge tracking and authorization'),
    ('00000000-0000-0000-0000-000000000000', 'self_service_kiosk',   'Self-Service Kiosk',         'GUEST_EXPERIENCE', FALSE, 'Guest self-check-in kiosks in lobby'),
    ('00000000-0000-0000-0000-000000000000', 'dynamic_pricing',      'Dynamic Pricing',            'REVENUE',          TRUE,  'AI-driven demand-based rate adjustments'),
    ('00000000-0000-0000-0000-000000000000', 'function_rooms',       'Function Room Management',   'EVENTS',           FALSE, 'Meeting rooms and event bookings module'),
    ('00000000-0000-0000-0000-000000000000', 'pet_friendly',         'Pet Management',             'OPERATIONS',       FALSE, 'Pet registration and pet-friendly room tracking'),
    ('00000000-0000-0000-0000-000000000000', 'loyalty_program',      'Loyalty Program',            'GUEST_EXPERIENCE', TRUE,  'Guest loyalty tiers, points, and rewards'),
    ('00000000-0000-0000-0000-000000000000', 'channel_manager',      'Channel Manager Integration','INTEGRATIONS',     FALSE, 'Two-way OTA channel manager sync'),
    ('00000000-0000-0000-0000-000000000000', 'data_retention',       'Data Retention Engine',      'COMPLIANCE',       TRUE,  'Automated GDPR data retention and purge sweeps'),
    ('00000000-0000-0000-0000-000000000000', 'smart_rooms',          'Smart Room Controls',        'OPERATIONS',       FALSE, 'IoT device management and in-room automation'),
    ('00000000-0000-0000-0000-000000000000', 'spa_management',       'Spa & Wellness',             'OPERATIONS',       FALSE, 'Spa treatments and appointment booking'),
    ('00000000-0000-0000-0000-000000000000', 'transportation',       'Transportation Services',    'OPERATIONS',       FALSE, 'Shuttle and vehicle fleet management'),
    ('00000000-0000-0000-0000-000000000000', 'lost_business',        'Lost Business Tracking',     'REVENUE',          TRUE,  'Turnaway and regret tracking for demand analysis')
ON CONFLICT DO NOTHING;

\echo 'property_feature_flags table created successfully!'
