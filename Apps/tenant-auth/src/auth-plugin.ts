import type { FastifyPluginAsync } from "fastify";

import type { AuthContext, TenantScopeDecorator } from "./index.js";
import { createTokenVerifier, extractBearerToken, type JwtConfig } from "./jwt.js";
import { createMembershipLoader, type TenantMembership } from "./membership.js";
import { createTenantAuthPlugin } from "./index.js";

type QueryFn = <T extends Record<string, unknown>>(
	sql: string,
	params: unknown[],
) => Promise<{ rows: T[] }>;

export interface StandardAuthPluginOptions {
	jwtConfig: JwtConfig;
	query: QueryFn;
}

declare module "fastify" {
	interface FastifyRequest {
		auth: AuthContext<TenantMembership>;
	}

	interface FastifyInstance {
		withTenantScope: TenantScopeDecorator<TenantMembership>;
	}
}

const STANDARD_ROLE_PRIORITY: Record<string, number> = {
	OWNER: 500,
	ADMIN: 400,
	MANAGER: 300,
	STAFF: 200,
	VIEWER: 100,
};

/**
 * Pre-wired auth plugin for standard domain services (billing, rooms, guests, etc.).
 *
 * Combines JWT verification, membership lookup, and tenant scope guards using
 * the standard role priority and query-based membership resolution.
 *
 * @example
 * ```ts
 * import { createStandardAuthPlugin } from "@tartware/tenant-auth/auth-plugin";
 * import { query } from "../lib/db.js";
 * import { config } from "../config.js";
 *
 * const authPlugin = createStandardAuthPlugin({
 *   jwtConfig: config.auth.jwt,
 *   query,
 * });
 * ```
 */
export const createStandardAuthPlugin = (
	options: StandardAuthPluginOptions,
): FastifyPluginAsync => {
	const verifyAccessToken = createTokenVerifier(options.jwtConfig);
	const getUserMemberships = createMembershipLoader(options.query);

	return createTenantAuthPlugin<TenantMembership>({
		getUserMemberships,
		extractBearerToken,
		verifyAccessToken,
		rolePriority: STANDARD_ROLE_PRIORITY,
	});
};
