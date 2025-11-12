import { describe, expect, it } from "vitest";

import { createLogger } from "@tartware/telemetry";

import { buildServer } from "../src/app.js";
import { config } from "../src/config.js";

describe("health endpoint", () => {
  it("returns service status", async () => {
    const app = buildServer({
      logger: createLogger({
        serviceName: config.service.name,
        level: "silent",
        pretty: false,
        environment: "test",
      }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.status).toBe("ok");
    await app.close();
  });

  it("requires authentication for protected routes", async () => {
    const app = buildServer({
      logger: createLogger({
        serviceName: config.service.name,
        level: "silent",
        pretty: false,
        environment: "test",
      }),
    });

    const response = await app.inject({
      method: "GET",
      url: "/v1/settings/ping",
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
