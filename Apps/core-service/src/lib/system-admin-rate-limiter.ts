import { config } from "../config.js";

const WINDOW_MS = 60_000;
const perMinute = Math.max(1, config.systemAdmin.rateLimit.perMinute);
const burstCapacity = Math.max(1, config.systemAdmin.rateLimit.burst);
const tokensPerMs = perMinute / WINDOW_MS;

type BucketState = {
  tokens: number;
  updatedAt: number;
};

const buckets = new Map<string, BucketState>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

const refillBucket = (state: BucketState, now: number): void => {
  const elapsed = Math.max(0, now - state.updatedAt);
  if (elapsed === 0) {
    return;
  }

  const refilled = state.tokens + elapsed * tokensPerMs;
  state.tokens = Math.min(burstCapacity, refilled);
  state.updatedAt = now;
};

export const consumeSystemAdminRateLimit = (
  key: string | undefined,
  now = Date.now(),
): RateLimitResult => {
  if (!key) {
    return { allowed: true, remaining: burstCapacity };
  }

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: burstCapacity, updatedAt: now };
    buckets.set(key, bucket);
  }

  refillBucket(bucket, now);

  if (bucket.tokens < 1) {
    const deficit = 1 - bucket.tokens;
    const retryAfterMs = deficit / tokensPerMs;
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : WINDOW_MS,
    };
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, Math.floor(bucket.tokens)),
  };
};

export const resetSystemAdminRateLimiter = (): void => {
  buckets.clear();
};

export const getSystemAdminRateLimitSettings = () => ({
  perMinute,
  burst: burstCapacity,
  windowMs: WINDOW_MS,
});
