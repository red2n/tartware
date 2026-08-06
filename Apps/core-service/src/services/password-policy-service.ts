/**
 * Server-side password policy enforcement.
 *
 * The `admin.password_*` settings were previously honoured only by the Angular
 * client, so any direct API call could set a one-character password. PCI DSS
 * 4.0 (8.3.6) requires these controls to be enforced at the system level, not
 * merely written into policy.
 *
 * Defaults below are the PCI floor, used when the catalog is unreachable or a
 * definition is missing — a broken catalog must never weaken the policy.
 *
 * @module password-policy-service
 */
import {
  getBooleanSetting,
  getNumberSetting,
  resolveSettings,
} from "./settings-resolver-service.js";

/** PCI DSS 4.0 (8.3.6) minimum. Also the floor the catalog cannot go below. */
const PCI_MIN_LENGTH = 12;

const SETTING_CODES = [
  "admin.password_min_length",
  "admin.password_requires_upper",
  "admin.password_requires_number",
] as const;

export type PasswordPolicy = {
  readonly minLength: number;
  readonly requiresUppercase: boolean;
  readonly requiresNumber: boolean;
};

/** Thrown when a password fails the tenant's policy. Carries every failure. */
export class PasswordPolicyError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(`Password does not meet policy: ${violations.join("; ")}`);
    this.name = "PasswordPolicyError";
    this.violations = violations;
  }
}

/** The policy applied when there is no tenant to read settings from. */
const STRICT_DEFAULT_POLICY: PasswordPolicy = {
  minLength: PCI_MIN_LENGTH,
  requiresUppercase: true,
  requiresNumber: true,
};

/**
 * Reads the effective password policy for a tenant.
 *
 * Some paths legitimately have no tenant — system-admin account creation, and
 * tenant bootstrap, where the tenant's own settings do not exist yet. Those get
 * the strict PCI defaults rather than no policy at all.
 */
export const getPasswordPolicy = async (
  tenantId: string | null | undefined,
): Promise<PasswordPolicy> => {
  if (!tenantId) {
    return STRICT_DEFAULT_POLICY;
  }
  const values = await resolveSettings(tenantId, SETTING_CODES);
  return {
    // A tenant may harden past the PCI floor but never below it.
    minLength: Math.max(
      getNumberSetting(values, "admin.password_min_length", PCI_MIN_LENGTH),
      PCI_MIN_LENGTH,
    ),
    requiresUppercase: getBooleanSetting(values, "admin.password_requires_upper", true),
    requiresNumber: getBooleanSetting(values, "admin.password_requires_number", true),
  };
};

/** Collects every policy violation for a password, or an empty list if valid. */
export const checkPassword = (password: string, policy: PasswordPolicy): string[] => {
  const violations: string[] = [];

  if (password.length < policy.minLength) {
    violations.push(`must be at least ${policy.minLength} characters`);
  }
  if (policy.requiresUppercase && !/[A-Z]/.test(password)) {
    violations.push("must contain an uppercase letter");
  }
  if (policy.requiresNumber && !/\d/.test(password)) {
    violations.push("must contain a number");
  }

  return violations;
};

/**
 * Enforces the tenant's password policy, throwing {@link PasswordPolicyError}
 * on failure. Call before hashing, on every path that sets a password.
 */
export const assertPasswordMeetsPolicy = async (
  tenantId: string | null | undefined,
  password: string,
): Promise<void> => {
  const policy = await getPasswordPolicy(tenantId);
  const violations = checkPassword(password, policy);
  if (violations.length > 0) {
    throw new PasswordPolicyError(violations);
  }
};
