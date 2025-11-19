import {
  PublicSystemAdministratorSchema,
  SystemAdministratorSchema,
  type PublicSystemAdministrator,
  type SystemAdminRole,
  type UserTenantAssociationWithDetails,
} from "@tartware/schemas";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import ipaddr from "ipaddr.js";
import { createHash, randomUUID } from "node:crypto";

import { config } from "../config.js";
import { query } from "../lib/db.js";
import { signImpersonationToken, signSystemAdminToken } from "../lib/jwt.js";
import { listUserTenantAssociations } from "../services/user-tenant-association-service.js";
import { userCacheService } from "./user-cache-service.js";

import {
  SYSTEM_ADMIN_AUDIT_INSERT_SQL,
  SYSTEM_ADMIN_INCREMENT_FAILED_LOGIN_SQL,
  SYSTEM_ADMIN_LOOKUP_SQL,
  SYSTEM_ADMIN_RESET_LOGIN_SQL,
} from "../sql/system-admin-queries.js";

type SystemAdministratorRow = {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: SystemAdminRole;
  mfa_secret: string | null;
  mfa_enabled: boolean;
  ip_whitelist: string[] | null;
  allowed_hours: string | null;
  last_login_at: Date | null;
  failed_login_attempts: number;
  account_locked_until: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  metadata: Record<string, unknown> | null;
};

const mapRowToAdministrator = (row: SystemAdministratorRow) => {
  return SystemAdministratorSchema.parse({
    ...row,
    ip_whitelist: row.ip_whitelist ?? [],
    allowed_hours: row.allowed_hours ?? undefined,
    metadata: row.metadata ?? undefined,
    updated_at: row.updated_at ?? undefined,
    created_by: row.created_by ?? undefined,
    updated_by: row.updated_by ?? undefined,
  });
};

const parseIp = (value: string) => {
  const parsed = ipaddr.parse(value);
  return parsed.kind() === "ipv6" ? parsed.toNormalizedString() : parsed.toString();
};

const isIpAllowed = (allowList: string[], requestIp?: string): boolean => {
  if (allowList.length === 0) {
    return true;
  }

  if (!requestIp) {
    return false;
  }

  let parsedRequest: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsedRequest = ipaddr.parse(requestIp);
  } catch {
    return false;
  }

  return allowList.some((entry) => {
    try {
      if (entry.includes("/")) {
        const cidr = ipaddr.parseCIDR(entry);
        return parsedRequest.match(cidr);
      }
      return parsedRequest.toNormalizedString() === parseIp(entry);
    } catch {
      return false;
    }
  });
};

const parseRangeBoundary = (value: string | undefined) => {
  if (!value || value.toLowerCase() === "null" || value.trim() === "") {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const isWithinAllowedHours = (range: string | undefined, now = new Date()): boolean => {
  if (!range || range.trim().length === 0 || range === "empty") {
    return true;
  }

  const trimmed = range.trim();
  if (trimmed.length < 5) {
    return true;
  }

  const startInclusive = trimmed.startsWith("[");
  const endInclusive = trimmed.endsWith("]");
  const inner = trimmed.slice(1, -1);
  const [startRaw, endRaw] = inner.split(",", 2);
  const start = parseRangeBoundary(startRaw);
  const end = parseRangeBoundary(endRaw);

  if (start) {
    if (startInclusive) {
      if (now < start) {
        return false;
      }
    } else if (now <= start) {
      return false;
    }
  }

  if (end) {
    if (endInclusive) {
      if (now > end) {
        return false;
      }
    } else if (now >= end) {
      return false;
    }
  }

  return true;
};

const hasTrustedDevice = (metadata: Record<string, unknown> | undefined, fingerprint?: string): boolean => {
  const trusted = Array.isArray(metadata?.trusted_devices)
    ? metadata.trusted_devices.filter((value): value is string => typeof value === "string")
    : [];

  if (trusted.length === 0) {
    return true;
  }

  if (!fingerprint) {
    return false;
  }

  return trusted.includes(fingerprint);
};

const recordFailedAttempt = async (adminId: string) => {
  try {
    const { rows } = await query<{
      failed_login_attempts: number;
      account_locked_until: Date | null;
    }>(SYSTEM_ADMIN_INCREMENT_FAILED_LOGIN_SQL, [
      adminId,
      config.systemAdmin.security.maxFailedAttempts,
      config.systemAdmin.security.lockoutMinutes,
    ]);
    return rows[0] ?? null;
  } catch (error) {
    console.error("Failed to record system admin failed attempt:", error);
    return null;
  }
};

const resetLoginState = async (adminId: string) => {
  try {
    await query(SYSTEM_ADMIN_RESET_LOGIN_SQL, [adminId]);
  } catch (error) {
    console.error("Failed to reset system admin login state:", error);
  }
};

const checksumEvent = (payload: Record<string, unknown>) => {
  const data = JSON.stringify(payload);
  return createHash("sha256").update(data).digest("hex");
};

export interface SystemAdminAuditEvent {
  adminId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  tenantId?: string;
  requestMethod?: string;
  requestPath?: string;
  requestPayload?: Record<string, unknown> | null;
  responseStatus?: number;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  impersonatedUserId?: string;
  ticketId?: string;
}

export const logSystemAdminEvent = async (event: SystemAdminAuditEvent) => {
  const payloadForChecksum = {
    admin_id: event.adminId,
    action: event.action,
    resource_type: event.resourceType ?? null,
    resource_id: event.resourceId ?? null,
    tenant_id: event.tenantId ?? null,
    request_method: event.requestMethod ?? null,
    request_path: event.requestPath ?? null,
    request_payload: event.requestPayload ?? null,
    response_status: event.responseStatus ?? null,
    ip_address: event.ipAddress ?? null,
    user_agent: event.userAgent ?? null,
    session_id: event.sessionId ?? null,
    impersonated_user_id: event.impersonatedUserId ?? null,
    ticket_id: event.ticketId ?? null,
    timestamp: new Date().toISOString(),
  };

  const checksum = checksumEvent(payloadForChecksum);

  try {
    await query(SYSTEM_ADMIN_AUDIT_INSERT_SQL, [
      event.adminId,
      event.action,
      event.resourceType ?? null,
      event.resourceId ?? null,
      event.tenantId ?? null,
      event.requestMethod ?? null,
      event.requestPath ?? null,
      event.requestPayload ?? null,
      event.responseStatus ?? null,
      event.ipAddress ?? null,
      event.userAgent ?? null,
      event.sessionId ?? null,
      event.impersonatedUserId ?? null,
      event.ticketId ?? null,
      checksum,
    ]);
  } catch (error) {
    console.error("Failed to persist system admin audit event:", error);
  }
};

export type SystemAdminAuthFailureReason =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_INACTIVE"
  | "ACCOUNT_LOCKED"
  | "IP_NOT_ALLOWED"
  | "OUTSIDE_ALLOWED_HOURS"
  | "DEVICE_NOT_TRUSTED"
  | "MFA_REQUIRED"
  | "MFA_INVALID";

export type SystemAdminAuthResult =
  | {
      ok: true;
      data: {
        admin: PublicSystemAdministrator;
        token: string;
        expiresIn: number;
        sessionId: string;
      };
    }
  | {
      ok: false;
      reason: SystemAdminAuthFailureReason;
      lockExpiresAt?: Date;
    };

export interface SystemAdminLoginInput {
  username: string;
  password: string;
  mfaCode?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

const findSystemAdministrator = async (username: string) => {
  const { rows } = await query<SystemAdministratorRow>(SYSTEM_ADMIN_LOOKUP_SQL, [username]);
  if (rows.length === 0) {
    return null;
  }
  return mapRowToAdministrator(rows[0]);
};

export const authenticateSystemAdministrator = async (
  input: SystemAdminLoginInput,
): Promise<SystemAdminAuthResult> => {
  const admin = await findSystemAdministrator(input.username);
  if (!admin) {
    return { ok: false, reason: "INVALID_CREDENTIALS" };
  }

  if (!admin.is_active) {
    return { ok: false, reason: "ACCOUNT_INACTIVE" };
  }

  if (admin.account_locked_until && admin.account_locked_until.getTime() > Date.now()) {
    return {
      ok: false,
      reason: "ACCOUNT_LOCKED",
      lockExpiresAt: admin.account_locked_until,
    };
  }

  if (!isIpAllowed(admin.ip_whitelist ?? [], input.ipAddress)) {
    await recordFailedAttempt(admin.id);
    return { ok: false, reason: "IP_NOT_ALLOWED" };
  }

  if (!isWithinAllowedHours(admin.allowed_hours)) {
    await recordFailedAttempt(admin.id);
    return { ok: false, reason: "OUTSIDE_ALLOWED_HOURS" };
  }

  if (!hasTrustedDevice(admin.metadata ?? undefined, input.deviceFingerprint)) {
    await recordFailedAttempt(admin.id);
    return { ok: false, reason: "DEVICE_NOT_TRUSTED" };
  }

  const passwordValid = await bcrypt.compare(input.password, admin.password_hash);
  if (!passwordValid) {
    const result = await recordFailedAttempt(admin.id);
    const lockExpiresAt = result?.account_locked_until ?? undefined;
    return { ok: false, reason: "INVALID_CREDENTIALS", lockExpiresAt };
  }

  if (admin.mfa_enabled) {
    if (!input.mfaCode) {
      return { ok: false, reason: "MFA_REQUIRED" };
    }
    if (!admin.mfa_secret || !authenticator.check(input.mfaCode, admin.mfa_secret)) {
      await recordFailedAttempt(admin.id);
      return { ok: false, reason: "MFA_INVALID" };
    }
  }

  await resetLoginState(admin.id);

  const sessionId = randomUUID();
  const token = signSystemAdminToken({
    adminId: admin.id,
    username: admin.username,
    role: admin.role,
    sessionId,
  });

  await logSystemAdminEvent({
    adminId: admin.id,
    action: "SYSTEM_LOGIN_SUCCESS",
    requestMethod: "POST",
    requestPath: "/v1/system/auth/login",
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    sessionId,
  });

  const publicAdmin = PublicSystemAdministratorSchema.parse(admin);

  return {
    ok: true,
    data: {
      admin: publicAdmin,
      token,
      expiresIn: config.systemAdmin.jwt.expiresInSeconds,
      sessionId,
    },
  };
};

export interface ImpersonationRequest {
  adminId: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  reason: string;
  ticketId: string;
}

export type ImpersonationResult =
  | {
      ok: true;
      data: {
        accessToken: string;
        expiresIn: number;
      };
    }
  | {
      ok: false;
      reason: "USER_NOT_FOUND" | "TENANT_ACCESS_DENIED" | "MEMBERSHIP_INACTIVE";
    };

const findMembership = (
  associations: UserTenantAssociationWithDetails[],
  tenantId: string,
  userId: string,
) => associations.find((assoc) => assoc.tenant_id === tenantId && assoc.user_id === userId);

export const startImpersonationSession = async (
  admin: { adminId: string; sessionId: string },
  input: {
    tenantId: string;
    userId: string;
    reason: string;
    ticketId: string;
  },
): Promise<ImpersonationResult> => {
  const [user, associations] = await Promise.all([
    userCacheService.getUserById(input.userId),
    listUserTenantAssociations({
      tenantId: input.tenantId,
      userId: input.userId,
      limit: 1,
      isActive: true,
    }),
  ]);

  if (!user) {
    return { ok: false, reason: "USER_NOT_FOUND" };
  }

  const membership = findMembership(associations, input.tenantId, input.userId);
  if (!membership) {
    return { ok: false, reason: "TENANT_ACCESS_DENIED" };
  }

  if (!membership.is_active) {
    return { ok: false, reason: "MEMBERSHIP_INACTIVE" };
  }

  const accessToken = signImpersonationToken({
    userId: user.id,
    username: user.username,
    tenantId: input.tenantId,
    impersonatedBy: admin.adminId,
    reason: input.reason,
    ticketId: input.ticketId,
  });

  await logSystemAdminEvent({
    adminId: admin.adminId,
    action: "IMPERSONATION_STARTED",
    resourceType: "USER",
    resourceId: user.id,
    tenantId: input.tenantId,
    sessionId: admin.sessionId,
    impersonatedUserId: user.id,
    ticketId: input.ticketId,
    requestPayload: {
      reason: input.reason,
      ticket_id: input.ticketId,
    },
  });

  return {
    ok: true,
    data: {
      accessToken,
      expiresIn: config.systemAdmin.impersonationJwt.expiresInSeconds,
    },
  };
};
