import jwt from "jsonwebtoken";

import { authConfig } from "../config.js";

type AccessTokenPayload = jwt.JwtPayload & {
	sub: string;
	scope?: string[];
};

export const extractBearerToken = (
	authorizationHeader?: string,
): string | null => {
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
