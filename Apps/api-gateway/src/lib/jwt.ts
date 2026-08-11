import jwt from "jsonwebtoken";

import { authConfig, systemAdminAuthConfig } from "../config.js";

type AccessTokenPayload = jwt.JwtPayload & {
  sub: string;
  scope?: string[];
};

export const extractBearerToken = (authorizationHeader?: string): string | null => {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
};

export const verifyAccessToken = (token: string): AccessTokenPayload | null => {
  try {
    const payload = jwt.verify(token, authConfig.jwt.secret, {
      audience: authConfig.jwt.audience,
      issuer: authConfig.jwt.issuer,
    });
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
};

/**
 * Verifies a token minted by core-service's system-admin signer. Those tokens
 * carry a different issuer/audience than tenant access tokens, so they must be
 * checked against systemAdminAuthConfig rather than authConfig.
 */
export const verifySystemAdminToken = (token: string): AccessTokenPayload | null => {
  try {
    const payload = jwt.verify(token, systemAdminAuthConfig.jwt.secret, {
      audience: systemAdminAuthConfig.jwt.audience,
      issuer: systemAdminAuthConfig.jwt.issuer,
    });
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
};
