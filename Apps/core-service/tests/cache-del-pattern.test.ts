import { beforeEach, describe, expect, it, vi } from "vitest";

const redisMock = vi.hoisted(() => ({
  scan: vi.fn(),
  del: vi.fn(async (...keys: string[]) => keys.length),
  keys: vi.fn(() => {
    throw new Error("cacheService.delPattern must not call Redis KEYS");
  }),
}));

vi.mock("../src/lib/redis.js", () => ({
  getRedis: () => redisMock,
}));

import { config } from "../src/config.js";
import { CacheService } from "../src/lib/cache.js";

describe("CacheService.delPattern", () => {
  const cache = new CacheService();

  beforeEach(() => {
    config.redis.enabled = true;
    config.redis.keyPrefix = "";
    redisMock.scan.mockReset();
    redisMock.del.mockReset();
    redisMock.del.mockImplementation(async (...keys: string[]) => keys.length);
    redisMock.keys.mockClear();
  });

  it("uses SCAN to delete patterns instead of blocking KEYS", async () => {
    redisMock.scan.mockResolvedValueOnce([
      "0",
      ["test:user-1", "test:user-2"],
    ]);

    const deleted = await cache.delPattern("user-*", { prefix: "test" });

    expect(redisMock.scan).toHaveBeenCalledWith(
      "0",
      "MATCH",
      "test:user-*",
      "COUNT",
      expect.any(Number),
    );
    expect(redisMock.keys).not.toHaveBeenCalled();
    expect(redisMock.del).toHaveBeenCalledWith("test:user-1", "test:user-2");
    expect(deleted).toBe(2);
  });
});
