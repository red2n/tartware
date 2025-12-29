import { config } from "../config.js";

import { cacheService } from "./cache.js";
import { appLogger } from "./logger.js";
import { getRedis } from "./redis.js";

const WINDOW_MS = 60_000;
const perMinute = Math.max(1, config.systemAdmin.rateLimit.perMinute);
const burstCapacity = Math.max(1, config.systemAdmin.rateLimit.burst);
const tokensPerMs = perMinute / WINDOW_MS;
const RATE_LIMIT_PREFIX = "system_admin_rate_limit";

const RATE_LIMIT_LUA_SCRIPT = `
local burst = tonumber(ARGV[1])
local tokensPerMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local windowMs = tonumber(ARGV[4])

local bucket = redis.call("HMGET", KEYS[1], "tokens", "updatedAt")
local tokens = tonumber(bucket[1])
local updatedAt = tonumber(bucket[2])

if tokens == nil or updatedAt == nil then
  tokens = burst
  updatedAt = now
else
  local elapsed = now - updatedAt
  if elapsed > 0 then
    tokens = math.min(burst, tokens + (elapsed * tokensPerMs))
    updatedAt = now
  end
end

local allowed = 0
local remaining = tokens
local retryAfterMs = -1

if tokens >= 1 then
  tokens = tokens - 1
  remaining = tokens
  allowed = 1
else
  local deficit = 1 - tokens
  if tokensPerMs > 0 then
    retryAfterMs = math.ceil(deficit / tokensPerMs)
  else
    retryAfterMs = windowMs
  end
end

redis.call("HMSET", KEYS[1], "tokens", tokens, "updatedAt", updatedAt)
redis.call("PEXPIRE", KEYS[1], windowMs)

return { allowed, remaining, retryAfterMs }
`;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

const buildRedisKey = (adminId: string): string => `${RATE_LIMIT_PREFIX}:${adminId}`;

const tryConsumeWithRedis = async (key: string, now: number): Promise<RateLimitResult | null> => {
  if (!config.redis.enabled) {
    return null;
  }

  const redis = getRedis();
  if (!redis) {
    return null;
  }

  try {
    const redisKey = buildRedisKey(key);
    const result = (await redis.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      redisKey,
      burstCapacity.toString(),
      tokensPerMs.toString(),
      now.toString(),
      WINDOW_MS.toString(),
    )) as [number | string, number | string, number | string];

    const allowed = Number(result[0]) === 1;
    const remaining = Math.max(0, Math.floor(Number(result[1]) ?? 0));
    const retryAfterRaw = Number(result[2]);
    const retryAfterMs =
      Number.isFinite(retryAfterRaw) && retryAfterRaw > 0 ? Math.ceil(retryAfterRaw) : WINDOW_MS;

    return {
      allowed,
      remaining,
      retryAfterMs: allowed ? undefined : retryAfterMs,
    };
  } catch (error) {
    appLogger.error(
      { err: error },
      "system admin rate limiter failed to evaluate redis token bucket",
    );
    return null;
  }
};

let hasWarnedAboutRedis = false;

const logRedisUnavailable = (reason: string) => {
  if (hasWarnedAboutRedis) {
    return;
  }
  hasWarnedAboutRedis = true;
  appLogger.warn(
    { reason },
    "system admin rate limiter running in degraded mode; requests are not rate limited",
  );
};

export const consumeSystemAdminRateLimit = async (
  key: string | undefined,
  now = Date.now(),
): Promise<RateLimitResult> => {
  if (!key) {
    return { allowed: true, remaining: burstCapacity };
  }

  const redisResult = await tryConsumeWithRedis(key, now);
  if (redisResult) {
    return redisResult;
  }

  logRedisUnavailable(config.redis.enabled ? "redis_unreachable" : "redis_disabled");
  return { allowed: true, remaining: burstCapacity };
};

export const resetSystemAdminRateLimiter = async (): Promise<void> => {
  if (!config.redis.enabled) {
    logRedisUnavailable("redis_disabled");
    return;
  }

  try {
    await cacheService.delPattern("*", { prefix: RATE_LIMIT_PREFIX });
  } catch (error) {
    appLogger.error({ err: error }, "failed to reset system admin rate limiter keys");
  }
};

export const getSystemAdminRateLimitSettings = () => ({
  perMinute,
  burst: burstCapacity,
  windowMs: WINDOW_MS,
});
