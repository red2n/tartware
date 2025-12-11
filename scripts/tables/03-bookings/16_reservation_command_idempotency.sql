-- =====================================================
-- reservation_command_idempotency.sql
-- Tracks idempotent command requests and their ACK status
-- =====================================================

\c tartware

\echo 'Creating reservation_command_idempotency table...'

CREATE TABLE IF NOT EXISTS reservation_command_idempotency (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    command_type VARCHAR(64) NOT NULL,
    resource_id UUID,
    payload JSONB,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING | ACKED | FAILED
    event_id UUID,
    correlation_id VARCHAR(128),
    response JSONB,
    last_error TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    locked_by VARCHAR(64),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_res_cmd_idem_status ON reservation_command_idempotency (status);
CREATE INDEX IF NOT EXISTS idx_res_cmd_idem_updated ON reservation_command_idempotency (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_res_cmd_idem_retry_window
  ON reservation_command_idempotency (next_retry_at)
  WHERE status = 'FAILED';

CREATE OR REPLACE FUNCTION trg_res_cmd_idem_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_res_cmd_idem_updated ON reservation_command_idempotency;
CREATE TRIGGER trg_res_cmd_idem_updated
BEFORE UPDATE ON reservation_command_idempotency
FOR EACH ROW
EXECUTE FUNCTION trg_res_cmd_idem_updated_at();

\echo 'reservation_command_idempotency table ready.'
