import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cacheService } from "../src/lib/cache.js";
import { config } from "../src/config.js";

describe("CacheService.delPattern", () => {
  const originalPrefix = config.redis.keyPrefix;
  const originalEnabled = config.redis.enabled;

  beforeEach(() => {
    config.redis.enabled = true;
    config.redis.keyPrefix = "unit:test:";
  });

  afterEach(() => {
    config.redis.enabled = originalEnabled;
    config.redis.keyPrefix = originalPrefix;
    vi.restoreAllMocks();
  });

  it("scans and unlinks namespaced keys instead of relying on KEYS", async () => {
    const keyPrefix = config.redis.keyPrefix ?? "";
    const store = new Set<string>([
      `${keyPrefix}tenant-cache:user-1`,
      `${keyPrefix}tenant-cache:user-2`,
      `${keyPrefix}tenant-cache:user-3`,
      `${keyPrefix}other-prefix:shield`, // should not be touched
    ]);

    const scanPatterns: string[] = [];

    const mockRedis = {
      scan: vi.fn(
        async (
          _cursor: string,
          _matchKeyword: string,
          matchPattern: string,
        ): Promise<[string, string[]]> => {
          scanPatterns.push(matchPattern);
          const wildcardIndex = matchPattern.indexOf("*");
          const startsWith =
            wildcardIndex === -1 ? matchPattern : matchPattern.slice(0, wildcardIndex);

          const matchedKeys = Array.from(store).filter((key) => key.startsWith(startsWith));
          // Single pass scan for this unit test
          return ["0", matchedKeys];
        },
      ),
      unlink: vi.fn(async (...keys: string[]): Promise<number> => {
        let deleted = 0;
        for (const key of keys) {
          const fullyQualified = `${keyPrefix}${key}`;
          if (store.delete(fullyQualified)) {
            deleted += 1;
          }
        }
        return deleted;
      }),
      del: vi.fn(async () => 0),
    };

    const redisSpy = vi
      .spyOn(cacheService as unknown as { getRedisClient: () => typeof mockRedis }, "getRedisClient")
      .mockReturnValue(mockRedis as unknown as typeof mockRedis);

    const deleted = await cacheService.delPattern("user-*", { prefix: "tenant-cache" });

    expect(deleted).toBe(3);
    expect(store.has(`${keyPrefix}tenant-cache:user-1`)).toBe(false);
    expect(store.has(`${keyPrefix}other-prefix:shield`)).toBe(true);
    expect(scanPatterns).toEqual([`${keyPrefix}tenant-cache:user-*`]);
    expect(mockRedis.unlink).toHaveBeenCalledTimes(1);
    expect(mockRedis.del).not.toHaveBeenCalled();

    redisSpy.mockRestore();
  });
});

describe("CacheService basic operations", () => {
  const originalEnabled = config.redis.enabled;

  beforeEach(() => {
    config.redis.enabled = true;
  });

  afterEach(() => {
    config.redis.enabled = originalEnabled;
    vi.restoreAllMocks();
  });

  it("gets cached entries and respects prefixes", async () => {
    const mockRedis = {
      get: vi.fn(async (key: string) => {
        expect(key).toBe("user:123");
        return JSON.stringify({ data: { id: "123" }, cachedAt: 1, ttl: 60 });
      }),
    };

    vi
      .spyOn(cacheService as unknown as { getRedisClient: () => typeof mockRedis }, "getRedisClient")
      .mockReturnValue(mockRedis as unknown as typeof mockRedis);

    const result = await cacheService.get<{ id: string }>("123", { prefix: "user" });
    expect(result).toEqual({ id: "123" });
  });

  it("returns null when cached entry is not valid JSON", async () => {
    const mockRedis = {
      get: vi.fn(async () => "not-json"),
    };

    vi
      .spyOn(cacheService as unknown as { getRedisClient: () => typeof mockRedis }, "getRedisClient")
      .mockReturnValue(mockRedis as unknown as typeof mockRedis);

    const result = await cacheService.get<{ id: string }>("123", { prefix: "user" });
    expect(result).toBeNull();
  });

  it("stores entries with TTL using setex", async () => {
    const mockRedis = {
      setex: vi.fn(async () => "OK"),
    };

    vi.spyOn(Date, "now").mockReturnValue(123);
    vi
      .spyOn(cacheService as unknown as { getRedisClient: () => typeof mockRedis }, "getRedisClient")
      .mockReturnValue(mockRedis as unknown as typeof mockRedis);

    const stored = await cacheService.set("abc", { ok: true }, { prefix: "session", ttl: 42 });

    expect(stored).toBe(true);
    const [[key, ttl, payload]] = mockRedis.setex.mock.calls;
    expect(key).toBe("session:abc");
    expect(ttl).toBe(42);
    expect(JSON.parse(payload)).toEqual({ data: { ok: true }, cachedAt: 123, ttl: 42 });
  });

  it("returns a map for mget and skips invalid entries", async () => {
    const mockRedis = {
      mget: vi.fn(async () => [
        JSON.stringify({ data: { name: "alpha" }, cachedAt: 1, ttl: 5 }),
        "broken-json",
      ]),
    };

    vi
      .spyOn(cacheService as unknown as { getRedisClient: () => typeof mockRedis }, "getRedisClient")
      .mockReturnValue(mockRedis as unknown as typeof mockRedis);

    const result = await cacheService.mget<{ name: string }>(["a", "b"], { prefix: "item" });

    expect(mockRedis.mget).toHaveBeenCalledWith("item:a", "item:b");
    expect(result.size).toBe(1);
    expect(result.get("a")).toEqual({ name: "alpha" });
  });

  it("writes multiple entries with pipeline setex", async () => {
    const pipeline = {
      setex: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => []),
    };
    const mockRedis = {
      pipeline: vi.fn(() => pipeline),
    };

    vi
      .spyOn(cacheService as unknown as { getRedisClient: () => typeof mockRedis }, "getRedisClient")
      .mockReturnValue(mockRedis as unknown as typeof mockRedis);

    const entries = new Map<string, { value: number }>([
      ["one", { value: 1 }],
      ["two", { value: 2 }],
    ]);

    const stored = await cacheService.mset(entries, { prefix: "batch", ttl: 90 });

    expect(stored).toBe(true);
    expect(pipeline.setex).toHaveBeenCalledTimes(2);
    expect(pipeline.exec).toHaveBeenCalledTimes(1);
  });

  it("expires keys when Redis confirms the update", async () => {
    const mockRedis = {
      expire: vi.fn(async () => 1),
    };

    vi
      .spyOn(cacheService as unknown as { getRedisClient: () => typeof mockRedis }, "getRedisClient")
      .mockReturnValue(mockRedis as unknown as typeof mockRedis);

    const result = await cacheService.expire("token", 300, { prefix: "session" });
    expect(result).toBe(true);
  });
});
