import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
