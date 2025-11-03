-- =====================================================
-- verify-all.sql
-- Master Verification Script - Run All Validations
-- Date: 2025-10-21
--
-- Purpose: Comprehensive validation of entire database setup
-- Updated: Auto-detects object counts across 7 domains
--
-- Usage: psql -U postgres -d tartware -f verify-all.sql
-- =====================================================

\c tartware

\echo ''
\echo '██████████████████████████████████████████████████'
\echo '█                                                █'
\echo '█    TARTWARE PMS - COMPLETE VERIFICATION       █'
\echo '█    Database Quality Assurance Suite           █'
\echo '█                                                █'
\echo '██████████████████████████████████████████████████'
\echo ''

-- Record start time
\set start_time `date +%s`

-- =====================================================
-- PHASE 1: TABLES VERIFICATION
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  PHASE 1: TABLES VERIFICATION'
\echo '======================================================'
\echo ''
\i tables/verify-tables.sql

-- =====================================================
-- PHASE 2: INDEXES VERIFICATION
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  PHASE 2: INDEXES VERIFICATION'
\echo '======================================================'
\echo ''
\i indexes/verify-indexes.sql

-- =====================================================
-- PHASE 3: CONSTRAINTS VERIFICATION
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  PHASE 3: CONSTRAINTS VERIFICATION'
\echo '======================================================'
\echo ''
\i constraints/verify-constraints.sql

-- =====================================================
-- PHASE 4: PROCEDURES VERIFICATION
-- =====================================================
\echo ''
\echo '======================================================'
\echo '  PHASE 4: PROCEDURES VERIFICATION'
\echo '======================================================'
\echo ''
\i procedures/verify-procedures.sql

-- =====================================================
-- FINAL SUMMARY
-- =====================================================
\echo ''
\echo '██████████████████████████████████████████████████'
\echo '█                                                █'
\echo '█    COMPLETE VERIFICATION SUMMARY               █'
\echo '█                                                █'
\echo '██████████████████████████████████████████████████'
\echo ''

DO $$
DECLARE
    v_table_count INTEGER;
    v_index_count INTEGER;
    v_constraint_count INTEGER;
    v_trigger_count INTEGER;
    v_procedure_count INTEGER;
    v_soft_delete_count INTEGER;
    v_tenant_id_count INTEGER;
    v_index_per_table NUMERIC := 0;
    v_fk_per_table NUMERIC := 0;
    v_soft_delete_ratio NUMERIC := 0;
    v_tenant_ratio NUMERIC := 0;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema IN ('public', 'availability')
        AND table_type = 'BASE TABLE';

    -- Count indexes
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE schemaname IN ('public', 'availability');

    -- Count foreign key constraints
    SELECT COUNT(*) INTO v_constraint_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema IN ('public', 'availability');

    -- Count triggers
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE trigger_schema IN ('public', 'availability');

    -- Count procedures
    SELECT COUNT(*) INTO v_procedure_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
        AND p.proname IN (
            'upsert_guest', 'merge_duplicate_guests', 'bulk_upsert_guests',
            'sync_channel_availability', 'sync_channel_reservations', 'sync_channel_mapping',
            'sync_rate_plans', 'apply_seasonal_rate_adjustments', 'sync_daily_rate_overrides',
            'copy_rate_plan', 'aggregate_daily_metrics', 'aggregate_monthly_metrics',
            'calculate_revenue_metrics', 'sync_metric_dimensions'
        );

    -- Count soft delete implementations
    SELECT COUNT(DISTINCT table_name) INTO v_soft_delete_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND column_name = 'deleted_at';

    -- Count tenant_id implementations
    SELECT COUNT(DISTINCT table_name) INTO v_tenant_id_count
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'availability')
        AND column_name = 'tenant_id';

    -- Compute derived metrics
    IF v_table_count > 0 THEN
        v_index_per_table := v_index_count::NUMERIC / v_table_count;
        v_fk_per_table := v_constraint_count::NUMERIC / v_table_count;
        v_soft_delete_ratio := (v_soft_delete_count::NUMERIC / v_table_count) * 100;
        v_tenant_ratio := (v_tenant_id_count::NUMERIC / v_table_count) * 100;
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '┌──────────────────────────────────────────────────────────────┐';
    RAISE NOTICE '│  DATABASE COMPONENT SUMMARY                                  │';
    RAISE NOTICE '├──────────────────────────────────────────────────────────────┤';
    RAISE NOTICE '│                                                              │';
    RAISE NOTICE '│  Tables (public+availability):      %                      │', LPAD(v_table_count::TEXT, 5, ' ');
    RAISE NOTICE '│  Indexes:                           %                      │', LPAD(v_index_count::TEXT, 5, ' ');
    RAISE NOTICE '│  Foreign Keys:                      %                      │', LPAD(v_constraint_count::TEXT, 5, ' ');
    RAISE NOTICE '│  Triggers:                          %                      │', LPAD(v_trigger_count::TEXT, 5, ' ');
    RAISE NOTICE '│  Stored Procedures (tracked set):   %                      │', LPAD(v_procedure_count::TEXT, 5, ' ');
    RAISE NOTICE '│                                                              │';
    RAISE NOTICE '│  Avg indexes per table:             %                      │', TO_CHAR(v_index_per_table, 'FM99990.00');
    RAISE NOTICE '│  Avg foreign keys per table:        %                      │', TO_CHAR(v_fk_per_table, 'FM99990.00');
    RAISE NOTICE '│  Soft delete coverage:              %                      │', TO_CHAR(v_soft_delete_ratio, 'FM99990.00') || '%';
    RAISE NOTICE '│  Multi-tenant coverage:             %                      │', TO_CHAR(v_tenant_ratio, 'FM99990.00') || '%';
    RAISE NOTICE '│                                                              │';
    RAISE NOTICE '└──────────────────────────────────────────────────────────────┘';
    RAISE NOTICE '';
    RAISE NOTICE 'All counts above are pulled dynamically from the current catalog metadata.';
    RAISE NOTICE '';

    IF v_table_count = 0 THEN
        RAISE WARNING 'No tables detected in target schemas.';
    END IF;
    IF v_index_count = 0 THEN
        RAISE WARNING 'No indexes detected in target schemas.';
    END IF;
    IF v_constraint_count = 0 THEN
        RAISE WARNING 'No foreign keys detected in target schemas.';
    END IF;
    IF v_trigger_count = 0 THEN
        RAISE WARNING 'No triggers detected in target schemas.';
    END IF;
END $$;

\echo ''
\echo '======================================================'
\echo '  ADDITIONAL HEALTH CHECKS'
\echo '======================================================'
\echo ''

-- Check database size
\echo 'Database size:'
\echo '----------------------------------------------------'
SELECT
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = 'tartware';

\echo ''

-- Check schema sizes
\echo 'Schema sizes:'
\echo '----------------------------------------------------'
SELECT
    schemaname,
    pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))::BIGINT) AS total_size,
    COUNT(*) AS table_count
FROM pg_tables
WHERE schemaname IN ('public', 'availability')
GROUP BY schemaname
ORDER BY SUM(pg_total_relation_size(schemaname||'.'||tablename)) DESC;

\echo ''

-- Check for missing indexes on foreign keys
\echo 'Foreign keys without indexes (if any):'
\echo '----------------------------------------------------'
WITH fk_no_index AS (
    SELECT
        tc.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    EXCEPT
    SELECT
        tablename,
        (string_to_array(
            regexp_replace(indexdef, '.*\((.*)\)', '\1'),
            ', '
        ))[1]
    FROM pg_indexes
    WHERE schemaname = 'public'
)
SELECT
    COALESCE(table_name, 'None') AS table_name,
    COALESCE(column_name, '✓ All foreign keys are indexed!') AS column_name
FROM fk_no_index
LIMIT 10;

\echo ''
\echo '======================================================'
\echo '  VERIFICATION COMPLETE'
\echo '======================================================'
\echo ''
\echo 'For detailed component verification, run:'
\echo '  • psql -U postgres -d tartware -f tables/verify-tables.sql'
\echo '  • psql -U postgres -d tartware -f indexes/verify-indexes.sql'
\echo '  • psql -U postgres -d tartware -f constraints/verify-constraints.sql'
\echo '  • psql -U postgres -d tartware -f procedures/verify-procedures.sql'
\echo ''
\echo 'Report generated: '`date`
\echo ''
