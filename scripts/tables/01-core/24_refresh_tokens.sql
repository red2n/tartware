-- =====================================================
-- 24_refresh_tokens.sql
-- Refresh tokens for authentication
-- Industry Standard: OAuth 2.0 / OIDC refresh tokens
-- Pattern: Secure session management
-- Date: 2026-05-15
-- =====================================================

\c tartware \echo 'Creating refresh_tokens table...'

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_ip VARCHAR(45),
    user_agent TEXT
);

-- =====================================================
-- TABLE COMMENTS
-- =====================================================

COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for long-lived sessions';

COMMENT ON COLUMN refresh_tokens.id IS 'Unique identifier for the refresh token record';
COMMENT ON COLUMN refresh_tokens.user_id IS 'Reference to the user who owns this token';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'Hashed version of the refresh token';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Timestamp when the token expires';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'Timestamp when the token was manually revoked';
COMMENT ON COLUMN refresh_tokens.created_at IS 'Timestamp when the token was issued';
COMMENT ON COLUMN refresh_tokens.created_by_ip IS 'IP address used during token issuance';
COMMENT ON COLUMN refresh_tokens.user_agent IS 'User agent string used during token issuance';

-- Index for faster cleanup/lookup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

\echo 'refresh_tokens table created successfully!'
