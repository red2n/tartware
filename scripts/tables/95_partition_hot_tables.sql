-- =====================================================
-- 95_partition_hot_tables.sql
-- Range Partitioning for Append-Heavy Tables
-- Industry Standard: PostgreSQL declarative partitioning
-- Pattern: RANGE by created_at, monthly partitions
-- Date: 2026-04-29
-- =====================================================
-- USAGE:
--   This script is NOT automatically run by 00-create-all-tables.sql.
--   It is a migration to be applied once on an existing database.
--   On FRESH installs the tables are created unpartitioned (simpler);
--   apply this script to add partitioning when the DB is warmed up.
--
-- SAFE TO RUN ON: Empty or newly-seeded databases.
-- REQUIRES DOWNTIME for tables with existing data (rename + migrate).
--
-- Tables covered:
--   - transactional_outbox     (highest priority — Kafka relay polling)
--   - command_dispatches       (high volume — every command)
--   - audit_logs               (unbounded append)
--   - reservation_status_history (every status change)
--   - tenant_access_audit      (every auth event)
--
-- Partition strategy: RANGE by created_at, monthly granularity.
-- Retention: implement partition DROP to enforce data lifecycle (e.g. 90 days).
-- =====================================================

\c tartware

\echo '>>> Partitioning: transactional_outbox'

DO $$
DECLARE
    v_count BIGINT;
BEGIN
    -- Only proceed if table is currently unpartitioned
    IF (SELECT relkind FROM pg_class WHERE relname='transactional_outbox' AND relnamespace='public'::regnamespace) = 'r' THEN

        SELECT COUNT(*) INTO v_count FROM transactional_outbox;

        -- Step 1: Rename existing table to _legacy
        ALTER TABLE transactional_outbox RENAME TO transactional_outbox_legacy;
        RAISE NOTICE 'Renamed transactional_outbox -> transactional_outbox_legacy (% rows)', v_count;

        -- Step 2: Create partitioned replacement
        CREATE TABLE transactional_outbox (LIKE transactional_outbox_legacy INCLUDING ALL)
            PARTITION BY RANGE (created_at);

        -- Step 3: Initial partitions — current month + next 2
        EXECUTE format(
            'CREATE TABLE transactional_outbox_%s PARTITION OF transactional_outbox
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()), 'YYYY_MM'),
            date_trunc('month', NOW()),
            date_trunc('month', NOW()) + INTERVAL '1 month'
        );
        EXECUTE format(
            'CREATE TABLE transactional_outbox_%s PARTITION OF transactional_outbox
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()) + INTERVAL '1 month', 'YYYY_MM'),
            date_trunc('month', NOW()) + INTERVAL '1 month',
            date_trunc('month', NOW()) + INTERVAL '2 months'
        );
        -- Default catch-all partition for rows outside named partitions
        CREATE TABLE transactional_outbox_default PARTITION OF transactional_outbox DEFAULT;

        -- Step 4: Migrate data from legacy table
        IF v_count > 0 THEN
            INSERT INTO transactional_outbox SELECT * FROM transactional_outbox_legacy;
            RAISE NOTICE 'Migrated % rows into partitioned transactional_outbox', v_count;
        END IF;

        -- Step 5: Restore RLS
        ALTER TABLE transactional_outbox ENABLE ROW LEVEL SECURITY;
        -- Note: RLS policies are inherited by child partitions in PG16

        RAISE NOTICE 'transactional_outbox partitioning complete.';
    ELSE
        RAISE NOTICE 'transactional_outbox is already partitioned — skipping.';
    END IF;
END$$;

-- ── command_dispatches ───────────────────────────────────────────────────────
\echo '>>> Partitioning: command_dispatches'

DO $$
DECLARE v_count BIGINT;
BEGIN
    IF (SELECT relkind FROM pg_class WHERE relname='command_dispatches' AND relnamespace='public'::regnamespace) = 'r' THEN
        SELECT COUNT(*) INTO v_count FROM command_dispatches;
        ALTER TABLE command_dispatches RENAME TO command_dispatches_legacy;
        CREATE TABLE command_dispatches (LIKE command_dispatches_legacy INCLUDING ALL)
            PARTITION BY RANGE (created_at);
        EXECUTE format(
            'CREATE TABLE command_dispatches_%s PARTITION OF command_dispatches
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()), 'YYYY_MM'),
            date_trunc('month', NOW()),
            date_trunc('month', NOW()) + INTERVAL '1 month'
        );
        EXECUTE format(
            'CREATE TABLE command_dispatches_%s PARTITION OF command_dispatches
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()) + INTERVAL '1 month', 'YYYY_MM'),
            date_trunc('month', NOW()) + INTERVAL '1 month',
            date_trunc('month', NOW()) + INTERVAL '2 months'
        );
        CREATE TABLE command_dispatches_default PARTITION OF command_dispatches DEFAULT;
        IF v_count > 0 THEN
            INSERT INTO command_dispatches SELECT * FROM command_dispatches_legacy;
        END IF;
        ALTER TABLE command_dispatches ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'command_dispatches partitioning complete (% rows migrated).', v_count;
    ELSE
        RAISE NOTICE 'command_dispatches is already partitioned — skipping.';
    END IF;
END$$;

-- ── audit_logs ───────────────────────────────────────────────────────────────
\echo '>>> Partitioning: audit_logs'

DO $$
DECLARE v_count BIGINT;
BEGIN
    IF (SELECT relkind FROM pg_class WHERE relname='audit_logs' AND relnamespace='public'::regnamespace) = 'r' THEN
        SELECT COUNT(*) INTO v_count FROM audit_logs;
        ALTER TABLE audit_logs RENAME TO audit_logs_legacy;
        CREATE TABLE audit_logs (LIKE audit_logs_legacy INCLUDING ALL)
            PARTITION BY RANGE (created_at);
        EXECUTE format(
            'CREATE TABLE audit_logs_%s PARTITION OF audit_logs
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()), 'YYYY_MM'),
            date_trunc('month', NOW()),
            date_trunc('month', NOW()) + INTERVAL '1 month'
        );
        EXECUTE format(
            'CREATE TABLE audit_logs_%s PARTITION OF audit_logs
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()) + INTERVAL '1 month', 'YYYY_MM'),
            date_trunc('month', NOW()) + INTERVAL '1 month',
            date_trunc('month', NOW()) + INTERVAL '2 months'
        );
        CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;
        IF v_count > 0 THEN
            INSERT INTO audit_logs SELECT * FROM audit_logs_legacy;
        END IF;
        ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'audit_logs partitioning complete (% rows migrated).', v_count;
    ELSE
        RAISE NOTICE 'audit_logs is already partitioned — skipping.';
    END IF;
END$$;

-- ── reservation_status_history ───────────────────────────────────────────────
\echo '>>> Partitioning: reservation_status_history'

DO $$
DECLARE v_count BIGINT;
BEGIN
    IF (SELECT relkind FROM pg_class WHERE relname='reservation_status_history' AND relnamespace='public'::regnamespace) = 'r' THEN
        SELECT COUNT(*) INTO v_count FROM reservation_status_history;
        ALTER TABLE reservation_status_history RENAME TO reservation_status_history_legacy;
        CREATE TABLE reservation_status_history (LIKE reservation_status_history_legacy INCLUDING ALL)
            PARTITION BY RANGE (changed_at);
        EXECUTE format(
            'CREATE TABLE reservation_status_history_%s PARTITION OF reservation_status_history
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()), 'YYYY_MM'),
            date_trunc('month', NOW()),
            date_trunc('month', NOW()) + INTERVAL '1 month'
        );
        EXECUTE format(
            'CREATE TABLE reservation_status_history_%s PARTITION OF reservation_status_history
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()) + INTERVAL '1 month', 'YYYY_MM'),
            date_trunc('month', NOW()) + INTERVAL '1 month',
            date_trunc('month', NOW()) + INTERVAL '2 months'
        );
        CREATE TABLE reservation_status_history_default PARTITION OF reservation_status_history DEFAULT;
        IF v_count > 0 THEN
            INSERT INTO reservation_status_history SELECT * FROM reservation_status_history_legacy;
        END IF;
        ALTER TABLE reservation_status_history ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'reservation_status_history partitioning complete (% rows migrated).', v_count;
    ELSE
        RAISE NOTICE 'reservation_status_history is already partitioned — skipping.';
    END IF;
END$$;

-- ── tenant_access_audit ──────────────────────────────────────────────────────
\echo '>>> Partitioning: tenant_access_audit'

DO $$
DECLARE v_count BIGINT;
BEGIN
    IF (SELECT relkind FROM pg_class WHERE relname='tenant_access_audit' AND relnamespace='public'::regnamespace) = 'r' THEN
        SELECT COUNT(*) INTO v_count FROM tenant_access_audit;
        ALTER TABLE tenant_access_audit RENAME TO tenant_access_audit_legacy;
        CREATE TABLE tenant_access_audit (LIKE tenant_access_audit_legacy INCLUDING ALL)
            PARTITION BY RANGE (created_at);
        EXECUTE format(
            'CREATE TABLE tenant_access_audit_%s PARTITION OF tenant_access_audit
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()), 'YYYY_MM'),
            date_trunc('month', NOW()),
            date_trunc('month', NOW()) + INTERVAL '1 month'
        );
        EXECUTE format(
            'CREATE TABLE tenant_access_audit_%s PARTITION OF tenant_access_audit
             FOR VALUES FROM (%L) TO (%L)',
            to_char(date_trunc('month', NOW()) + INTERVAL '1 month', 'YYYY_MM'),
            date_trunc('month', NOW()) + INTERVAL '1 month',
            date_trunc('month', NOW()) + INTERVAL '2 months'
        );
        CREATE TABLE tenant_access_audit_default PARTITION OF tenant_access_audit DEFAULT;
        IF v_count > 0 THEN
            INSERT INTO tenant_access_audit SELECT * FROM tenant_access_audit_legacy;
        END IF;
        RAISE NOTICE 'tenant_access_audit partitioning complete (% rows migrated).', v_count;
    ELSE
        RAISE NOTICE 'tenant_access_audit is already partitioned — skipping.';
    END IF;
END$$;

\echo ''
\echo '>>> Partition migration complete.'
\echo '    NEXT STEPS:'
\echo '    1. Verify partitions: SELECT * FROM pg_partitioned_table;'
\echo '    2. Drop legacy tables when confident: DROP TABLE transactional_outbox_legacy CASCADE;'
\echo '    3. Add pg_partman for automatic monthly partition creation.'
\echo '    4. Schedule: DROP TABLE transactional_outbox_<old_month> for data retention.'
\echo ''
