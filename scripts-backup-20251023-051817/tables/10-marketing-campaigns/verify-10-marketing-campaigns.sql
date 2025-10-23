-- =====================================================
-- verify-10-marketing-campaigns.sql
-- Verification Script for Marketing & Campaigns Tables
-- Category: 10-marketing-campaigns (5 tables)
-- Date: 2025-10-19
-- =====================================================

\c tartware

\echo ''
\echo '=============================================='
\echo '  CATEGORY: MARKETING & CAMPAIGNS VERIFICATION'
\echo '  Tables: 5 | Description: Campaigns, promotions, referrals, social media'
\echo '=============================================='
\echo ''

-- =====================================================
-- 1. CHECK IF ALL TABLES EXIST
-- =====================================================
\echo '1. Checking if all 5 tables exist...'

DO $$
DECLARE
    v_expected_tables TEXT[] := ARRAY['marketing_campaigns', 'campaign_segments', 'promotional_codes', 'referral_tracking', 'social_media_mentions'];
    v_table TEXT;
    v_missing_tables TEXT[] := '{}'::TEXT[];
    v_found_count INTEGER := 0;
BEGIN
    FOREACH v_table IN ARRAY v_expected_tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = v_table
        ) THEN
            v_found_count := v_found_count + 1;
            RAISE NOTICE '  ✓ % exists', v_table;
        ELSE
            v_missing_tables := array_append(v_missing_tables, v_table);
            RAISE WARNING '  ✗ % is MISSING', v_table;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE WARNING 'Missing tables: %', array_to_string(v_missing_tables, ', ');
        RAISE EXCEPTION 'Marketing & Campaigns verification FAILED - missing tables!';
    ELSE
        RAISE NOTICE '✓✓✓ All 5 Marketing & Campaigns tables exist!';
    END IF;
END $$;

\echo ''

-- =====================================================
-- 2. CHECK TABLE STRUCTURE SUMMARY
-- =====================================================
\echo '2. Table structure summary...'

SELECT
    t.table_name,
    COUNT(c.column_name) AS column_count,
    COUNT(CASE WHEN c.column_name = 'tenant_id' THEN 1 END) AS has_tenant_id,
    COUNT(CASE WHEN c.column_name = 'is_deleted' THEN 1 END) AS has_soft_delete,
    COUNT(CASE WHEN c.column_name = 'created_at' THEN 1 END) AS has_audit
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_schema = c.table_schema
    AND t.table_name = c.table_name
WHERE t.table_name IN ('marketing_campaigns', 'campaign_segments', 'promotional_codes', 'referral_tracking', 'social_media_mentions')
    AND t.table_schema = 'public'
GROUP BY t.table_schema, t.table_name
ORDER BY t.table_name;

\echo ''

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '=============================================='
\echo '  VERIFICATION SUMMARY'
\echo '=============================================='

DO $$
DECLARE
    v_table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables t
    WHERE t.table_name IN ('marketing_campaigns', 'campaign_segments', 'promotional_codes', 'referral_tracking', 'social_media_mentions')
        AND t.table_schema = 'public';

    RAISE NOTICE '';
    RAISE NOTICE 'Category: Marketing & Campaigns';
    RAISE NOTICE 'Tables Found: % / 5', v_table_count;
    RAISE NOTICE '';

    IF v_table_count = 5 THEN
        RAISE NOTICE '✓✓✓ MARKETING & CAMPAIGNS VERIFICATION PASSED ✓✓✓';
    ELSE
        RAISE WARNING '⚠⚠⚠ MARKETING & CAMPAIGNS VERIFICATION FAILED ⚠⚠⚠';
        RAISE WARNING 'Expected 5 tables, found %', v_table_count;
    END IF;
END $$;

\echo ''
\echo '=============================================='
\echo 'Marketing & Campaigns verification complete!'
\echo '=============================================='
