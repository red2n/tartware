-- =====================================================
-- 85_ar_dunning_events.sql
-- AR Dunning Events — Dunning Action Log
-- Industry Standard: USALI 12th Ed §4.3, Collection Best Practices
-- Pattern: Append-only event log; never updated after creation
-- Date: 2025-07-15
-- =====================================================

\c tartware

CREATE TABLE IF NOT EXISTS ar_dunning_events (
    dunning_event_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- Surrogate PK
    tenant_id           UUID NOT NULL,                                 -- Tenant scope
    property_id         UUID NOT NULL,                                 -- Property scope
    ar_account_id       UUID NOT NULL,                                 -- FK to ar_accounts

    -- Event classification
    event_type          VARCHAR(30) NOT NULL                           -- Type of dunning action
        CHECK (event_type IN (
            'FIRST_REMINDER',     -- 30-day reminder
            'SECOND_WARNING',     -- 60-day warning
            'COLLECTIONS_REFERRAL', -- 90+ day escalation
            'SUPPRESS',           -- Dunning suppressed (e.g. payment plan agreed)
            'RESUME'              -- Dunning reinstated
        )),

    -- Targeting
    entry_ids           UUID[],                                        -- Specific city ledger entries affected (NULL = whole account)
    amount_overdue      NUMERIC(14, 2),                                -- Total overdue at time of event
    currency            CHAR(3) NOT NULL DEFAULT 'USD',

    -- Suppress mode (populated for SUPPRESS events)
    suppressed_until    DATE,                                          -- Suppress dunning until this date
    suppress_reason     TEXT,                                          -- Reason for suppression

    -- Communication
    communication_sent  BOOLEAN NOT NULL DEFAULT FALSE,               -- Whether a letter/email was dispatched
    communication_ref   VARCHAR(255),                                  -- Reference to notification event

    -- Notes
    notes               TEXT,

    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by          UUID
);

CREATE INDEX IF NOT EXISTS ar_dunning_events_account_idx
    ON ar_dunning_events (tenant_id, ar_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ar_dunning_events_type_idx
    ON ar_dunning_events (tenant_id, event_type, created_at DESC);

COMMENT ON TABLE ar_dunning_events IS
    'Append-only log of all dunning actions taken on AR accounts. Drives escalation rules and provides an auditable collection history.';
COMMENT ON COLUMN ar_dunning_events.suppress_reason IS
    'Reason why dunning was suppressed — e.g. payment plan agreed, dispute in progress.';

\echo 'ar_dunning_events table created successfully!'
