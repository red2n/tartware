export const TENANT_AUTH_INCREMENT_FAILED_LOGIN_SQL = `
  UPDATE public.users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval
           ELSE locked_until
         END,
         updated_at = NOW()
   WHERE id = $1
   RETURNING failed_login_attempts, locked_until;
`;

export const TENANT_AUTH_RESET_LOGIN_STATE_SQL = `
  UPDATE public.users
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_login_at = NOW(),
         updated_at = NOW()
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
