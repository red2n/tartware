-- =====================================================
-- drop-and-recreate.sql
-- Safely Drop and Recreate Tartware Database
--
-- WARNING: This will DELETE ALL DATA in the tartware database!
-- Only use in development/testing environments.
--
-- Date: October 15, 2025
-- =====================================================

-- Connect to postgres database (not tartware)
\c postgres

\echo ''
\echo '=============================================='
\echo '  TARTWARE DATABASE - DROP & RECREATE'
\echo '  ⚠️  WARNING: ALL DATA WILL BE DELETED'
\echo '=============================================='
\echo ''

-- =====================================================
-- STEP 1: TERMINATE ALL CONNECTIONS
-- =====================================================

\echo 'Step 1: Terminating all connections to tartware database...'

-- Terminate all active connections to tartware database
-- This is required before we can drop the database
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'tartware'
  AND pid <> pg_backend_pid();

\echo '✓ All connections terminated'
\echo ''

-- =====================================================
-- STEP 2: DROP DATABASE
-- =====================================================

\echo 'Step 2: Dropping tartware database (if exists)...'

-- Drop database if it exists
DROP DATABASE IF EXISTS tartware;

\echo '✓ Database dropped successfully'
\echo ''

-- =====================================================
-- STEP 3: CREATE FRESH DATABASE
-- =====================================================

\echo 'Step 3: Creating fresh tartware database...'

-- Create new database with proper settings
CREATE DATABASE tartware
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.utf8'
    LC_CTYPE = 'en_US.utf8'
    TABLESPACE = pg_default
    CONNECTION LIMIT = -1
    TEMPLATE template0;

\echo '✓ Fresh database created'
\echo ''

-- Add database comment
COMMENT ON DATABASE tartware IS 'Tartware Property Management System - Multi-tenant hospitality database';

-- =====================================================
-- VERIFICATION
-- =====================================================

\echo 'Verification:'
\echo '--------------------------------------------'

-- Verify database exists
SELECT
    datname as "Database",
    pg_encoding_to_char(encoding) as "Encoding",
    datcollate as "Collation",
    pg_size_pretty(pg_database_size(datname)) as "Size"
FROM pg_database
WHERE datname = 'tartware';

\echo ''
\echo '=============================================='
\echo '✓ DROP & RECREATE COMPLETE'
\echo '  Database: tartware'
\echo '  Status: Ready for initialization'
\echo '=============================================='
\echo ''
