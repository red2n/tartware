import { afterEach, beforeAll, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET ?? "test-secret-change-me-32-characters-minimum";
process.env.API_GATEWAY_PORT = process.env.API_GATEWAY_PORT ?? "0";
process.env.API_GATEWAY_LOG_REQUESTS = "false";
process.env.API_GATEWAY_ENABLE_DUPLO_DASHBOARD = "false";

beforeAll(() => {
  // env defaults are applied at module load
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
