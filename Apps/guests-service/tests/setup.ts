import { afterEach, beforeAll, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET ?? "test-secret-change-me-32-characters-minimum";
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? "localhost:29092";
process.env.KAFKA_FAILOVER_BROKERS = process.env.KAFKA_FAILOVER_BROKERS ?? "";

beforeAll(() => {
  // env defaults are applied at module load
});

afterEach(() => {
  vi.clearAllMocks();
});
