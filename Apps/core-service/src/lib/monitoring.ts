import { config } from "../config.js";

import { appLogger } from "./logger.js";
import {
  recordImpersonationAlert,
  recordImpersonationSessionStarted,
  recordMembershipCacheInstability,
} from "./metrics.js";

type ImpersonationState = {
  windowStart: number;
  count: number;
  lastAlertAt: number;
};

const impersonationWindowMs = () =>
  config.compliance.monitoring.impersonationAlertWindowMinutes * 60 * 1000;

const impersonationTracker = new Map<string, ImpersonationState>();

type MembershipSampleState = {
  hits: number;
  misses: number;
  lastAlertAt: number;
};

const membershipState: MembershipSampleState = {
  hits: 0,
  misses: 0,
  lastAlertAt: 0,
};

export const trackImpersonationSession = (adminId: string): void => {
  recordImpersonationSessionStarted(adminId);

  const threshold = config.compliance.monitoring.impersonationAlertThreshold;
  if (threshold <= 0) {
    return;
  }

  const now = Date.now();
  const windowDuration = impersonationWindowMs();
  const existing = impersonationTracker.get(adminId);
  if (!existing || now - existing.windowStart > windowDuration) {
    impersonationTracker.set(adminId, {
      windowStart: now,
      count: 1,
      lastAlertAt: existing?.lastAlertAt ?? 0,
    });
    return;
  }

  existing.count += 1;
  if (existing.count >= threshold && now - existing.lastAlertAt > windowDuration / 2) {
    recordImpersonationAlert(adminId);
    appLogger.warn(
      {
        adminId,
        count: existing.count,
        windowMinutes: config.compliance.monitoring.impersonationAlertWindowMinutes,
      },
      "unusual impersonation session volume detected",
    );
    existing.lastAlertAt = now;
  }
};

export const trackMembershipCacheSample = (sample: "hit" | "miss"): void => {
  if (sample === "hit") {
    membershipState.hits += 1;
  } else {
    membershipState.misses += 1;
  }

  const total = membershipState.hits + membershipState.misses;
  if (total < 20) {
    return;
  }

  const ratio = membershipState.hits / total;
  const threshold = config.compliance.monitoring.membershipCacheHitDropThreshold;
  const cooldownMs = config.compliance.monitoring.membershipCacheHitDropCooldownMinutes * 60 * 1000;

  if (ratio < threshold && Date.now() - membershipState.lastAlertAt > cooldownMs) {
    recordMembershipCacheInstability();
    appLogger.warn(
      {
        ratio,
        hits: membershipState.hits,
        misses: membershipState.misses,
        threshold,
      },
      "membership cache hit rate dropped below threshold",
    );
    membershipState.lastAlertAt = Date.now();
    membershipState.hits = 0;
    membershipState.misses = 0;
  }
};
