import { afterEach, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.COMMAND_CENTER_KAFKA_BROKERS =
    process.env.COMMAND_CENTER_KAFKA_BROKERS ?? "localhost:29092";
  process.env.COMMAND_CENTER_KAFKA_FAILOVER_BROKERS =
    process.env.COMMAND_CENTER_KAFKA_FAILOVER_BROKERS ?? "";
});

afterEach(() => {
  vi.clearAllMocks();
});
