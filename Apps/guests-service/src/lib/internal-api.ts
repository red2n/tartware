/**
 * Internal API client for calling existing services.
 *
 * Instead of duplicating SQL queries, the guest-experience-service
 * calls rooms-service, guests-service, and core-service via HTTP.
 * Authenticates using a service account (login creds in config).
 */
import { createCircuitBreaker } from "@tartware/fastify-server/circuit-breaker";
import { config } from "../config.js";
import { appLogger } from "./logger.js";

const logger = appLogger.child({ module: "internal-api" });

const INTERNAL_TIMEOUT_MS = 10_000;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/** Per-host circuit breaker so a failing downstream doesn't drag every call down. */
const breakers = new Map<string, ReturnType<typeof createCircuitBreaker>>();
const breakerFor = (key: string) => {
  let b = breakers.get(key);
  if (!b) {
    b = createCircuitBreaker({
      name: `internal-api:${key}`,
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      logger,
    });
    breakers.set(key, b);
  }
  return b;
};

/**
 * Obtain a JWT token via the core-service login endpoint.
 * Caches the token and refreshes when nearing expiry.
 */
const getServiceToken = async (): Promise<string> => {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const response = await breakerFor("core-service").exec(() =>
    fetch(`${config.internalServices.coreServiceUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: config.serviceAuth.username,
        password: config.serviceAuth.password,
      }),
      signal: AbortSignal.timeout(INTERNAL_TIMEOUT_MS),
    }),
  );

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "service auth login failed");
    throw new Error(`Service auth login failed: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  // Refresh 60s before expiry
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  logger.info("service auth token obtained");
  return cachedToken;
};

/**
 * Make an authenticated GET request to an internal service.
 */
export const internalGet = async <T>(
  baseUrl: string,
  path: string,
  queryParams?: Record<string, string | number | undefined>,
): Promise<T> => {
  const token = await getServiceToken();
  const url = new URL(path, baseUrl);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await breakerFor(new URL(baseUrl).host).exec(() =>
    fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(INTERNAL_TIMEOUT_MS),
    }),
  );

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Internal API error: ${response.status} ${text}`), {
      statusCode: response.status >= 500 ? 502 : response.status,
    });
  }

  return (await response.json()) as T;
};
