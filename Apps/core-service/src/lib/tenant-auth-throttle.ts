import { config } from "../config.js";

import { appLogger } from "./logger.js";
import { getRedis } from "./redis.js";

const KEY_PREFIX = "tenant_auth_throttle";
const WINDOW_MS = Math.max(5_000, config.tenantAuth.security.throttle.windowSeconds * 1000);
const MAX_ATTEMPTS = Math.max(1, config.tenantAuth.security.throttle.maxAttempts);

const THROTTLE_LUA_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { count, ttl }
`;

const fallbackCounters = new Map<
  string,
  {
    count: number;
    expiresAt: number;
  }
>();

const buildKey = (identifier: string): string => `${KEY_PREFIX}:${identifier.toLowerCase()}`;

export interface TenantAuthThrottleResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

const evaluateFallbackCounter = (key: string): TenantAuthThrottleResult => {
  const now = Date.now();
  const existing = fallbackCounters.get(key);
  if (!existing || existing.expiresAt <= now) {
    const fresh = { count: 1, expiresAt: now + WINDOW_MS };
    fallbackCounters.set(key, fresh);
    return {
      allowed: true,
      remaining: Math.max(0, MAX_ATTEMPTS - fresh.count),
    };
  }

  existing.count += 1;
  fallbackCounters.set(key, existing);
  const allowed = existing.count <= MAX_ATTEMPTS;
  const retryAfterMs = allowed ? undefined : Math.max(0, existing.expiresAt - now);

  return {
    allowed,
    remaining: Math.max(0, MAX_ATTEMPTS - existing.count),
    retryAfterMs,
  };
};

const evaluateWithRedis = async (identifier: string): Promise<TenantAuthThrottleResult | null> => {
  if (!config.redis.enabled) {
    return null;
  }

  const redis = getRedis();
  if (!redis) {
    return null;
  }

  try {
    const redisKey = buildKey(identifier);
    const [countRaw, ttlRaw] = (await redis.eval(
      THROTTLE_LUA_SCRIPT,
      1,
      redisKey,
      WINDOW_MS.toString(),
    )) as [number | string, number | string];

    const count = Number(countRaw) || 0;
    const ttlMs = Number(ttlRaw);
    const allowed = count <= MAX_ATTEMPTS;
    const retryAfterMs = allowed ? undefined : Math.max(0, ttlMs);

    return {
      allowed,
      remaining: Math.max(0, MAX_ATTEMPTS - count),
      retryAfterMs,
    };
  } catch (error) {
    appLogger.warn({ err: error }, "tenant auth throttle redis error");
    return null;
  }
};

export const checkTenantAuthThrottle = async (
  identifier: string | undefined,
): Promise<TenantAuthThrottleResult> => {
  if (!identifier || identifier.trim().length === 0) {
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }

  const redisResult = await evaluateWithRedis(identifier);
  if (redisResult) {
    return redisResult;
  }

  const fallbackKey = buildKey(identifier);
  return evaluateFallbackCounter(fallbackKey);
};
