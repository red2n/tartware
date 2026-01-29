import type { SystemAdminRole } from "@tartware/schemas";
import jwt from "jsonwebtoken";

import { config } from "../config.js";

import { appLogger } from "./logger.js";

interface BaseAccessTokenPayload {
  sub: string;
  username: string;
  type: "access";
}

export interface AccessTokenPayload extends BaseAccessTokenPayload {
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
  scope?: string;
  [key: string]: unknown;
}

export interface SystemAdminTokenPayload extends AccessTokenPayload {
  scope: "SYSTEM_ADMIN";
  role: SystemAdminRole;
  session_id: string;
}

const getJwtSecret = (): string | null => {
  const secret = config.auth.jwt.secret;
  if (!secret || secret.trim().length === 0) {
    return null;
  }
  return secret;
};

const getJwtOptions = () => {
  const opts: jwt.SignOptions & jwt.VerifyOptions = {
    issuer: config.auth.jwt.issuer,
  };

  if (config.auth.jwt.audience) {
    opts.audience = config.auth.jwt.audience;
  }

  return opts;
};

export const extractBearerToken = (headerValue: string | undefined): string | null => {
  if (!headerValue) {
    return null;
  }
  const [scheme, token] = headerValue.split(" ");
  if (!scheme || !token) {
    return null;
  }
  if (scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return token.trim().length > 0 ? token.trim() : null;
};

export const signAccessToken = (payload: BaseAccessTokenPayload): string => {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("JWT secret is not configured");
  }

  const options = getJwtOptions();
  return jwt.sign(payload, secret, {
    ...options,
    expiresIn: config.auth.jwt.expiresInSeconds,
  });
};

export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
  const secret = getJwtSecret();
  if (!secret) {
    return null;
  }

  try {
    const options = getJwtOptions();
    const decoded = jwt.verify(token, secret, options);
    if (typeof decoded === "string") {
      return null;
    }
    if ((decoded as { type?: string }).type !== "access") {
      return null;
    }
    return decoded as AccessTokenPayload;
  } catch (error) {
    appLogger.error({ err: error }, "Failed to verify access token");
    return null;
  }
};

const getSystemAdminJwtOptions = () => {
  const options: jwt.SignOptions & jwt.VerifyOptions = {
    issuer: config.systemAdmin.jwt.issuer,
    audience: config.systemAdmin.jwt.audience,
  };
  return options;
};

export const signSystemAdminToken = (payload: {
  adminId: string;
  username: string;
  role: SystemAdminRole;
  sessionId: string;
}): string => {
  const secret = config.systemAdmin.jwt.secret;
  const options = getSystemAdminJwtOptions();
  return jwt.sign(
    {
      sub: payload.adminId,
      username: payload.username,
      role: payload.role,
      session_id: payload.sessionId,
      scope: "SYSTEM_ADMIN",
      type: "access",
    },
    secret,
    {
      ...options,
      expiresIn: config.systemAdmin.jwt.expiresInSeconds,
    },
  );
};

export const verifySystemAdminToken = (token: string): SystemAdminTokenPayload | null => {
  const secret = config.systemAdmin.jwt.secret;
  try {
    const options = getSystemAdminJwtOptions();
    const decoded = jwt.verify(token, secret, options);
    if (typeof decoded === "string") {
      return null;
    }
    if ((decoded as { type?: string }).type !== "access") {
      return null;
    }
    if ((decoded as { scope?: string }).scope !== "SYSTEM_ADMIN") {
      return null;
    }
    return decoded as SystemAdminTokenPayload;
  } catch (error) {
    appLogger.debug({ err: error }, "Failed to verify system admin token");
    return null;
  }
};

export const signImpersonationToken = (payload: {
  userId: string;
  username: string;
  tenantId: string;
  impersonatedBy: string;
  reason?: string;
  ticketId?: string;
}): string => {
  const secret = config.systemAdmin.impersonationJwt.secret;
  return jwt.sign(
    {
      sub: payload.userId,
      username: payload.username,
      tenant_id: payload.tenantId,
      impersonated_user_id: payload.userId,
      impersonated_by: payload.impersonatedBy,
      reason: payload.reason,
      ticket_id: payload.ticketId,
      scope: "TENANT_IMPERSONATION",
      type: "access",
    },
    secret,
    {
      issuer: config.systemAdmin.impersonationJwt.issuer,
      audience: config.systemAdmin.impersonationJwt.audience,
      expiresIn: config.systemAdmin.impersonationJwt.expiresInSeconds,
    },
  );
};
