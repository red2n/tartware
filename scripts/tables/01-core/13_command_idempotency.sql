-- =====================================================
-- command_idempotency.sql
-- P1-1: Consumer-side command idempotency table
-- Prevents duplicate processing of retried Kafka messages
-- =====================================================

\echo 'Creating command_idempotency table...'

CREATE TABLE IF NOT EXISTS command_idempotency (
    tenant_id       UUID          NOT NULL, -- Tenant scope for isolation
    idempotency_key VARCHAR(200)  NOT NULL, -- Client-supplied deduplication key
    command_name    VARCHAR(150)  NOT NULL, -- Processed command type
    command_id      UUID, -- Optional originating command identifier
    processed_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(), -- When processing completed
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(), -- Row creation for TTL cleanup

    CONSTRAINT pk_command_idempotency PRIMARY KEY (tenant_id, idempotency_key)
);

COMMENT ON TABLE command_idempotency IS 'Consumer-side dedup table. Prevents double-processing of retried Kafka command messages.';
COMMENT ON COLUMN command_idempotency.idempotency_key IS 'Client-provided key or derived from commandId/requestId. Unique per tenant.';
COMMENT ON COLUMN command_idempotency.command_name IS 'The command that was processed (e.g. reservation.create).';
COMMENT ON COLUMN command_idempotency.processed_at IS 'Timestamp when the command was successfully processed.';

-- Index for TTL cleanup (expire old entries after 7 days)
CREATE INDEX IF NOT EXISTS idx_command_idempotency_created
    ON command_idempotency (created_at);

-- Index for fast lookups during idempotency checks
CREATE INDEX IF NOT EXISTS idx_command_idempotency_tenant_cmd
    ON command_idempotency (tenant_id, command_name, idempotency_key);

\echo 'command_idempotency table created.'
