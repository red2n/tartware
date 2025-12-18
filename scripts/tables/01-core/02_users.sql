-- =====================================================
-- users.sql
-- Users Table
-- Industry Standard: Authentication and user management
-- Pattern: Oracle OPERA Cloud, Cloudbeds, Protel PMS
-- Date: 2025-10-15
-- =====================================================

\c tartware \echo 'Creating users table...'

-- =====================================================
-- USERS TABLE
-- System users with authentication
-- Users can belong to multiple tenants (many-to-many)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Stable identity shared across tenants

-- Authentication
username VARCHAR(100) UNIQUE NOT NULL, -- Login credential (enforced unique)
email VARCHAR(255) UNIQUE NOT NULL, -- Used for password reset and notifications
password_hash VARCHAR(255) NOT NULL, -- Bcrypt/argon2 hash of the credential

-- Profile Information
first_name VARCHAR(100) NOT NULL, -- Legal first name
last_name VARCHAR(100) NOT NULL, -- Legal last name
phone VARCHAR(20), -- Optional contact number for alerts/escalations
avatar_url VARCHAR(500), -- Profile photo or gravatar reference

-- Status
is_active BOOLEAN NOT NULL DEFAULT true, -- Indicates account availability
is_verified BOOLEAN NOT NULL DEFAULT false, -- Email verification flag
email_verified_at TIMESTAMP, -- Timestamp of verification

-- Security
last_login_at TIMESTAMP, -- Most recent successful login
failed_login_attempts INTEGER DEFAULT 0, -- Lockout counter
locked_until TIMESTAMP, -- Temporary lock expiry timestamp
mfa_secret VARCHAR(255), -- Secret for tenant MFA (TOTP)
mfa_enabled BOOLEAN NOT NULL DEFAULT false, -- Flag indicating MFA requirement
mfa_backup_codes JSONB DEFAULT '[]'::jsonb, -- Encrypted backup codes for recovery
password_rotated_at TIMESTAMP, -- Last time password rotation completed
password_reset_token VARCHAR(255), -- Single-use reset token hash
password_reset_expires TIMESTAMP, -- Expiration of reset token

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
    }'::jsonb, -- UI preferences and notification routing rules

-- Custom Metadata
metadata JSONB DEFAULT '{}'::jsonb, -- Integrations/extensions payload

-- Audit Fields
created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Creation timestamp
updated_at TIMESTAMP, -- Last profile update
created_by VARCHAR(100), -- Creator user id/identifier
updated_by VARCHAR(100), -- Last updater user id/identifier

-- Soft Delete
is_deleted BOOLEAN DEFAULT FALSE, -- Soft delete flag
deleted_at TIMESTAMP, -- Soft delete timestamp
deleted_by VARCHAR(100), -- Soft delete actor

-- Optimistic Locking
version BIGINT DEFAULT 0, -- Incremented to avoid concurrent overwrites

-- Constraints
CONSTRAINT users_username_format CHECK (username ~ '^[a-zA-Z0-9_.-]+$'), -- Limit username charset
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'), -- Basic email validation
    CONSTRAINT users_failed_attempts_check CHECK (failed_login_attempts >= 0) -- Prevent negative counters
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
COMMENT ON COLUMN users.mfa_enabled IS 'Indicates if tenant user must complete MFA';
COMMENT ON COLUMN users.mfa_secret IS 'TOTP secret for tenant MFA';
COMMENT ON COLUMN users.mfa_backup_codes IS 'JSON array of hashed MFA backup codes';
COMMENT ON COLUMN users.password_rotated_at IS 'Timestamp of last successful password rotation';

COMMENT ON COLUMN users.preferences IS 'User preferences (JSONB)';

COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp (NULL = active)';

\echo 'Users table created successfully!'
