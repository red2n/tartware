import { describe, expect, it, vi } from "vitest";

describe("Redis client lifecycle", () => {
  it("initializes, reports health, and closes", async () => {
    class FakeRedis {
      private handlers = new Map<string, Array<(...args: unknown[]) => void>>();
      on(event: string, handler: (...args: unknown[]) => void) {
        const list = this.handlers.get(event) ?? [];
        list.push(handler);
        this.handlers.set(event, list);
        return this;
      }
      async ping() {
        return "PONG";
      }
      async quit() {
        return "OK";
      }
    }

    vi.resetModules();
    vi.doMock("../src/config.js", async () => {
      const actual = await vi.importActual<typeof import("../src/config.js")>(
        "../src/config.js",
      );
      return {
        config: {
          ...actual.config,
          redis: {
            ...actual.config.redis,
            enabled: true,
            host: "localhost",
            port: 6379,
            password: null,
            db: 0,
            keyPrefix: "",
          },
        },
      };
    });
    vi.doMock("ioredis", () => ({
      default: FakeRedis,
    }));

    const { initRedis, getRedis, isRedisHealthy, closeRedis } = await import(
      "../src/lib/redis.js"
    );

    const client = initRedis();
    expect(client).toBeTruthy();
    expect(getRedis()).toBe(client);
    await expect(isRedisHealthy()).resolves.toBe(true);

    await closeRedis();
    expect(getRedis()).toBeNull();
  });

  it("returns null when disabled", async () => {
    vi.resetModules();
    vi.doMock("../src/config.js", async () => {
      const actual = await vi.importActual<typeof import("../src/config.js")>(
        "../src/config.js",
      );
      return {
        config: {
          ...actual.config,
          redis: {
            ...actual.config.redis,
            enabled: false,
          },
        },
      };
    });

    const { initRedis, getRedis } = await import("../src/lib/redis.js");
    expect(initRedis()).toBeNull();
    expect(getRedis()).toBeNull();
  });
});
