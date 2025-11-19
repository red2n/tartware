export const SYSTEM_ADMIN_LOOKUP_SQL = `
  SELECT
    id,
    username,
    email,
    password_hash,
    role,
    mfa_secret,
    mfa_enabled,
    ip_whitelist,
    allowed_hours,
    last_login_at,
    failed_login_attempts,
    account_locked_until,
    is_active,
    created_at,
    updated_at,
    created_by,
    updated_by,
    metadata
  FROM public.system_administrators
  WHERE username = $1
  LIMIT 1
`;

export const SYSTEM_ADMIN_INCREMENT_FAILED_LOGIN_SQL = `
  UPDATE public.system_administrators
  SET failed_login_attempts = failed_login_attempts + 1,
      account_locked_until = CASE
        WHEN failed_login_attempts + 1 >= $2::int
          THEN NOW() + ($3::int || ' minutes')::interval
        ELSE account_locked_until
      END,
      updated_at = NOW()
  WHERE id = $1
  RETURNING failed_login_attempts, account_locked_until
`;

export const SYSTEM_ADMIN_RESET_LOGIN_SQL = `
  UPDATE public.system_administrators
  SET failed_login_attempts = 0,
      account_locked_until = NULL,
      last_login_at = NOW(),
      updated_at = NOW()
  WHERE id = $1
  RETURNING last_login_at
`;

export const SYSTEM_ADMIN_AUDIT_INSERT_SQL = `
  INSERT INTO public.system_admin_audit_log (
    admin_id,
    action,
    resource_type,
    resource_id,
    tenant_id,
    request_method,
    request_path,
    request_payload,
    response_status,
    ip_address,
    user_agent,
    session_id,
    impersonated_user_id,
    ticket_id,
    checksum
  ) VALUES (
    $1::uuid,
    $2,
    $3,
    $4::uuid,
    $5::uuid,
    $6,
    $7,
    $8::jsonb,
    $9::int,
    $10,
    $11,
    $12,
    $13::uuid,
    $14,
    $15
  )
`;
