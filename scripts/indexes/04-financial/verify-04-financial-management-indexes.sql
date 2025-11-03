-- =====================================================
-- verify-04-financial-management-indexes.sql
-- Index Verification Script for Financial Management
-- Category: 04-financial-management (15 tables)
-- Date: 2025-10-19
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  FINANCIAL MANAGEMENT - INDEX VERIFICATION'
\echo '  Tables: 15'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK INDEX COUNT BY TABLE
-- =====================================================
\echo '1. Index count by table...'

SELECT
    tablename,
    COUNT(*) AS total_indexes,
    COUNT(CASE WHEN indexname LIKE '%_pkey' THEN 1 END) AS primary_keys,
    COUNT(CASE WHEN indexname NOT LIKE '%_pkey' THEN 1 END) AS secondary_indexes
FROM pg_indexes
WHERE tablename IN (
    'payments',
    'invoices',
    'invoice_items',
    'folios',
    'charge_postings',
    'refunds',
    'tax_configurations',
    'financial_closures',
    'commission_tracking',
    'cashier_sessions',
    'accounts_receivable',
    'credit_limits',
    'payment_tokens',
    'general_ledger_batches',
    'general_ledger_entries'
)
    AND schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- =====================================================
-- 2. CHECK FOREIGN KEY INDEXES
-- =====================================================
\echo '2. Checking if foreign key columns are indexed...'

WITH fk_columns AS (
    SELECT
        tc.table_name,
        kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN (
            'payments',
            'invoices',
            'invoice_items',
            'folios',
            'charge_postings',
            'refunds',
            'tax_configurations',
            'financial_closures',
            'commission_tracking',
            'cashier_sessions',
            'accounts_receivable',
            'credit_limits',
            'payment_tokens',
            'general_ledger_batches',
            'general_ledger_entries'
        )
),
indexed_columns AS (
    SELECT
        tablename,
        (string_to_array(
            regexp_replace(indexdef, '.*\((.*)\)', '\1'),
            ', '
        ))[1] AS column_name
    FROM pg_indexes
    WHERE tablename IN (
        'payments',
        'invoices',
        'invoice_items',
        'folios',
        'charge_postings',
        'refunds',
        'tax_configurations',
        'financial_closures',
        'commission_tracking',
        'cashier_sessions',
        'accounts_receivable',
        'credit_limits',
        'payment_tokens',
        'general_ledger_batches',
        'general_ledger_entries'
    )
        AND schemaname = 'public'
)
SELECT
    fk.table_name,
    fk.column_name,
    CASE
        WHEN ic.column_name IS NOT NULL THEN '✓ Indexed'
        ELSE '✗ Missing index'
    END AS status
FROM fk_columns fk
LEFT JOIN indexed_columns ic
    ON fk.table_name = ic.tablename
    AND fk.column_name = ic.column_name
ORDER BY
    CASE WHEN ic.column_name IS NULL THEN 0 ELSE 1 END,
    fk.table_name;

\echo ''

-- =====================================================
-- 3. CHECK PARTIAL INDEXES (for soft delete)
-- =====================================================
\echo '3. Checking partial indexes for soft delete...'

SELECT
    tablename,
    indexname,
    CASE
        WHEN indexdef LIKE '%WHERE%is_deleted = false%' OR indexdef LIKE '%WHERE%deleted_at IS NULL%'
        THEN '✓ Has soft delete filter'
        WHEN indexdef LIKE '%WHERE%' THEN '⚠ Has WHERE but not for soft delete'
        ELSE 'No partial index'
    END AS partial_index_status
FROM pg_indexes
WHERE tablename IN (
    'payments',
    'invoices',
    'invoice_items',
    'folios',
    'charge_postings',
    'refunds',
    'tax_configurations',
    'financial_closures',
    'commission_tracking',
    'cashier_sessions',
    'accounts_receivable',
    'credit_limits',
    'payment_tokens',
    'general_ledger_batches',
    'general_ledger_entries'
)
    AND schemaname = 'public'
    AND indexdef LIKE '%WHERE%'
ORDER BY tablename, indexname;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '=============================================='
\echo '  VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    v_total_indexes INTEGER;
    v_tables_with_indexes INTEGER;
    v_fk_without_index INTEGER;
BEGIN
    -- Count total indexes (excluding primary keys)
    SELECT COUNT(*) INTO v_total_indexes
    FROM pg_indexes
    WHERE tablename IN (
        'payments',
        'invoices',
        'invoice_items',
        'folios',
        'charge_postings',
        'refunds',
        'tax_configurations',
        'financial_closures',
        'commission_tracking',
        'cashier_sessions',
        'accounts_receivable',
        'credit_limits',
        'payment_tokens',
        'general_ledger_batches',
        'general_ledger_entries'
    )
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey';

    -- Count tables that have at least one secondary index
    SELECT COUNT(DISTINCT tablename) INTO v_tables_with_indexes
    FROM pg_indexes
    WHERE tablename IN (
            'payments',
            'invoices',
            'invoice_items',
            'folios',
            'charge_postings',
            'refunds',
            'tax_configurations',
            'financial_closures',
            'commission_tracking',
            'cashier_sessions',
            'accounts_receivable',
            'credit_limits',
            'payment_tokens',
            'general_ledger_batches',
            'general_ledger_entries'
        )
        AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey';

    -- Count FKs without indexes
    SELECT COUNT(*) INTO v_fk_without_index
    FROM (
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name IN (
                'payments',
                'invoices',
                'invoice_items',
                'folios',
                'charge_postings',
                'refunds',
                'tax_configurations',
                'financial_closures',
                'commission_tracking',
                'cashier_sessions',
                'accounts_receivable',
                'credit_limits',
                'payment_tokens',
                'general_ledger_batches',
                'general_ledger_entries'
            )
        EXCEPT
        SELECT
            tablename,
            (string_to_array(
                regexp_replace(indexdef, '.*\((.*)\)', '\1'),
                ', '
            ))[1]
        FROM pg_indexes
        WHERE tablename IN (
            'payments',
            'invoices',
            'invoice_items',
            'folios',
            'charge_postings',
            'refunds',
            'tax_configurations',
            'financial_closures',
            'commission_tracking',
            'cashier_sessions',
            'accounts_receivable',
            'credit_limits',
            'payment_tokens',
            'general_ledger_batches',
            'general_ledger_entries'
        )
            AND schemaname = 'public'
    ) missing;

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Financial Management';
    RAISE NOTICE 'Total Secondary Indexes: %', v_total_indexes;
    RAISE NOTICE 'Tables with Indexes: % / 15', v_tables_with_indexes;
    RAISE NOTICE 'Foreign Keys Without Index: %', v_fk_without_index;
    RAISE NOTICE '';

    IF v_fk_without_index = 0 AND v_tables_with_indexes = 15 THEN
        RAISE NOTICE '✓✓✓ FINANCIAL MANAGEMENT INDEX VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ FINANCIAL MANAGEMENT INDEX VERIFICATION ISSUES FOUND ⚠⚠⚠';
        IF v_fk_without_index > 0 THEN
            RAISE WARNING 'Found % foreign keys without indexes!', v_fk_without_index;
        END IF;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Financial Management index verification complete!'
\echo '=============================================='
