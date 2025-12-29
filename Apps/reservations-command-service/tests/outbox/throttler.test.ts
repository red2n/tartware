import { describe, expect, it, vi } from "vitest";

import { createTenantThrottler } from "@tartware/outbox";

const buildThrottler = (options: {
  minSpacingMs?: number;
  maxJitterMs?: number;
}) => {
  let now = 0;
  const delaySpy = vi.fn();

  const throttler = createTenantThrottler({
    minSpacingMs: options.minSpacingMs ?? 0,
    maxJitterMs: options.maxJitterMs ?? 0,
    now: () => now,
    delayFn: (ms) => {
      delaySpy(ms);
      return Promise.resolve();
    },
  });

  return {
    throttler,
    delaySpy,
    advanceTime: (ms: number) => {
      now += ms;
    },
  };
};

describe("createTenantThrottler", () => {
  it("is a no-op when throttling and jitter are disabled", async () => {
    const throttler = createTenantThrottler({
      minSpacingMs: 0,
      maxJitterMs: 0,
    });
    await throttler("tenant-a");
    await throttler("tenant-b");
  });

  it("enforces minimum spacing per tenant", async () => {
    const { throttler, delaySpy, advanceTime } = buildThrottler({
      minSpacingMs: 50,
    });

    await throttler("tenant-a"); // first call, no delay

    advanceTime(10);
    await throttler("tenant-a"); // should delay for remaining 40ms

    advanceTime(100);
    await throttler("tenant-a"); // spacing satisfied, no delay

    expect(delaySpy).toHaveBeenCalledTimes(1);
    expect(delaySpy).toHaveBeenCalledWith(40);
  });

  it("does not throttle different tenants independently", async () => {
    const { throttler, delaySpy, advanceTime } = buildThrottler({
      minSpacingMs: 100,
    });

    await throttler("tenant-a");
    advanceTime(10);
    await throttler("tenant-b");

    expect(delaySpy).not.toHaveBeenCalled();
  });

  it("applies jitter when configured", async () => {
    const jitterSpy = vi.fn();
    const throttler = createTenantThrottler({
      minSpacingMs: 0,
      maxJitterMs: 10,
      random: () => 0.5,
      delayFn: (ms) => {
        jitterSpy(ms);
        return Promise.resolve();
      },
    });

    await throttler("tenant-a");
    await throttler("tenant-a");

    expect(jitterSpy).toHaveBeenCalledTimes(2);
    expect(jitterSpy).toHaveBeenNthCalledWith(1, 5);
    expect(jitterSpy).toHaveBeenNthCalledWith(2, 5);
  });
});
