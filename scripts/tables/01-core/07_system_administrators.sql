-- =====================================================
-- 07_system_administrators.sql
-- Platform Super Administrator directory
-- Pattern: OWASP ASVS privileged account management
-- Date: 2025-11-19
-- =====================================================
-- Compliance Mapping: docs/compliance-mapping.md#sox--platform-audit--access

\c tartware \echo 'Creating system_administrators table...'

CREATE TABLE IF NOT EXISTS system_administrators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (), -- Unique system administrator identifier
    username VARCHAR(150) NOT NULL UNIQUE, -- Unique username for login
    email VARCHAR(254) NOT NULL UNIQUE, -- Unique email address
    password_hash VARCHAR(255) NOT NULL, -- Hashed password using strong algorithm (e.g., bcrypt, Argon2)
    role system_admin_role NOT NULL, -- Role defining permissions (e.g., SUPER_ADMIN, AUDITOR)
    mfa_secret VARCHAR(255), -- Secret for multi-factor authentication (e.g., TOTP)
    mfa_enabled BOOLEAN NOT NULL DEFAULT false, -- Is multi-factor authentication enabled
    ip_whitelist INET[] NOT NULL DEFAULT '{}'::INET[], -- Allowed IP addresses or CIDR ranges
    allowed_hours TSTZRANGE, -- Allowed access time window (e.g., business hours)
    last_login_at TIMESTAMPTZ, -- Timestamp of the last successful login
    failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0), -- Count of consecutive failed login attempts
    account_locked_until TIMESTAMPTZ, -- If locked, timestamp until which account is locked
    is_active BOOLEAN NOT NULL DEFAULT true, -- Is the administrator account active
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Timestamp of account creation
    updated_at TIMESTAMPTZ, -- Timestamp of last account update
    created_by UUID REFERENCES system_administrators (id), -- Creator system administrator
    updated_by UUID REFERENCES system_administrators (id), -- Last updater system administrator
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb -- Additional structured metadata   (trusted devices, break-glass indicators, etc.)
);

COMMENT ON TABLE system_administrators IS 'Platform-level administrators for multi-tenant operations (see docs/compliance-mapping.md#sox--platform-audit--access)';

COMMENT ON COLUMN system_administrators.ip_whitelist IS 'Allowed IPv4/IPv6 addresses or CIDR ranges';

COMMENT ON COLUMN system_administrators.allowed_hours IS 'Business-hour access window enforced via tstzrange';

COMMENT ON COLUMN system_administrators.metadata IS 'Structured metadata (trusted devices, break-glass indicators, etc.)';

CREATE INDEX IF NOT EXISTS idx_system_admins_role ON system_administrators (role);

CREATE INDEX IF NOT EXISTS idx_system_admins_last_login ON system_administrators (last_login_at DESC);

\echo 'system_administrators table created.'
