-- =====================================================
-- 02_users_indexes.sql
-- Indexes for users table
-- Performance optimization for authentication and queries
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating indexes for users table...'

-- Authentication indexes (critical for login performance)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active ON users(username) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_active ON users(email) WHERE deleted_at IS NULL;

-- Lookup indexes
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_verified_at ON users(email_verified_at);

-- Security indexes
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_locked ON users(locked_until) WHERE locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_failed_attempts ON users(failed_login_attempts) WHERE failed_login_attempts > 0;

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_users_preferences_gin ON users USING GIN(preferences);
CREATE INDEX IF NOT EXISTS idx_users_metadata_gin ON users USING GIN(metadata);

-- Audit trail indexes
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users(updated_at);

-- Soft delete index
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Composite index for active verified users (common query)
CREATE INDEX IF NOT EXISTS idx_users_active_verified ON users(is_active, is_verified, deleted_at) WHERE deleted_at IS NULL;

\echo '✓ Users indexes created successfully!'
