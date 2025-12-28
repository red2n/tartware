-- =====================================================
-- 11_system_admin_break_glass_codes.sql
-- Offline break-glass backup codes for platform administrators
-- Pattern: OWASP ASVS 2.1.7 emergency access controls
-- Date: 2025-12-26
-- =====================================================

\c tartware \echo 'Creating system_admin_break_glass_codes table...'

CREATE TABLE IF NOT EXISTS system_admin_break_glass_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES system_administrators (id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    label VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    used_session_id VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE system_admin_break_glass_codes IS 'Hashed one-time codes that allow emergency SYSTEM_ADMIN access when normal MFA/IP controls fail.';
COMMENT ON COLUMN system_admin_break_glass_codes.code_hash IS 'BCrypt/Argon2 hash of the offline break-glass code.';
COMMENT ON COLUMN system_admin_break_glass_codes.label IS 'Operator-supplied label describing where the code is stored (e.g., safe, vault envelope).';
COMMENT ON COLUMN system_admin_break_glass_codes.metadata IS 'Structured metadata (reason, issued_by, ticket references).';

CREATE INDEX IF NOT EXISTS idx_system_admin_break_glass_admin ON system_admin_break_glass_codes (admin_id);
CREATE INDEX IF NOT EXISTS idx_system_admin_break_glass_unused ON system_admin_break_glass_codes (admin_id, used_at)
  WHERE used_at IS NULL;

\echo 'system_admin_break_glass_codes table created.'
