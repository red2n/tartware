import jwt from "jsonwebtoken";

import { config } from "../config.js";

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
    const payload = jwt.verify(token, config.auth.jwt.secret, {
      audience: config.auth.jwt.audience,
      issuer: config.auth.jwt.issuer,
    });
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
};
