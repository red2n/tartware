import { config } from "../config.js";

import { cacheService } from "./cache.js";
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

type BucketState = {
  tokens: number;
  updatedAt: number;
};

const fallbackBuckets = new Map<string, BucketState>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

const buildRedisKey = (adminId: string): string => `${RATE_LIMIT_PREFIX}:${adminId}`;

const consumeWithFallback = (key: string, now: number): RateLimitResult => {
  let bucket = fallbackBuckets.get(key);
  if (!bucket) {
    bucket = { tokens: burstCapacity, updatedAt: now };
    fallbackBuckets.set(key, bucket);
  }

  const elapsed = Math.max(0, now - bucket.updatedAt);
  if (elapsed > 0) {
    const refilled = bucket.tokens + elapsed * tokensPerMs;
    bucket.tokens = Math.min(burstCapacity, refilled);
    bucket.updatedAt = now;
  }

  if (bucket.tokens < 1) {
    const deficit = 1 - bucket.tokens;
    const retryAfterMs = deficit / tokensPerMs;
    fallbackBuckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : WINDOW_MS,
    };
  }

  bucket.tokens -= 1;
  fallbackBuckets.set(key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, Math.floor(bucket.tokens)),
  };
};

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
    console.error("system admin rate limiter redis error:", error);
    return null;
  }
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

  return consumeWithFallback(key, now);
};

export const resetSystemAdminRateLimiter = async (): Promise<void> => {
  fallbackBuckets.clear();
  if (!config.redis.enabled) {
    return;
  }

  try {
    await cacheService.delPattern("*", { prefix: RATE_LIMIT_PREFIX });
  } catch (error) {
    console.error("failed to reset system admin rate limiter keys:", error);
  }
};

export const getSystemAdminRateLimitSettings = () => ({
  perMinute,
  burst: burstCapacity,
  windowMs: WINDOW_MS,
});
