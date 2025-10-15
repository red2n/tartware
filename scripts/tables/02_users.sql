-- =====================================================
-- users.sql
-- Users Table
-- Industry Standard: Authentication and user management
-- Pattern: Oracle OPERA Cloud, Cloudbeds, Protel PMS
-- Date: 2025-10-15
-- =====================================================

\c tartware

\echo 'Creating users table...'

-- =====================================================
-- USERS TABLE
-- System users with authentication
-- Users can belong to multiple tenants (many-to-many)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Authentication
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,

    -- Profile Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(500),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    email_verified_at TIMESTAMP,

    -- Security
    last_login_at TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,

    -- Preferences (JSONB)
    preferences JSONB DEFAULT '{
        "language": "en",
        "timezone": "UTC",
        "dateFormat": "YYYY-MM-DD",
        "timeFormat": "HH:mm",
        "currency": "USD",
        "notifications": {
            "email": true,
            "sms": false,
            "push": true
        }
    }'::jsonb,

    -- Custom Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Audit Fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Soft Delete
    deleted_at TIMESTAMP,
    deleted_by VARCHAR(100),

    -- Optimistic Locking
    version BIGINT DEFAULT 0,

    -- Constraints
    CONSTRAINT users_username_format CHECK (username ~ '^[a-zA-Z0-9_.-]+$'),
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_failed_attempts_check CHECK (failed_login_attempts >= 0)
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE users IS 'System users with authentication and profile information';
COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.username IS 'Unique username for login';
COMMENT ON COLUMN users.email IS 'Unique email address';
COMMENT ON COLUMN users.password_hash IS 'Hashed password (bcrypt, argon2, etc.)';
COMMENT ON COLUMN users.is_active IS 'User account active status';
COMMENT ON COLUMN users.is_verified IS 'Email verification status';
COMMENT ON COLUMN users.failed_login_attempts IS 'Failed login counter for security';
COMMENT ON COLUMN users.locked_until IS 'Account lock timestamp (NULL = not locked)';
COMMENT ON COLUMN users.preferences IS 'User preferences (JSONB)';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Users table created successfully!'
