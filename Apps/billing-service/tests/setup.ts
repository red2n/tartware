import { afterEach, beforeAll, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET ?? "test-secret-change-me-32-characters-minimum";
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? "localhost:29092";
process.env.KAFKA_FAILOVER_BROKERS = process.env.KAFKA_FAILOVER_BROKERS ?? "";
process.env.ROLL_SERVICE_CONSUMER_ENABLED = "false";
process.env.AR_EVENTS_CONSUMER_ENABLED = "false";
process.env.DATE_ROLL_SCHEDULER_ENABLED = "false";
process.env.ROLL_SERVICE_BACKFILL_ENABLED = "false";

beforeAll(() => {
  // env defaults are applied at module load
});

afterEach(() => {
  vi.clearAllMocks();
});
