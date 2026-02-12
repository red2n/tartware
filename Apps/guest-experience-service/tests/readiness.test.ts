import { describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";

describe("guest-experience-service readiness", () => {
  it("GET /health returns status ok", async () => {
    const app = buildServer();
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("@tartware/guest-experience-service");
    expect(body.version).toBeDefined();

    await app.close();
  });

  it("GET /ready returns status ready with kafka info", async () => {
    const app = buildServer();
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);

    const body = response.json();
    expect(body.status).toBe("ready");
    expect(body.kafka).toBeDefined();
    expect(body.kafka.activeCluster).toBeDefined();
    expect(body.kafka.brokers).toBeInstanceOf(Array);

    await app.close();
  });
});
