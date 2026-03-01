import type { FastifyReply, FastifyRequest } from "fastify";

import { proxyDurationHistogram } from "../lib/metrics.js";

import { getCircuitBreaker } from "./circuit-breaker.js";

/** Proxy timeout in ms; override via PROXY_TIMEOUT_MS env var. */
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS) || 30_000;

/** Max retries for transient failures (5xx, network errors). Only GET/HEAD are retried. */
const PROXY_MAX_RETRIES = Number(process.env.PROXY_MAX_RETRIES) || 2;

/** Base delay in ms for exponential backoff between retries. */
const PROXY_RETRY_BASE_DELAY_MS = Number(process.env.PROXY_RETRY_BASE_DELAY_MS) || 250;

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

  const proxyStart = performance.now();
  const targetLabel = new URL(targetBaseUrl).host;

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

  const method = request.method.toUpperCase();
  const isIdempotent = method === "GET" || method === "HEAD";
  const maxAttempts = isIdempotent ? 1 + PROXY_MAX_RETRIES : 1;

  let lastError: unknown = null;
  let response: Response | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = PROXY_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * delay * 0.25);
      request.log.warn(
        { targetUrl, method, attempt, delay: delay + jitter },
        "retrying transient proxy failure",
      );
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));

      if (!breaker.allowRequest()) {
        break;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
      response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;
      breaker.recordFailure();
      clearTimeout(timeoutId);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status >= 500) {
      breaker.recordFailure();
      if (attempt < maxAttempts - 1) {
        continue;
      }
    } else {
      breaker.recordSuccess();
    }

    break;
  }

  if (!response) {
    const isTimeout =
      lastError instanceof DOMException && (lastError as DOMException).name === "AbortError";

    request.log.error(
      { err: lastError, targetUrl, method: request.method, timedOut: isTimeout },
      "proxy fetch failed",
    );

    reply
      .header("Content-Type", "application/problem+json")
      .status(isTimeout ? 504 : 502)
      .send({
        type: "about:blank",
        title: isTimeout ? "Gateway Timeout" : "Bad Gateway",
        status: isTimeout ? 504 : 502,
        detail: isTimeout
          ? "Upstream service did not respond in time."
          : "Unable to reach upstream service. Please try again shortly.",
        instance: request.url,
        code: isTimeout ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNAVAILABLE",
      });
    proxyDurationHistogram.observe(
      { target: targetLabel, method, status: isTimeout ? "504" : "502" },
      (performance.now() - proxyStart) / 1000,
    );
    return reply;
  }

  reply.status(response.status);
  response.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      reply.header(key, value);
    }
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  proxyDurationHistogram.observe(
    { target: targetLabel, method, status: String(response.status) },
    (performance.now() - proxyStart) / 1000,
  );
  return reply.send(buffer);
};
