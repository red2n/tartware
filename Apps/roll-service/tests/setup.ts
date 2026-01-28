import { afterEach, beforeAll, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/roll-service";
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
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? "localhost:29092";
process.env.KAFKA_FAILOVER_BROKERS = process.env.KAFKA_FAILOVER_BROKERS ?? "";

beforeAll(() => {
  // env defaults are applied at module load
});

afterEach(() => {
  vi.clearAllMocks();
});
