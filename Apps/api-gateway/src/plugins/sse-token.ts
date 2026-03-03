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
    if (request.headers.authorization) return;

    const token = (request.query as Record<string, string>)?.token;
    if (token) {
      request.headers.authorization = `Bearer ${token}`;
    }
  });
};

export default fp(sseTokenPlugin, { name: "sse-token" });
