import { afterEach, beforeAll, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? "localhost:29092";
process.env.KAFKA_FAILOVER_BROKERS = process.env.KAFKA_FAILOVER_BROKERS ?? "";
process.env.SKIP_GRPC = "true";

beforeAll(() => {
  // env defaults are applied at module load
});

afterEach(() => {
  vi.clearAllMocks();
});
