import { afterEach, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? "localhost:29092";
  process.env.KAFKA_FAILOVER_BROKERS = process.env.KAFKA_FAILOVER_BROKERS ?? "";
  process.env.SKIP_GRPC = "true";
});

afterEach(() => {
  vi.clearAllMocks();
});
