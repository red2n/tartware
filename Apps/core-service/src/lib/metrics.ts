import { Counter, collectDefaultMetrics, Registry } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
});

const membershipCacheHitCounter = new Counter({
  name: "core_membership_cache_hits_total",
  help: "Total number of membership lookups served from cache",
  registers: [metricsRegistry],
});

const membershipCacheMissCounter = new Counter({
  name: "core_membership_cache_misses_total",
  help: "Total number of membership lookups that required database fallback",
  registers: [metricsRegistry],
});

const membershipCacheErrorCounter = new Counter({
  name: "core_membership_cache_errors_total",
  help: "Number of errors encountered while loading membership data",
  registers: [metricsRegistry],
});

const systemAdminRateLimitDeniedCounter = new Counter({
  name: "core_system_admin_rate_limit_denied_total",
  help: "Total number of system admin requests rejected by the rate limiter",
  registers: [metricsRegistry],
  labelNames: ["scope", "admin_id", "session_id"],
});

const impersonationSessionCounter = new Counter({
  name: "core_impersonation_sessions_started_total",
  help: "System admin impersonation sessions started",
  registers: [metricsRegistry],
  labelNames: ["admin_id"],
});

const impersonationAlertCounter = new Counter({
  name: "core_impersonation_alerts_total",
  help: "Alerts generated for unusual impersonation usage",
  registers: [metricsRegistry],
  labelNames: ["admin_id"],
});

const offHoursAccessCounter = new Counter({
  name: "core_off_hours_access_events_total",
  help: "Tenant-scoped requests detected outside approved hours",
  registers: [metricsRegistry],
  labelNames: ["route", "user_id"],
});

const membershipCacheInstabilityCounter = new Counter({
  name: "core_membership_cache_alerts_total",
  help: "Alerts raised for sudden membership cache hit-rate drops",
  registers: [metricsRegistry],
});

const tenantAuthLockoutCounter = new Counter({
  name: "core_tenant_auth_lockouts_total",
  help: "Tenant authentication lockouts triggered",
  registers: [metricsRegistry],
});

const tenantAuthThrottleCounter = new Counter({
  name: "core_tenant_auth_throttle_denied_total",
  help: "Tenant authentication attempts rejected by throttle",
  registers: [metricsRegistry],
});

const tenantAuthMfaChallengeCounter = new Counter({
  name: "core_tenant_auth_mfa_challenges_total",
  help: "Tenant authentication MFA challenges processed",
  registers: [metricsRegistry],
  labelNames: ["result"],
});

export const recordMembershipCacheHit = (): void => {
  membershipCacheHitCounter.inc();
};

export const recordMembershipCacheMiss = (): void => {
  membershipCacheMissCounter.inc();
};

export const recordMembershipCacheError = (): void => {
  membershipCacheErrorCounter.inc();
};

export const recordSystemAdminRateLimitDenied = ({
  scope = "SYSTEM_ADMIN",
  adminIdHash,
  sessionIdHash,
}: {
  scope?: string;
  adminIdHash?: string;
  sessionIdHash?: string;
} = {}): void => {
  systemAdminRateLimitDeniedCounter.inc({
    scope,
    admin_id: adminIdHash ?? "unknown",
    session_id: sessionIdHash ?? "unknown",
  });
};

export const recordImpersonationSessionStarted = (adminId: string): void => {
  impersonationSessionCounter.inc({ admin_id: adminId });
};

export const recordImpersonationAlert = (adminId: string): void => {
  impersonationAlertCounter.inc({ admin_id: adminId });
};

export const recordOffHoursAccessEvent = (route: string, userId: string): void => {
  offHoursAccessCounter.inc({ route, user_id: userId });
};

export const recordMembershipCacheInstability = (): void => {
  membershipCacheInstabilityCounter.inc();
};

export const recordTenantAuthLockout = (): void => {
  tenantAuthLockoutCounter.inc();
};

export const recordTenantAuthThrottleDenied = (): void => {
  tenantAuthThrottleCounter.inc();
};

export const recordTenantAuthMfaChallenge = (result: "success" | "failure"): void => {
  tenantAuthMfaChallengeCounter.inc({ result });
};
