import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

/**
 * Promotes a `?token=` query parameter to the Authorization header.
 *
 * EventSource (SSE) does not support custom headers, so the UI passes the
 * JWT as a query parameter. This plugin runs before the auth plugin and
 * sets the Authorization header so the standard JWT verification flow works
 * unchanged. Only applies when no Authorization header is already present.
 */
const sseTokenPlugin: FastifyPluginAsync = async (fastify) => {
	fastify.addHook("onRequest", async (request) => {
		// Only apply to SSE requests to avoid enabling query-param auth globally
		if (request.method !== "GET") return;
		const acceptHeader = request.headers.accept;
		if (!acceptHeader || !acceptHeader.includes("text/event-stream")) return;

		if (request.headers.authorization) return;

		const query = request.query as Record<string, unknown> | undefined;
		const token =
			query && typeof query.token === "string" ? query.token : undefined;
		if (token) {
			request.headers.authorization = `Bearer ${token}`;
			// Remove token from parsed query to reduce logging/leakage risk
			delete (query as Record<string, unknown>).token;
		}
	});
};

export const sseTokenPromotePlugin = fp(sseTokenPlugin, { name: "sse-token" });
