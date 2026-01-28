import { authenticator } from "otplib";

import { config } from "../config.js";
import { pool } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import {
  recordTenantAuthLockout,
  recordTenantAuthMfaChallenge,
  recordTenantAuthThrottleDenied,
} from "../lib/metrics.js";
import { checkTenantAuthThrottle } from "../lib/tenant-auth-throttle.js";
import {
  TENANT_AUTH_INCREMENT_FAILED_LOGIN_SQL,
  TENANT_AUTH_RESET_LOGIN_STATE_SQL,
} from "../sql/tenant-auth-queries.js";

/**
 * Tenant authentication security profile fields.
 */
export interface TenantAuthSecurityProfile {
  id: string;
  locked_until: Date | null;
  failed_login_attempts: number;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  password_rotated_at: Date | null | undefined;
}

/**
 * Throttle decision result for tenant auth attempts.
 */
export interface TenantAuthThrottleCheck {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * Maximum age for tenant passwords in days.
 */
export const TENANT_PASSWORD_MAX_AGE_DAYS = config.tenantAuth.security.password.maxAgeDays;

/**
 * Check tenant auth throttle limits for a username.
 */
export const checkTenantThrottle = async (username: string): Promise<TenantAuthThrottleCheck> => {
  const result = await checkTenantAuthThrottle(username);
  if (!result.allowed) {
    recordTenantAuthThrottleDenied();
  }
  return result;
};

/**
 * Determine if the tenant account is currently locked.
 */
export const isAccountLocked = (
  securityProfile: Pick<TenantAuthSecurityProfile, "locked_until">,
): { locked: boolean; lockExpiresAt?: Date } => {
  if (!securityProfile.locked_until) {
    return { locked: false };
  }
  const locked = securityProfile.locked_until.getTime() > Date.now();
  return {
    locked,
    lockExpiresAt: locked ? securityProfile.locked_until : undefined,
  };
};

/**
 * Record a failed tenant login attempt and return lockout status if triggered.
 */
export const recordFailedTenantLogin = async (
  userId: string,
): Promise<{ lockExpiresAt?: Date }> => {
  try {
    const { rows } = await pool.query<{
      failed_login_attempts: number;
      locked_until: Date | null;
    }>(TENANT_AUTH_INCREMENT_FAILED_LOGIN_SQL, [
      userId,
      config.tenantAuth.security.maxFailedAttempts,
      config.tenantAuth.security.lockoutMinutes,
    ]);
    const lockExpiresAt = rows[0]?.locked_until ?? undefined;
    if (lockExpiresAt) {
      recordTenantAuthLockout();
    }
    return { lockExpiresAt };
  } catch (error) {
    appLogger.error({ err: error, userId }, "failed to increment tenant failed login attempts");
    return {};
  }
};

/**
 * Reset failed login state for a tenant user after successful auth.
 */
export const resetTenantLoginState = async (userId: string): Promise<void> => {
  try {
    await pool.query(TENANT_AUTH_RESET_LOGIN_STATE_SQL, [userId]);
  } catch (error) {
    appLogger.error({ err: error, userId }, "failed to reset tenant login state");
  }
};

/**
 * Check if password rotation is required based on last rotation time.
 */
export const isPasswordRotationRequired = (rotatedAt: Date | null | undefined): boolean => {
  if (!TENANT_PASSWORD_MAX_AGE_DAYS || TENANT_PASSWORD_MAX_AGE_DAYS <= 0) {
    return false;
  }

  if (!rotatedAt) {
    return true;
  }

  const maxAgeMs = TENANT_PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - rotatedAt.getTime() >= maxAgeMs;
};

export type TenantMfaValidationResult =
  | { ok: true }
  | { ok: false; reason: "MFA_REQUIRED" | "MFA_INVALID" | "MFA_NOT_ENROLLED" };

/**
 * Validate MFA requirements and the provided MFA code.
 */
export const validateTenantMfa = (
  profile: Pick<TenantAuthSecurityProfile, "id" | "mfa_enabled" | "mfa_secret">,
  mfaCode?: string,
): TenantMfaValidationResult => {
  if (!profile.mfa_enabled) {
    if (config.tenantAuth.security.mfa.enforced) {
      return { ok: false, reason: "MFA_NOT_ENROLLED" };
    }
    return { ok: true };
  }

  if (!profile.mfa_secret) {
    appLogger.error({ userId: profile.id }, "tenant user has MFA enabled without secret");
    recordTenantAuthMfaChallenge("failure");
    return { ok: false, reason: "MFA_INVALID" };
  }

  if (!mfaCode) {
    recordTenantAuthMfaChallenge("failure");
    return { ok: false, reason: "MFA_REQUIRED" };
  }

  const valid = authenticator.check(mfaCode, profile.mfa_secret);
  if (!valid) {
    recordTenantAuthMfaChallenge("failure");
    return { ok: false, reason: "MFA_INVALID" };
  }

  recordTenantAuthMfaChallenge("success");
  return { ok: true };
};
