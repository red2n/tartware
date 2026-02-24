import jwt from "jsonwebtoken";

type AccessTokenPayload = jwt.JwtPayload & {
	sub: string;
	scope?: string[];
};

export type JwtConfig = {
	secret: string;
	issuer: string;
	audience?: string;
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

export const createTokenVerifier =
	(jwtConfig: JwtConfig) =>
	(token: string): AccessTokenPayload | null => {
		try {
			const payload = jwt.verify(token, jwtConfig.secret, {
				audience: jwtConfig.audience,
				issuer: jwtConfig.issuer,
			});
			return payload as AccessTokenPayload;
		} catch {
			return null;
		}
	};
