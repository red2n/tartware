import type { CommandFeatureInfo } from "@tartware/command-center-shared";

import { appLogger } from "../lib/logger.js";

type ThrottleInput = {
  commandName: string;
  tenantId: string;
  requestId: string;
  feature: CommandFeatureInfo | null;
};

type TokenBucket = {
  tokens: number;
  capacity: number;
  refillPerMs: number;
  lastRefillMs: number;
  lastUsedMs: number;
};

const buckets = new Map<string, TokenBucket>();
const throttleLogger = appLogger.child({ module: "command-throttle" });
const BUCKET_TTL_MS = 30 * 60 * 1000;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000;
let lastPruneMs = Date.now();

const resolveLimits = (
  feature: CommandFeatureInfo | null,
): { maxPerMinute: number | null; burst: number | null } => {
  if (!feature) {
    return { maxPerMinute: null, burst: null };
  }
  const maxPerMinute = typeof feature.max_per_minute === "number" ? feature.max_per_minute : null;
  const burst = typeof feature.burst === "number" ? feature.burst : null;
  if (maxPerMinute === null && burst !== null) {
    return { maxPerMinute: burst, burst };
  }
  if (maxPerMinute !== null && burst === null) {
    return { maxPerMinute, burst: maxPerMinute };
  }
  if (maxPerMinute !== null && burst !== null && burst < maxPerMinute) {
    return { maxPerMinute, burst: maxPerMinute };
  }
  return { maxPerMinute, burst };
};

const shouldThrottle = (input: ThrottleInput): boolean => {
  const { maxPerMinute, burst } = resolveLimits(input.feature);
  if (!maxPerMinute || !burst || maxPerMinute <= 0 || burst <= 0) {
    return false;
  }

  const key = `${input.tenantId}:${input.commandName}`;
  const now = Date.now();
  if (now - lastPruneMs >= PRUNE_INTERVAL_MS) {
    for (const [bucketKey, bucket] of buckets.entries()) {
      if (now - bucket.lastUsedMs > BUCKET_TTL_MS) {
        buckets.delete(bucketKey);
      }
    }
    lastPruneMs = now;
  }
  const refillPerMs = maxPerMinute / 60_000;
  const bucket = buckets.get(key);

  if (!bucket) {
    const tokens = burst - 1;
    buckets.set(key, {
      tokens: Math.max(0, tokens),
      capacity: burst,
      refillPerMs,
      lastRefillMs: now,
      lastUsedMs: now,
    });
    return tokens < 0;
  }

  const elapsedMs = Math.max(0, now - bucket.lastRefillMs);
  const refilled = Math.min(bucket.capacity, bucket.tokens + elapsedMs * bucket.refillPerMs);
  bucket.tokens = refilled;
  bucket.lastRefillMs = now;
  bucket.lastUsedMs = now;

  if (bucket.tokens < 1) {
    return true;
  }

  bucket.tokens -= 1;
  return false;
};

/**
 * Apply throttling logic for command execution.
 */
export const throttleCommand = async (input: ThrottleInput): Promise<boolean> => {
  const throttled = shouldThrottle(input);
  if (!throttled) {
    return true;
  }

  const status = input.feature?.status ?? "enabled";
  if (status === "observation") {
    throttleLogger.info(
      {
        commandName: input.commandName,
        tenantId: input.tenantId,
        requestId: input.requestId,
      },
      "command throttled in observation mode",
    );
    return true;
  }

  throttleLogger.warn(
    {
      commandName: input.commandName,
      tenantId: input.tenantId,
      requestId: input.requestId,
    },
    "command throttled",
  );
  return false;
};
