import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeRedis, resetStore } = vi.hoisted(() => {
  let store = new Map<string, Map<number, number>>();

  const ensureKey = (key: string) => {
    const current = store.get(key);
    if (current) {
      return current;
    }
    const created = new Map<number, number>();
    store.set(key, created);
    return created;
  };

  const resetStore = () => {
    store = new Map<string, Map<number, number>>();
  };

  const fakeRedis = {
    pipeline: () => {
      const ops: Array<() => [null, number]> = [];
      const pipeline = {
        setbit: (key: string, position: number, value: number) => {
          ops.push(() => {
            const bits = ensureKey(key);
            bits.set(position, value);
            return [null, 1];
          });
          return pipeline;
        },
        getbit: (key: string, position: number) => {
          ops.push(() => {
            const bits = store.get(key);
            return [null, bits?.get(position) ?? 0];
          });
          return pipeline;
        },
        exec: async () => ops.map((op) => op()),
      };
      return pipeline;
    },
    setbit: async (key: string, position: number, value: number) => {
      const bits = ensureKey(key);
      bits.set(position, value);
      return 1;
    },
    getbit: async (key: string, position: number) => {
      const bits = store.get(key);
      return bits?.get(position) ?? 0;
    },
    exists: async (key: string) => (store.has(key) ? 1 : 0),
    del: async (key: string) => {
      store.delete(key);
      return 1;
    },
    expire: async () => 1,
  };

  return { fakeRedis, resetStore };
});

vi.mock("../src/config.js", async () => {
  const actual = await vi.importActual<typeof import("../src/config.js")>(
    "../src/config.js",
  );
  return {
    config: {
      ...actual.config,
      redis: {
        ...actual.config.redis,
        enabled: true,
      },
    },
  };
});

vi.mock("../src/lib/redis.js", () => ({
  getRedis: () => fakeRedis,
}));

describe("BloomFilter", () => {
  beforeEach(() => {
    resetStore();
  });

  it("adds values and detects membership", async () => {
    const { BloomFilter } = await import("../src/lib/bloom-filter.js");
    const filter = new BloomFilter("test", { hashFunctions: 2, bitArraySize: 256 });

    expect(filter.isAvailable()).toBe(true);
    expect(await filter.add("alice")).toBe(true);
    expect(await filter.mightExist("alice")).toBe(true);
    expect(await filter.mightExist("bob")).toBe(false);
  });

  it("fails open before initialization and supports maintenance operations", async () => {
    const { BloomFilter } = await import("../src/lib/bloom-filter.js");
    const filter = new BloomFilter("maintenance", { hashFunctions: 2, bitArraySize: 128 });

    expect(await filter.mightExist("unseeded")).toBe(true);
    expect(await filter.addBatch([])).toBe(false);
    expect(await filter.addBatch(["one", "two"])).toBe(true);
    expect(await filter.exists()).toBe(true);
    expect(await filter.expire(60)).toBe(true);
    expect(await filter.clear()).toBe(true);
    expect(await filter.exists()).toBe(false);
  });
});
