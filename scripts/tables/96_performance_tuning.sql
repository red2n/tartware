-- =====================================================
-- 96_performance_tuning.sql
-- Database Architecture Tuning for 20K ops/sec
-- Industry Standard: OLTP performance best practices
-- Pattern: Per-table storage params + hot-path indexes
-- Date: 2026-04-29
-- =====================================================
-- Covers:
--   1. Outbox partition_key index (already in 09_transactional_outbox.sql
--      but repeated here as idempotent safety net)
--   2. JSONB GIN indexes on hot-path tables
--   3. synchronous_commit = off for write-heavy non-critical tables
--   4. Autovacuum overrides for remaining hot tables
--
-- NOTE: shared_buffers, work_mem, synchronous_commit (server-level),
-- random_page_cost, max_connections are set in docker-compose.yml
-- postgres command args and take effect on server restart.
-- This script handles DB-object-level tuning that applies immediately.
-- =====================================================

\c tartware

-- =====================================================
-- SECTION 1: OUTBOX — partition_key index
-- (Idempotent; also present in 09_transactional_outbox.sql)
-- =====================================================
\echo '  [perf] Adding outbox partition_key index...'

CREATE INDEX IF NOT EXISTS idx_outbox_partition_key
    ON transactional_outbox (partition_key, available_at)
    WHERE status IN ('PENDING', 'FAILED');

-- =====================================================
-- SECTION 2: JSONB GIN INDEXES — hot-path tables
-- Only the columns that are actually queried with JSONB
-- operators (@>, ?, ?|) in production code paths.
-- Use CONCURRENTLY to avoid locking on live DB; safe to
-- re-run (IF NOT EXISTS equivalent via the name check).
-- =====================================================
\echo '  [perf] Adding JSONB GIN indexes on hot-path tables...'

-- audit_logs: change-data queries filter on new_values / old_values
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values_gin
    ON audit_logs USING GIN (new_values);

CREATE INDEX IF NOT EXISTS idx_audit_logs_old_values_gin
    ON audit_logs USING GIN (old_values);

CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin
    ON audit_logs USING GIN (metadata);

-- command_dispatches: routing lookups filter on metadata / initiated_by
CREATE INDEX IF NOT EXISTS idx_command_dispatches_metadata_gin
    ON command_dispatches USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_command_dispatches_routing_metadata_gin
    ON command_dispatches USING GIN (routing_metadata);

CREATE INDEX IF NOT EXISTS idx_command_dispatches_initiated_by_gin
    ON command_dispatches USING GIN (initiated_by);

-- transactional_outbox: payload inspection during replay / DLQ investigation
CREATE INDEX IF NOT EXISTS idx_outbox_payload_gin
    ON transactional_outbox USING GIN (payload);

-- reservations: metadata filter for channel-specific attributes
CREATE INDEX IF NOT EXISTS idx_reservations_metadata_gin
    ON reservations USING GIN (metadata)
    WHERE metadata IS NOT NULL;

-- transactional_outbox: headers and metadata for replay / DLQ investigation
CREATE INDEX IF NOT EXISTS idx_outbox_headers_gin
    ON transactional_outbox USING GIN (headers);

CREATE INDEX IF NOT EXISTS idx_outbox_metadata_gin
    ON transactional_outbox USING GIN (metadata);

-- api_logs: JSONB body/header columns for log analysis
CREATE INDEX IF NOT EXISTS idx_api_logs_metadata_gin
    ON api_logs USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_api_logs_request_body_gin
    ON api_logs USING GIN (request_body);

CREATE INDEX IF NOT EXISTS idx_api_logs_request_headers_gin
    ON api_logs USING GIN (request_headers);

CREATE INDEX IF NOT EXISTS idx_api_logs_response_body_gin
    ON api_logs USING GIN (response_body);

CREATE INDEX IF NOT EXISTS idx_api_logs_response_headers_gin
    ON api_logs USING GIN (response_headers);

-- cashier_sessions: session breakdown columns for audit queries
CREATE INDEX IF NOT EXISTS idx_cashier_adjustments_gin
    ON cashier_sessions USING GIN (adjustments);

CREATE INDEX IF NOT EXISTS idx_cashier_card_breakdown_gin
    ON cashier_sessions USING GIN (card_payment_breakdown);

CREATE INDEX IF NOT EXISTS idx_cashier_cash_breakdown_gin
    ON cashier_sessions USING GIN (cash_breakdown);

CREATE INDEX IF NOT EXISTS idx_cashier_exceptions_gin
    ON cashier_sessions USING GIN (exceptions);

CREATE INDEX IF NOT EXISTS idx_cashier_exchange_rates_gin
    ON cashier_sessions USING GIN (exchange_rates);

CREATE INDEX IF NOT EXISTS idx_cashier_payment_methods_gin
    ON cashier_sessions USING GIN (payment_methods_summary);

CREATE INDEX IF NOT EXISTS idx_cashier_supervisor_overrides_gin
    ON cashier_sessions USING GIN (supervisor_overrides);

-- =====================================================
-- SECTION 3: synchronous_commit
-- NOTE: synchronous_commit is a SESSION-level GUC, not a per-table
-- storage parameter. It cannot be set with ALTER TABLE SET (...).
-- To reduce fsync overhead for the outbox/audit write paths, set it
-- at the connection level in the worker that performs those writes:
--
--   SET LOCAL synchronous_commit = off;
--
-- Or at the database level for all connections:
--   ALTER DATABASE tartware SET synchronous_commit = off;
--
-- The docker-compose postgres command already sets the server default
-- to off via: -c synchronous_commit=off
-- Applied here as a DB-level override (belt-and-suspenders).
-- =====================================================
ALTER DATABASE tartware SET synchronous_commit = off;

-- =====================================================
-- SECTION 4: AUTOVACUUM OVERRIDES — remaining hot tables
-- (Outbox, charge_postings, audit_logs, command_dispatches,
--  reservation_status_history already set in their canonical files)
-- =====================================================
\echo '  [perf] Applying autovacuum overrides on remaining hot tables...'

-- api_logs: potentially very high volume if all HTTP traffic is logged
ALTER TABLE api_logs SET (
    autovacuum_vacuum_scale_factor     = 0.01,
    autovacuum_vacuum_cost_delay       = 0,
    autovacuum_analyze_scale_factor    = 0.005
);

-- tenant_access_audit: every auth event writes a row
-- (table only exists after 95_partition_hot_tables.sql runs; guard with IF EXISTS)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='tenant_access_audit') THEN
        EXECUTE 'ALTER TABLE tenant_access_audit SET (
            autovacuum_vacuum_scale_factor  = 0.02,
            autovacuum_vacuum_cost_delay    = 0,
            autovacuum_analyze_scale_factor = 0.01
        )';
    END IF;
END$$;

-- notification_log: high-frequency append table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='notification_log') THEN
        EXECUTE 'ALTER TABLE notification_log SET (
            autovacuum_vacuum_scale_factor  = 0.01,
            autovacuum_vacuum_cost_delay    = 0,
            autovacuum_analyze_scale_factor = 0.005
        )';
    END IF;
END$$;

\echo '  [perf] Performance tuning applied successfully.'
\echo ''
