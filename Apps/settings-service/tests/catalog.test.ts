import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { createLogger } from "@tartware/telemetry";

import { buildServer } from "../src/server.js";
import { config } from "../src/config.js";

const TEST_TENANT_ID = "11111111-1111-1111-1111-111111111111";

const createToken = () => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: "317edc15-bd7b-4fec-afbd-be6a8f316f56",
    iss: config.auth.jwt.issuer,
    aud: config.auth.jwt.audience,
    scope: ["settings:read"],
    tenantId: TEST_TENANT_ID,
    iat: now,
    exp: now + 300,
  };

  const encode = (segment: unknown) =>
    Buffer.from(JSON.stringify(segment)).toString("base64url");

  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = createHmac("sha256", config.auth.jwt.secret)
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
};

const buildTestServer = () =>
  buildServer({
    logger: createLogger({
      serviceName: config.service.name,
      level: "silent",
      pretty: false,
      environment: "test",
    }),
  });

describe("settings catalog routes", () => {
  it("returns settings catalog when authenticated", async () => {
    const app = buildTestServer();
    const token = createToken();

    const response = await app.inject({
      method: "GET",
      url: "/v1/settings/catalog",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.categories.length).toBeGreaterThan(0);
    expect(body.meta.counts.definitions).toBeGreaterThan(0);
    await app.close();
  });

  it("returns a single category definition tree", async () => {
    const app = buildTestServer();
    const token = createToken();

    const response = await app.inject({
      method: "GET",
      url: "/v1/settings/catalog/ADMIN_USER_MANAGEMENT",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.category.code).toBe("ADMIN_USER_MANAGEMENT");
    expect(body.data.sections.length).toBeGreaterThan(0);
    expect(body.data.definitions.length).toBeGreaterThan(0);
    await app.close();
  });

  it("returns tenant scoped values", async () => {
    const app = buildTestServer();
    const token = createToken();

    const response = await app.inject({
      method: "GET",
      url: "/v1/settings/values",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.meta.sampleTenantId).toBe("317edc15-bd7b-4fec-afbd-be6a8f316f56");
    await app.close();
  });
});
