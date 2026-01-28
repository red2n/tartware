import { afterEach, beforeAll, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.AUTH_DEFAULT_PASSWORD =
  process.env.AUTH_DEFAULT_PASSWORD ?? "ChangeMe123!";
if (!process.env.AUTH_JWT_SECRET || process.env.AUTH_JWT_SECRET.length < 32) {
  process.env.AUTH_JWT_SECRET = "test-secret-change-me-32-characters-minimum";
}
process.env.COMMAND_CENTER_KAFKA_BROKERS =
  process.env.COMMAND_CENTER_KAFKA_BROKERS ?? "localhost:29092";
process.env.COMMAND_CENTER_KAFKA_FAILOVER_BROKERS =
  process.env.COMMAND_CENTER_KAFKA_FAILOVER_BROKERS ?? "";

beforeAll(() => {
  // env defaults are applied at module load
});

afterEach(() => {
  vi.clearAllMocks();
});
