import jwt from "jsonwebtoken";

import { config } from "../config.js";

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
    console.error("Failed to verify access token:", error);
    return null;
  }
};
