import { afterEach, beforeAll, vi } from "vitest";

beforeAll(() => {
  process.env.API_GATEWAY_PORT = process.env.API_GATEWAY_PORT ?? "0";
  process.env.API_GATEWAY_LOG_REQUESTS = "false";
  process.env.API_GATEWAY_ENABLE_DUPLO_DASHBOARD = "false";
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
