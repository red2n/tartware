export const TENANT_AUTH_INCREMENT_FAILED_LOGIN_SQL = `
  UPDATE public.users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval
           ELSE locked_until
         END,
         updated_at = NOW(),
         version = COALESCE(version, 0) + 1
   WHERE id = $1
   RETURNING failed_login_attempts, locked_until;
`;

export const TENANT_AUTH_RESET_LOGIN_STATE_SQL = `
  UPDATE public.users
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_login_at = NOW(),
      updated_at = NOW(),
      version = COALESCE(version, 0) + 1
   WHERE id = $1;
`;

export const TENANT_AUTH_UPDATE_PASSWORD_SQL = `
  UPDATE public.users
     SET password_hash = $1,
         password_rotated_at = NOW(),
         failed_login_attempts = 0,
         locked_until = NULL,
         updated_at = NOW(),
         version = COALESCE(version, 0) + 1
   WHERE id = $2;
`;

export const TENANT_AUTH_MFA_PROFILE_SQL = `
  SELECT id,
         username,
         email,
         is_active,
         mfa_secret,
         mfa_enabled
  FROM public.users
  WHERE id = $1
    AND deleted_at IS NULL
    AND COALESCE(is_deleted, false) = false
  LIMIT 1;
`;

export const TENANT_AUTH_UPDATE_MFA_SQL = `
  UPDATE public.users
     SET mfa_secret = $1,
         mfa_enabled = $2,
         updated_at = NOW(),
         version = COALESCE(version, 0) + 1
   WHERE id = $3
     AND deleted_at IS NULL
     AND COALESCE(is_deleted, false) = false;
`;

// ---------------------------------------------------------------------------
// Refresh token queries
// ---------------------------------------------------------------------------

/** Insert a new refresh token for a user. $1=user_id $2=token_hash $3=expires_at $4=ip $5=user_agent */
export const INSERT_REFRESH_TOKEN_SQL = `
  INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip, user_agent)
  VALUES ($1, $2, $3, $4, $5)
  RETURNING id;
`;

/**
 * Look up a valid (non-expired, non-revoked) refresh token by its hash.
 * Returns the row so the service can issue a new access token.
 */
export const FIND_REFRESH_TOKEN_SQL = `
  SELECT id, user_id, expires_at
    FROM refresh_tokens
   WHERE token_hash = $1
     AND revoked_at IS NULL
     AND expires_at > NOW()
   LIMIT 1;
`;

/** Revoke a single refresh token by its database id (used during rotation). */
export const REVOKE_REFRESH_TOKEN_SQL = `
  UPDATE refresh_tokens
     SET revoked_at = NOW()
   WHERE id = $1;
`;

/** Revoke ALL active refresh tokens for a user (used on password change / logout). */
export const REVOKE_USER_REFRESH_TOKENS_SQL = `
  UPDATE refresh_tokens
     SET revoked_at = NOW()
   WHERE user_id = $1
     AND revoked_at IS NULL;
`;

/** Purge expired + revoked tokens older than 7 days (for scheduled maintenance). */
export const PURGE_STALE_REFRESH_TOKENS_SQL = `
  DELETE FROM refresh_tokens
   WHERE (expires_at < NOW() OR revoked_at IS NOT NULL)
     AND created_at < NOW() - INTERVAL '7 days';
`;
