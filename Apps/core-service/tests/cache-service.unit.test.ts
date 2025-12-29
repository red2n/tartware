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
