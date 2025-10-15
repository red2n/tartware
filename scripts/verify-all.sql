-- =====================================================
-- verify-all.sql
-- Master Verification Script - Run All Validations
-- Date: 2025-10-15
--
-- Purpose: Comprehensive validation of entire database setup
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
    v_procedure_count INTEGER;
    v_soft_delete_count INTEGER;
    v_tenant_id_count INTEGER;
    v_total_score INTEGER := 0;
    v_max_score INTEGER := 100;
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

    RAISE NOTICE '';
    RAISE NOTICE '┌─────────────────────────────────────────────────┐';
    RAISE NOTICE '│  DATABASE COMPONENT SUMMARY                     │';
    RAISE NOTICE '├─────────────────────────────────────────────────┤';
    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '│  Tables:              % / 22                  │', LPAD(v_table_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Indexes:             % / 250+                │', LPAD(v_index_count::TEXT, 4, ' ');
    RAISE NOTICE '│  Foreign Keys:        % / 60+                 │', LPAD(v_constraint_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Procedures:          % / 14                  │', LPAD(v_procedure_count::TEXT, 3, ' ');
    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '│  Soft Delete:         % / 18                  │', LPAD(v_soft_delete_count::TEXT, 3, ' ');
    RAISE NOTICE '│  Multi-tenancy:       % / 20                  │', LPAD(v_tenant_id_count::TEXT, 3, ' ');
    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '└─────────────────────────────────────────────────┘';
    RAISE NOTICE '';

    -- Calculate score
    IF v_table_count >= 22 THEN v_total_score := v_total_score + 20; END IF;
    IF v_index_count >= 250 THEN v_total_score := v_total_score + 25;
    ELSIF v_index_count >= 200 THEN v_total_score := v_total_score + 15; END IF;
    IF v_constraint_count >= 60 THEN v_total_score := v_total_score + 20; END IF;
    IF v_procedure_count >= 14 THEN v_total_score := v_total_score + 15; END IF;
    IF v_soft_delete_count >= 18 THEN v_total_score := v_total_score + 10; END IF;
    IF v_tenant_id_count >= 20 THEN v_total_score := v_total_score + 10; END IF;

    RAISE NOTICE '┌─────────────────────────────────────────────────┐';
    RAISE NOTICE '│  QUALITY SCORE                                  │';
    RAISE NOTICE '├─────────────────────────────────────────────────┤';
    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '│  Score:  % / %                              │', LPAD(v_total_score::TEXT, 3, ' '), v_max_score;
    RAISE NOTICE '│                                                 │';

    IF v_total_score = v_max_score THEN
        RAISE NOTICE '│  Grade:  A+ (PERFECT) ✓✓✓                      │';
        RAISE NOTICE '│                                                 │';
        RAISE NOTICE '│  Status: Production Ready                       │';
    ELSIF v_total_score >= 90 THEN
        RAISE NOTICE '│  Grade:  A (EXCELLENT) ✓✓                       │';
        RAISE NOTICE '│                                                 │';
        RAISE NOTICE '│  Status: Production Ready                       │';
    ELSIF v_total_score >= 80 THEN
        RAISE NOTICE '│  Grade:  B (GOOD) ✓                             │';
        RAISE NOTICE '│                                                 │';
        RAISE NOTICE '│  Status: Minor improvements recommended         │';
    ELSIF v_total_score >= 70 THEN
        RAISE NOTICE '│  Grade:  C (ACCEPTABLE) ⚠                       │';
        RAISE NOTICE '│                                                 │';
        RAISE NOTICE '│  Status: Improvements needed                    │';
    ELSE
        RAISE NOTICE '│  Grade:  F (INCOMPLETE) ✗                       │';
        RAISE NOTICE '│                                                 │';
        RAISE NOTICE '│  Status: Critical issues found                  │';
    END IF;

    RAISE NOTICE '│                                                 │';
    RAISE NOTICE '└─────────────────────────────────────────────────┘';
    RAISE NOTICE '';

    -- Specific recommendations
    IF v_table_count < 22 THEN
        RAISE WARNING '⚠ Missing tables detected. Run tables scripts.';
    END IF;
    IF v_index_count < 250 THEN
        RAISE WARNING '⚠ Index count below target. Run index scripts.';
    END IF;
    IF v_constraint_count < 60 THEN
        RAISE WARNING '⚠ Missing constraints. Run constraint scripts.';
    END IF;
    IF v_procedure_count < 14 THEN
        RAISE WARNING '⚠ Missing procedures. Run procedure scripts.';
    END IF;

    IF v_total_score = v_max_score THEN
        RAISE NOTICE '🎉 Congratulations! Your database is perfectly configured!';
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
        string_to_array(
            regexp_replace(indexdef, '.*\((.*)\)', '\1'),
            ', '
        )[1]
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
