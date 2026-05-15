import { createHash } from "node:crypto";

import { UserSchema } from "@tartware/schemas";
import bcrypt from "bcryptjs";

import { config } from "../config.js";
import { pool } from "../lib/db.js";
import { generateRefreshToken, signAccessToken } from "../lib/jwt.js";
import { appLogger } from "../lib/logger.js";
import {
  FIND_REFRESH_TOKEN_SQL,
  INSERT_REFRESH_TOKEN_SQL,
  REVOKE_REFRESH_TOKEN_SQL,
  REVOKE_USER_REFRESH_TOKENS_SQL,
  TENANT_AUTH_UPDATE_PASSWORD_SQL,
} from "../sql/tenant-auth-queries.js";
import { hashPassword } from "../utils/password.js";

const authLogger = appLogger.child({ module: "auth-service" });

import { emitMembershipCacheInvalidation } from "./membership-cache-hooks.js";
import {
  checkTenantThrottle,
  isAccountLocked,
  isPasswordRotationRequired,
  recordFailedTenantLogin,
  resetTenantLoginState,
  validateTenantMfa,
} from "./tenant-auth-security-service.js";
import { userCacheService } from "./user-cache-service.js";

const AuthUserSchema = UserSchema.pick({
  id: true,
  username: true,
  email: true,
  first_name: true,
  last_name: true,
  password_hash: true,
  is_active: true,
  failed_login_attempts: true,
  locked_until: true,
  mfa_enabled: true,
  mfa_secret: true,
  password_rotated_at: true,
});

type AuthUser = typeof AuthUserSchema._type;

type AuthPublicUser = Omit<
  AuthUser,
  | "password_hash"
  | "failed_login_attempts"
  | "locked_until"
  | "mfa_secret"
  | "mfa_enabled"
  | "password_rotated_at"
>;

type AuthResultSuccess = {
  ok: true;
  data: {
    user: AuthPublicUser;
    memberships: Awaited<ReturnType<typeof userCacheService.getUserMemberships>>;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    mustChangePassword: boolean;
  };
};

type AuthResultError = {
  ok: false;
  reason:
    | "INVALID_CREDENTIALS"
    | "ACCOUNT_INACTIVE"
    | "PASSWORD_REUSE_NOT_ALLOWED"
    | "ACCOUNT_LOCKED"
    | "THROTTLED"
    | "MFA_REQUIRED"
    | "MFA_INVALID"
    | "MFA_NOT_ENROLLED"
    | "INVALID_REFRESH_TOKEN";
  lockExpiresAt?: Date;
  retryAfterMs?: number;
};

export type AuthResult = AuthResultSuccess | AuthResultError;

type RefreshResultSuccess = {
  ok: true;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
};

export type RefreshResult = RefreshResultSuccess | AuthResultError;

const AUTH_USER_SQL = `
  SELECT id,
         username,
         email,
         first_name,
         last_name,
         password_hash,
         is_active,
         failed_login_attempts,
         locked_until,
         mfa_secret,
         mfa_enabled,
         password_rotated_at
  FROM public.users
  WHERE username = $1
    AND deleted_at IS NULL
    AND COALESCE(is_deleted, false) = false
  LIMIT 1
`;

const findUserForAuthentication = async (username: string): Promise<AuthUser | null> => {
  try {
    const result = await pool.query<AuthUser>(AUTH_USER_SQL, [username]);
    if (result.rows.length === 0) {
      return null;
    }
    return AuthUserSchema.parse(result.rows[0]);
  } catch (error) {
    authLogger.error({ err: error }, "Error fetching user for authentication");
    return null;
  }
};

/** Hash a raw refresh token for safe storage (SHA-256, no salt needed — tokens are 32 random bytes). */
const hashRefreshToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

/**
 * Issue a new refresh token, store its hash in the DB, and return the raw token.
 */
const issueRefreshToken = async (
  userId: string,
  clientIp?: string,
  userAgent?: string,
): Promise<string> => {
  const raw = generateRefreshToken();
  const hash = hashRefreshToken(raw);
  const expiresAt = new Date(
    Date.now() + config.auth.refreshToken.expiresInSeconds * 1000,
  );

  await pool.query(INSERT_REFRESH_TOKEN_SQL, [userId, hash, expiresAt, clientIp ?? null, userAgent ?? null]);

  return raw;
};

interface AuthenticateUserInput {
  username: string;
  password: string;
  mfaCode?: string;
  clientIp?: string;
  userAgent?: string;
}

/**
 * Authenticate a tenant user and issue an access + refresh token pair when valid.
 */
export const authenticateUser = async ({
  username,
  password,
  mfaCode,
  clientIp,
  userAgent,
}: AuthenticateUserInput): Promise<AuthResult> => {
  const throttle = await checkTenantThrottle(username);
  if (!throttle.allowed) {
    return {
      ok: false,
      reason: "THROTTLED",
      retryAfterMs: throttle.retryAfterMs,
    };
  }

  const user = await findUserForAuthentication(username);
  if (!user) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  // Check account status BEFORE password validation to prevent enumeration
  if (!user.is_active) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  const lockStatus = isAccountLocked({ locked_until: user.locked_until ?? null });
  if (lockStatus.locked) {
    return { ok: false, reason: "ACCOUNT_LOCKED", lockExpiresAt: lockStatus.lockExpiresAt };
  }

  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    const { lockExpiresAt } = await recordFailedTenantLogin(user.id);
    const reason = lockExpiresAt ? "ACCOUNT_LOCKED" : "INVALID_CREDENTIALS";
    return { ok: false, reason, lockExpiresAt };
  }

  const mfaValidation = validateTenantMfa(
    {
      id: user.id,
      mfa_enabled: user.mfa_enabled,
      mfa_secret: user.mfa_secret ?? null,
    },
    mfaCode,
  );
  if (!mfaValidation.ok) {
    return { ok: false, reason: mfaValidation.reason };
  }

  await resetTenantLoginState(user.id);

  const memberships = await userCacheService.getUserMemberships(user.id);
  const mustChangePassword =
    password === config.auth.defaultPassword ||
    isPasswordRotationRequired(user.password_rotated_at);

  // Access token contains ONLY sub + type — no PII.
  const accessToken = signAccessToken({ sub: user.id, type: "access" });
  const refreshToken = await issueRefreshToken(user.id, clientIp, userAgent);

  return {
    ok: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
      } satisfies AuthPublicUser,
      memberships,
      accessToken,
      refreshToken,
      expiresIn: config.auth.jwt.expiresInSeconds,
      mustChangePassword,
    },
  };
};

type FindByIdRow = {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | null;
  mfa_secret: string | null;
  mfa_enabled: boolean;
  password_rotated_at: Date | null;
};

const findUserById = async (userId: string): Promise<AuthUser | null> => {
  try {
    const result = await pool.query<FindByIdRow>(
      `SELECT id, username, email, first_name, last_name, password_hash, is_active,
              failed_login_attempts, locked_until, mfa_secret, mfa_enabled, password_rotated_at
       FROM public.users
       WHERE id = $1
         AND deleted_at IS NULL
         AND COALESCE(is_deleted, false) = false`,
      [userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return AuthUserSchema.parse(result.rows[0]);
  } catch (error) {
    authLogger.error({ err: error }, "Error retrieving user for password change");
    return null;
  }
};

/**
 * Change a user's password, revoke all existing refresh tokens, and issue a fresh token pair.
 */
export const changeUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
  clientIp?: string,
  userAgent?: string,
): Promise<AuthResultSuccess | AuthResultError> => {
  const user = await findUserById(userId);
  if (!user) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  const currentValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!currentValid) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  if (!user.is_active) {
    return { ok: false, reason: "ACCOUNT_INACTIVE" };
  }

  if (newPassword === config.auth.defaultPassword) {
    return { ok: false, reason: "PASSWORD_REUSE_NOT_ALLOWED" };
  }

  const newHash = await hashPassword(newPassword);

  try {
    await pool.query(TENANT_AUTH_UPDATE_PASSWORD_SQL, [newHash, userId]);
  } catch (error) {
    authLogger.error({ err: error }, "Failed to update user password");
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  // Revoke all existing refresh tokens — password change = session reset.
  await pool.query(REVOKE_USER_REFRESH_TOKENS_SQL, [userId]);

  await emitMembershipCacheInvalidation({
    userId,
    reason: "PASSWORD_UPDATED",
  });
  await resetTenantLoginState(userId);

  const memberships = await userCacheService.getUserMemberships(userId);
  const accessToken = signAccessToken({ sub: userId, type: "access" });
  const refreshToken = await issueRefreshToken(userId, clientIp, userAgent);

  return {
    ok: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
      } satisfies AuthPublicUser,
      memberships,
      accessToken,
      refreshToken,
      expiresIn: config.auth.jwt.expiresInSeconds,
      mustChangePassword: false,
    },
  };
};

type RefreshTokenRow = {
  id: string;
  user_id: string;
  expires_at: Date;
};

/**
 * Validate an opaque refresh token, rotate it (revoke old, issue new), and return a
 * fresh access token + new refresh token.
 *
 * Token rotation means each refresh token can only be used once — if a stolen token
 * is replayed after the legitimate client already rotated it, the lookup will fail.
 */
export const refreshAccessToken = async (
  rawRefreshToken: string,
  clientIp?: string,
  userAgent?: string,
): Promise<RefreshResult> => {
  const hash = hashRefreshToken(rawRefreshToken);
  const result = await pool.query<RefreshTokenRow>(FIND_REFRESH_TOKEN_SQL, [hash]);

  if (result.rows.length === 0) {
    authLogger.warn({ hash: hash.slice(0, 8) + "..." }, "Refresh token not found or expired");
    return { ok: false, reason: "INVALID_REFRESH_TOKEN" };
  }

  const tokenRow = result.rows[0] as RefreshTokenRow;
  const { id: tokenId, user_id: userId } = tokenRow;

  // Revoke the consumed token (rotation — one-time use).
  await pool.query(REVOKE_REFRESH_TOKEN_SQL, [tokenId]);

  const accessToken = signAccessToken({ sub: userId, type: "access" });
  const newRefreshToken = await issueRefreshToken(userId, clientIp, userAgent);

  return {
    ok: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: config.auth.jwt.expiresInSeconds,
    },
  };
};
