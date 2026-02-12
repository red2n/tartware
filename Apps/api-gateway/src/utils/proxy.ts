import type { FastifyReply, FastifyRequest } from "fastify";

import { getCircuitBreaker } from "./circuit-breaker.js";

/** Proxy timeout in ms; override via PROXY_TIMEOUT_MS env var. */
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS) || 30_000;

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "host",
]);

const buildHeaders = (request: FastifyRequest): Headers => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value === undefined || value === null) continue;
    if (hopByHopHeaders.has(key.toLowerCase())) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else {
      headers.set(key, String(value));
    }
  }
  return headers;
};

const serializeBody = (request: FastifyRequest, headers: Headers): BodyInit | undefined => {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }

  const body = request.body;
  if (!body) {
    return undefined;
  }

  if (Buffer.isBuffer(body)) {
    return new Uint8Array(body);
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return new Uint8Array(body);
  }

  headers.set("content-type", headers.get("content-type") ?? "application/json");
  return JSON.stringify(body);
};

export const proxyRequest = async (
  request: FastifyRequest,
  reply: FastifyReply,
  targetBaseUrl: string,
): Promise<FastifyReply> => {
  if (request.method.toUpperCase() === "OPTIONS") {
    return reply.status(204).send();
  }

  const url = request.raw.url ?? "/";
  const targetUrl = new URL(url, targetBaseUrl).toString();

  const breaker = getCircuitBreaker(targetBaseUrl, { logger: request.log });

  if (!breaker.allowRequest()) {
    request.log.warn(
      { targetUrl, method: request.method, circuitState: breaker.getState() },
      "circuit open — rejecting proxy request",
    );
    return reply.serviceUnavailable(
      "Upstream service is temporarily unavailable. Please try again shortly.",
    );
  }

  const headers = buildHeaders(request);
  const body = serializeBody(request, headers);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    breaker.recordFailure();
    const isTimeout = error instanceof DOMException && error.name === "AbortError";

    request.log.error(
      { err: error, targetUrl, method: request.method, timedOut: isTimeout },
      "proxy fetch failed",
    );

    reply
      .header("Content-Type", "application/json")
      .status(isTimeout ? 504 : 502)
      .send({
        error: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
        message: isTimeout
          ? "Upstream service did not respond in time."
          : "Unable to reach upstream service. Please try again shortly.",
        details: error instanceof Error ? error.message : "Unknown upstream error",
      });
    return reply;
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status >= 500) {
    breaker.recordFailure();
  } else {
    breaker.recordSuccess();
  }

  reply.status(response.status);
  response.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      reply.header(key, value);
    }
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return reply.send(buffer);
};
