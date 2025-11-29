import { beforeAll, afterAll, beforeEach, vi } from "vitest";

import { resetSystemAdminState } from "./mocks/db.js";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/core-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "test";
process.env.PORT = process.env.PORT ?? "3000";
process.env.HOST = process.env.HOST ?? "127.0.0.1";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";
process.env.LOG_PRETTY = process.env.LOG_PRETTY ?? "false";
process.env.LOG_REQUESTS = process.env.LOG_REQUESTS ?? "false";
process.env.DB_HOST = process.env.DB_HOST ?? "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT ?? "5432";
process.env.DB_NAME = process.env.DB_NAME ?? "tartware";
process.env.DB_USER = process.env.DB_USER ?? "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.DB_SSL = process.env.DB_SSL ?? "false";
process.env.DB_POOL_MAX = process.env.DB_POOL_MAX ?? "5";
process.env.DB_POOL_IDLE_TIMEOUT_MS = process.env.DB_POOL_IDLE_TIMEOUT_MS ?? "1000";
process.env.REDIS_HOST = process.env.REDIS_HOST ?? "127.0.0.1";
process.env.REDIS_PORT = process.env.REDIS_PORT ?? "6379";
process.env.REDIS_ENABLED = process.env.REDIS_ENABLED ?? "false";
process.env.REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX ?? "tartware:test:";
process.env.REDIS_TTL_DEFAULT = process.env.REDIS_TTL_DEFAULT ?? "3600";
process.env.REDIS_TTL_USER = process.env.REDIS_TTL_USER ?? "1800";
process.env.REDIS_TTL_TENANT = process.env.REDIS_TTL_TENANT ?? "3600";
process.env.REDIS_TTL_BLOOM = process.env.REDIS_TTL_BLOOM ?? "86400";
process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "test-secret-change-me";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "core-service-test";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "core-service";
process.env.AUTH_JWT_EXPIRES_IN_SECONDS = process.env.AUTH_JWT_EXPIRES_IN_SECONDS ?? "900";
process.env.AUTH_DEFAULT_PASSWORD = process.env.AUTH_DEFAULT_PASSWORD ?? "ChangeMe123!";

// Mock the database module before any imports
vi.mock("../src/lib/db.js", () => import("./mocks/db.js"));

let resetRateLimiter: (() => void) | null = null;
const ensureRateLimiterResetter = async () => {
  if (!resetRateLimiter) {
    const module = await import("../src/lib/system-admin-rate-limiter.js");
    resetRateLimiter = module.resetSystemAdminRateLimiter;
  }

  return resetRateLimiter;
};

beforeAll(async () => {
  console.log("✓ Database mocks initialized for tests");
});

beforeEach(async () => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  resetSystemAdminState();
  const reset = await ensureRateLimiterResetter();
  reset?.();
});

afterAll(async () => {
  console.log("✓ Test suite completed");
});
