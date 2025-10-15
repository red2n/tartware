-- =====================================================
-- 01-database-setup.sql
-- Initial Database Setup
-- Creates database, extensions, and schemas
-- Industry Standard: Oracle OPERA Cloud, Cloudbeds, Protel, RMS Cloud
-- Date: 2025-10-15
-- =====================================================

-- Create database (run this separately if needed)
-- CREATE DATABASE tartware;

-- Connect to database
\c tartware

-- =====================================================
-- EXTENSIONS
-- =====================================================

-- UUID generation (Industry Standard)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Optional: PostGIS for geolocation (if needed)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- SCHEMAS
-- =====================================================

-- Public schema (default) - for main tables
-- Availability schema - for high-volume availability data
CREATE SCHEMA IF NOT EXISTS availability;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON SCHEMA public IS 'Main schema for property management system tables';
COMMENT ON SCHEMA availability IS 'Dedicated schema for real-time room availability data (high-volume)';

-- =====================================================
-- ROLES AND PERMISSIONS (Optional - for production)
-- =====================================================

-- Example: Create application user
-- CREATE ROLE tartware_app WITH LOGIN PASSWORD 'change_me_in_production';
-- GRANT CONNECT ON DATABASE tartware TO tartware_app;
-- GRANT USAGE ON SCHEMA public, availability TO tartware_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tartware_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA availability TO tartware_app;

\echo 'Database setup complete!'
\echo 'Extensions: uuid-ossp'
\echo 'Schemas: public, availability'
