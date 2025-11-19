-- =====================================================
-- 07_system_administrators.sql
-- Platform Super Administrator directory
-- Pattern: OWASP ASVS privileged account management
-- Date: 2025-11-19
-- =====================================================

\c tartware \echo 'Creating system_administrators table...'

CREATE TABLE IF NOT EXISTS system_administrators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(150) NOT NULL UNIQUE,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role system_admin_role NOT NULL,
    mfa_secret VARCHAR(255),
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    ip_whitelist INET[] NOT NULL DEFAULT '{}'::INET[],
    allowed_hours TSTZRANGE,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
    account_locked_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    created_by UUID REFERENCES system_administrators(id),
    updated_by UUID REFERENCES system_administrators(id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE system_administrators IS 'Platform-level administrators for multi-tenant operations';
COMMENT ON COLUMN system_administrators.ip_whitelist IS 'Allowed IPv4/IPv6 addresses or CIDR ranges';
COMMENT ON COLUMN system_administrators.allowed_hours IS 'Business-hour access window enforced via tstzrange';
COMMENT ON COLUMN system_administrators.metadata IS 'Structured metadata (trusted devices, break-glass indicators, etc.)';

CREATE INDEX IF NOT EXISTS idx_system_admins_role ON system_administrators(role);
CREATE INDEX IF NOT EXISTS idx_system_admins_last_login ON system_administrators(last_login_at DESC);

\echo 'system_administrators table created.'
