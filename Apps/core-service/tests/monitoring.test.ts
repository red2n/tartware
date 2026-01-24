import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/metrics.js", () => ({
  recordImpersonationAlert: vi.fn(),
  recordImpersonationSessionStarted: vi.fn(),
  recordMembershipCacheInstability: vi.fn(),
}));

vi.mock("../src/lib/logger.js", () => ({
  appLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const loadMonitoring = async (overrides: {
  impersonationAlertThreshold?: number;
  impersonationAlertWindowMinutes?: number;
  membershipCacheHitDropThreshold?: number;
  membershipCacheHitDropCooldownMinutes?: number;
} = {}) => {
  vi.resetModules();
  vi.doMock("../src/config.js", async () => {
    const actual = await vi.importActual<typeof import("../src/config.js")>("../src/config.js");
    return {
      config: {
        ...actual.config,
        compliance: {
          ...actual.config.compliance,
          monitoring: {
            ...actual.config.compliance.monitoring,
            ...overrides,
          },
        },
      },
    };
  });

  const monitoring = await import("../src/lib/monitoring.js");
  const metrics = await import("../src/lib/metrics.js");
  const logger = await import("../src/lib/logger.js");

  return { monitoring, metrics, logger };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("monitoring signals", () => {
  it("records impersonation sessions even when alerts are disabled", async () => {
    const { monitoring, metrics } = await loadMonitoring({
      impersonationAlertThreshold: 0,
    });

    monitoring.trackImpersonationSession("admin-disabled");

    expect(metrics.recordImpersonationSessionStarted).toHaveBeenCalledTimes(1);
    expect(metrics.recordImpersonationAlert).not.toHaveBeenCalled();
  });

  it("alerts when impersonation volume exceeds the threshold", async () => {
    const { monitoring, metrics, logger } = await loadMonitoring({
      impersonationAlertThreshold: 2,
      impersonationAlertWindowMinutes: 1,
    });
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(40_000);

    monitoring.trackImpersonationSession("admin-spike");
    monitoring.trackImpersonationSession("admin-spike");

    expect(metrics.recordImpersonationAlert).toHaveBeenCalledTimes(1);
    expect(logger.appLogger.warn).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  it("alerts when membership cache hit rate drops below threshold", async () => {
    const { monitoring, metrics, logger } = await loadMonitoring({
      membershipCacheHitDropThreshold: 0.9,
      membershipCacheHitDropCooldownMinutes: 0,
    });

    for (let i = 0; i < 18; i += 1) {
      monitoring.trackMembershipCacheSample("miss");
    }
    for (let i = 0; i < 2; i += 1) {
      monitoring.trackMembershipCacheSample("hit");
    }

    expect(metrics.recordMembershipCacheInstability).toHaveBeenCalledTimes(1);
    expect(logger.appLogger.warn).toHaveBeenCalledTimes(1);
  });
});
