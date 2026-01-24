import { generateKeyPairSync } from "node:crypto";

import { vi } from "vitest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.PORT = process.env.PORT ?? "3100";
process.env.HOST = process.env.HOST ?? "127.0.0.1";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "silent";
process.env.LOG_PRETTY = process.env.LOG_PRETTY ?? "false";
process.env.LOG_REQUESTS = process.env.LOG_REQUESTS ?? "false";
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/settings-service";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "test";

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
process.env.JWT_AUDIENCE = process.env.JWT_AUDIENCE ?? "test-audience";
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? "https://auth.tartware.test";
process.env.SETTINGS_DATA_SOURCE = process.env.SETTINGS_DATA_SOURCE ?? "seed";
if (!process.env.JWT_PUBLIC_KEY || !process.env.JWT_PRIVATE_KEY) {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  process.env.JWT_PUBLIC_KEY = publicKey;
  process.env.JWT_PRIVATE_KEY = privateKey;
}
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
