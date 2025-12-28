import { afterEach, beforeAll, vi } from "vitest";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.RESERVATION_COMMAND_ID =
  process.env.RESERVATION_COMMAND_ID ?? "reservations-command-service-test";
process.env.RESERVATION_COMMAND_LOG_REQUESTS =
  process.env.RESERVATION_COMMAND_LOG_REQUESTS ?? "false";
process.env.RESERVATION_COMMAND_PORT =
  process.env.RESERVATION_COMMAND_PORT ?? "4010";
process.env.RESERVATION_COMMAND_HOST =
  process.env.RESERVATION_COMMAND_HOST ?? "127.0.0.1";
process.env.DB_NAME = process.env.DB_NAME ?? "tartware";
process.env.DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";
process.env.DB_USER = process.env.DB_USER ?? "postgres";
process.env.DB_HOST = process.env.DB_HOST ?? "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT ?? "5432";
process.env.DB_SSL = process.env.DB_SSL ?? "false";
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? "localhost:9092";
process.env.RESERVATION_DLQ_TOPIC =
  process.env.RESERVATION_DLQ_TOPIC ?? "reservations.events.dlq";

beforeAll(() => {
  console.log("✓ Reservations command service tests initialized");
});

afterEach(() => {
  vi.clearAllMocks();
});
