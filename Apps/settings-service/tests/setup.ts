import { vi } from "vitest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.PORT = process.env.PORT ?? "3100";
process.env.HOST = process.env.HOST ?? "127.0.0.1";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";
process.env.LOG_PRETTY = process.env.LOG_PRETTY ?? "false";
process.env.LOG_REQUESTS = process.env.LOG_REQUESTS ?? "false";
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/settings-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "test";

// Auth env — must match config.ts AUTH_JWT_* env vars so @fastify/jwt HS256 verification succeeds
process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET ?? "test-settings-secret-minimum-32-chars!!";
process.env.AUTH_JWT_ISSUER = process.env.AUTH_JWT_ISSUER ?? "https://auth.tartware.test";
process.env.AUTH_JWT_AUDIENCE = process.env.AUTH_JWT_AUDIENCE ?? "test-audience";

const TEST_TENANT_ID = "11111111-1111-1111-1111-111111111111";

vi.mock("../src/services/membership-service.js", () => ({
  getUserTenantMembership: vi.fn(async () => ({
    tenantId: TEST_TENANT_ID,
    role: "ADMIN",
    isActive: true,
    permissions: {},
    modules: ["settings"],
  })),
}));
process.env.SETTINGS_DATA_SOURCE = process.env.SETTINGS_DATA_SOURCE ?? "seed";
process.env.DB_HOST = process.env.DB_HOST ?? "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT ?? "5432";
process.env.DB_NAME = process.env.DB_NAME ?? "tartware";
process.env.DB_USER = process.env.DB_USER ?? "postgres";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.DB_SSL = process.env.DB_SSL ?? "false";
process.env.DB_POOL_MAX = process.env.DB_POOL_MAX ?? "5";
process.env.DB_POOL_IDLE_TIMEOUT_MS = process.env.DB_POOL_IDLE_TIMEOUT_MS ?? "1000";
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "settings-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "test";
