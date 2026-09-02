import { afterEach, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.AUTH_JWT_SECRET =
  process.env.AUTH_JWT_SECRET ?? "test-secret-change-me-32-characters-minimum";

afterEach(() => {
  vi.clearAllMocks();
});
