-- =====================================================
-- 112_pbx_configurations.sql
-- PBX / Telephony System Configuration
-- Industry Standard: OPERA PMS telephone integration,
--          Mitel/Avaya PBX interfaces, HTNG call accounting
-- Pattern: Property-level telephony config controlling
--          call permissions, wake-up calls, and billing rates
-- Date: 2026-02-18
-- =====================================================

-- =====================================================
-- PBX_CONFIGURATIONS TABLE
-- Property-level PBX integration settings. Defines call
-- allowances by room type, DID assignments, wake-up call
-- defaults, toll-free vs premium prefixes, and per-minute
-- charge rates for automatic call accounting / posting.
-- =====================================================

CREATE TABLE IF NOT EXISTS pbx_configurations (
    -- Primary Key
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),         -- Unique config identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                       -- FK tenants.id
    property_id UUID NOT NULL,                                     -- FK properties.id

    -- PBX System Identity
    config_name VARCHAR(200) NOT NULL,                             -- Human-readable config name (e.g., "Main PBX — Mitel 400")
    pbx_vendor VARCHAR(100),                                       -- Vendor/model: Mitel, Avaya, Cisco, Asterisk, etc.
    pbx_host VARCHAR(255),                                         -- PBX hostname or IP for SMDR/CDR feed
    pbx_port INTEGER,                                              -- Port for CDR data collection
    integration_protocol VARCHAR(50),                              -- SMDR, CDR, SIP, TAPI, REST, etc.

    -- Call Billing Rates (per-minute, in property currency)
    local_call_rate DECIMAL(8,4) DEFAULT 0,                        -- Rate per minute for local calls
    national_call_rate DECIMAL(8,4) DEFAULT 0,                     -- Rate per minute for national/long-distance
    international_call_rate DECIMAL(8,4) DEFAULT 0,                -- Rate per minute for international calls
    toll_free_rate DECIMAL(8,4) DEFAULT 0,                         -- Rate for toll-free (often 0)
    premium_rate DECIMAL(8,4) DEFAULT 0,                           -- Rate for premium/900 numbers
    service_charge_percentage DECIMAL(5,2) DEFAULT 0,              -- Markup on top of call cost (hospitality surcharge)
    minimum_charge DECIMAL(8,2) DEFAULT 0,                         -- Minimum charge per billable call

    -- Call Allowances
    free_local_minutes INTEGER DEFAULT 0,                          -- Complimentary local call minutes per stay
    free_national_minutes INTEGER DEFAULT 0,                       -- Complimentary national minutes per stay

    -- Prefix Configuration (JSONB for flexible prefix lists)
    local_prefixes JSONB DEFAULT '[]',                             -- Dialing prefixes considered "local"
    national_prefixes JSONB DEFAULT '[]',                          -- Prefixes for national calls
    international_prefix VARCHAR(10) DEFAULT '00',                 -- International dialing prefix
    emergency_numbers JSONB DEFAULT '["911","112","999"]',         -- Emergency numbers (always allowed, never billed)
    blocked_prefixes JSONB DEFAULT '[]',                           -- Blocked number prefixes (premium, adult, etc.)

    -- Wake-Up Call Defaults
    wakeup_enabled BOOLEAN DEFAULT TRUE,                           -- Property supports automated wake-up calls
    wakeup_retry_count INTEGER DEFAULT 3,                          -- Retries if guest doesn't answer
    wakeup_retry_interval_minutes INTEGER DEFAULT 5,               -- Minutes between retries
    wakeup_snooze_minutes INTEGER DEFAULT 10,                      -- Snooze duration

    -- Room Phone Defaults
    allow_outgoing_local BOOLEAN DEFAULT TRUE,                     -- Default: allow local outgoing calls
    allow_outgoing_national BOOLEAN DEFAULT FALSE,                 -- Default: allow national calls
    allow_outgoing_international BOOLEAN DEFAULT FALSE,            -- Default: allow international calls
    allow_room_to_room BOOLEAN DEFAULT TRUE,                       -- Allow inter-room calls
    auto_enable_on_checkin BOOLEAN DEFAULT TRUE,                   -- Auto-activate phone on check-in
    auto_disable_on_checkout BOOLEAN DEFAULT TRUE,                 -- Auto-deactivate phone on check-out
    auto_post_charges BOOLEAN DEFAULT TRUE,                        -- Auto-post call charges to guest folio

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,

    -- Constraints
    CONSTRAINT uq_pbx_config_per_property UNIQUE (tenant_id, property_id, config_name),
    CONSTRAINT chk_service_charge CHECK (service_charge_percentage >= 0 AND service_charge_percentage <= 100)
);

-- =====================================================
-- CALL_RECORDS TABLE
-- Individual telephone call detail records (CDR) received
-- from the PBX. Each record maps to a room, gets classified
-- by call type, and is posted as a charge to the guest folio.
-- =====================================================

CREATE TABLE IF NOT EXISTS call_records (
    -- Primary Key
    call_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),            -- Unique call record identifier

    -- Multi-tenancy
    tenant_id UUID NOT NULL,                                        -- FK tenants.id
    property_id UUID NOT NULL,                                      -- FK properties.id

    -- PBX Reference
    pbx_config_id UUID,                                             -- FK pbx_configurations.config_id
    pbx_call_id VARCHAR(100),                                       -- PBX-native call identifier (from CDR)

    -- Room & Guest Association
    room_id UUID,                                                   -- FK rooms.room_id
    room_number VARCHAR(20),                                        -- Denormalized room number for quick display
    reservation_id UUID,                                            -- FK reservations.reservation_id
    guest_id UUID,                                                  -- FK guest_profiles.guest_id

    -- Extension Info
    extension_number VARCHAR(20),                                   -- Source phone extension
    trunk_line VARCHAR(50),                                         -- Trunk/line used

    -- Call Details
    call_direction VARCHAR(10) NOT NULL CHECK (
        call_direction IN ('INBOUND', 'OUTBOUND', 'INTERNAL')
    ),                                                              -- Direction of the call
    call_type VARCHAR(20) NOT NULL CHECK (
        call_type IN ('LOCAL', 'NATIONAL', 'INTERNATIONAL', 'TOLL_FREE',
                      'PREMIUM', 'INTERNAL', 'EMERGENCY', 'WAKEUP', 'VOICEMAIL')
    ),                                                              -- Classification for billing
    dialed_number VARCHAR(50),                                      -- Number dialed (masked for privacy if configured)
    caller_id VARCHAR(50),                                          -- Incoming caller ID (if available)
    call_started_at TIMESTAMP WITH TIME ZONE NOT NULL,              -- When the call started
    call_answered_at TIMESTAMP WITH TIME ZONE,                      -- When the call was answered (NULL = missed)
    call_ended_at TIMESTAMP WITH TIME ZONE,                         -- When the call ended
    duration_seconds INTEGER DEFAULT 0,                             -- Total duration in seconds
    billable_seconds INTEGER DEFAULT 0,                             -- Billable duration (may differ from total)

    -- Call Status
    call_status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (
        call_status IN ('COMPLETED', 'MISSED', 'BUSY', 'NO_ANSWER', 'FAILED', 'BLOCKED')
    ),                                                              -- Outcome of the call
    is_answered BOOLEAN DEFAULT FALSE,                              -- Was the call answered

    -- Billing
    rate_per_minute DECIMAL(8,4) DEFAULT 0,                         -- Applied rate per minute
    base_cost DECIMAL(10,2) DEFAULT 0,                              -- Raw call cost (rate × minutes)
    service_charge DECIMAL(10,2) DEFAULT 0,                         -- Hotel surcharge amount
    total_charge DECIMAL(10,2) DEFAULT 0,                           -- Final charge (base + service)
    currency_code VARCHAR(3) DEFAULT 'USD',                         -- Currency
    is_billable BOOLEAN DEFAULT TRUE,                               -- Whether this call should be billed
    is_posted BOOLEAN DEFAULT FALSE,                                -- Has the charge been posted to folio
    posted_at TIMESTAMP WITH TIME ZONE,                             -- When charge was posted
    folio_id UUID,                                                  -- FK folios.folio_id (charge posted to)
    charge_posting_id UUID,                                         -- FK charge_postings.posting_id

    -- Wake-Up Call Fields
    is_wakeup_call BOOLEAN DEFAULT FALSE,                           -- Is this a wake-up call
    wakeup_scheduled_time TIME,                                     -- Requested wake-up time
    wakeup_attempt_number INTEGER,                                  -- Which retry attempt (1, 2, 3...)
    wakeup_confirmed BOOLEAN,                                       -- Did guest confirm / answer

    -- Audit Fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Soft Delete
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pbx_config_active ON pbx_configurations (tenant_id, property_id, is_active);
CREATE INDEX IF NOT EXISTS idx_call_records_room ON call_records (room_id, call_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_records_reservation ON call_records (reservation_id) WHERE reservation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_records_unposted ON call_records (tenant_id, property_id, is_posted) WHERE is_posted = FALSE AND is_billable = TRUE;
CREATE INDEX IF NOT EXISTS idx_call_records_wakeup ON call_records (property_id, is_wakeup_call, wakeup_scheduled_time) WHERE is_wakeup_call = TRUE;

-- =====================================================
-- TABLE & COLUMN COMMENTS
-- =====================================================

COMMENT ON TABLE pbx_configurations IS 'Property-level PBX/telephony integration settings: call rates, allowances, wake-up defaults, and phone permissions';
COMMENT ON COLUMN pbx_configurations.integration_protocol IS 'Protocol for receiving CDR data: SMDR (serial), CDR (file), SIP (event), TAPI, REST API';
COMMENT ON COLUMN pbx_configurations.service_charge_percentage IS 'Hotel surcharge on top of raw call cost — industry standard markup for telephone service';
COMMENT ON COLUMN pbx_configurations.auto_post_charges IS 'When TRUE, call charges are automatically posted to the guest folio without front desk intervention';

COMMENT ON TABLE call_records IS 'Individual telephone call detail records from PBX — tracks duration, cost, and folio posting status';
COMMENT ON COLUMN call_records.call_type IS 'Call classification for billing: LOCAL, NATIONAL, INTERNATIONAL, TOLL_FREE, PREMIUM, INTERNAL, EMERGENCY, WAKEUP, VOICEMAIL';
COMMENT ON COLUMN call_records.billable_seconds IS 'Billable duration — may differ from total (e.g., first 60s free, minimum billing increments)';
COMMENT ON COLUMN call_records.is_posted IS 'TRUE once the charge has been successfully posted to the guest folio via charge_postings';

\echo 'pbx_configurations and call_records tables created successfully!'
