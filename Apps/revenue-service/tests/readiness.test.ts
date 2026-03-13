import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  query: vi.fn(async () => ({ rows: [{ "?column?": 1 }] })),
  pool: { end: vi.fn() },
}));

import { buildServer } from "../src/server.js";
import { appLogger } from "../src/lib/logger.js";

describe("revenue-service readiness", () => {
  let app: ReturnType<typeof buildServer>;

  beforeAll(async () => {
    app = buildServer({ logger: appLogger });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health check", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
    });
  });

  it("returns readiness check", async () => {
    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ready",
    });
  });
});
