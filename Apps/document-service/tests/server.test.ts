import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";

import { folioFixture } from "./fixtures.js";

/**
 * Mint an HS256 token the service will accept.
 *
 * Hand-rolled rather than pulled from `jsonwebtoken` so the test suite needs no
 * dependency the service itself does not have.
 */
const b64 = (value: object | string): string =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value))
    .toString("base64url");

const signToken = (): string => {
  const secret = process.env.AUTH_JWT_SECRET ?? "";
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "11111111-1111-4111-8111-111111111111",
    iss: process.env.AUTH_JWT_ISSUER ?? "tartware-core",
    aud: process.env.AUTH_JWT_AUDIENCE ?? "tartware",
    iat: now,
    exp: now + 300,
  });
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
};

const server = buildServer();
await server.ready();

describe("probes are reachable without a token", () => {
  /**
   * A Kubernetes probe and a Prometheus scrape carry no bearer token. Gating
   * these reports a healthy service as permanently unready — which is exactly
   * what an earlier version of the public-path list did, by listing paths the
   * shared health routes do not register.
   */
  it.each(["/health", "/ready", "/metrics"])("%s answers unauthenticated", async (path) => {
    const response = await server.inject({ method: "GET", url: path });
    expect(response.statusCode).toBe(200);
  });

  it("reports what it can render in readiness", async () => {
    const response = await server.inject({ method: "GET", url: "/ready" });
    const body = response.json() as {
      documents?: { templates: string[]; locales: string[] };
    };
    expect(body.documents?.templates).toContain("FOLIO_STANDARD");
    expect(body.documents?.locales).toEqual(["en", "fr"]);
  });
});

describe("everything else needs a token", () => {
  it("refuses the template list without one", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/v1/documents/templates",
    });
    expect(response.statusCode).toBe(401);
  });

  it("refuses a render with a token signed by someone else", async () => {
    const forged = `${signToken().split(".").slice(0, 2).join(".")}.not-a-signature`;
    const response = await server.inject({
      method: "POST",
      url: "/v1/documents/render",
      headers: { authorization: `Bearer ${forged}` },
      payload: { template_id: "FOLIO_STANDARD", payload: folioFixture() },
    });
    expect(response.statusCode).toBe(401);
  });

  it("lists templates for an authenticated caller", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/v1/documents/templates",
      headers: { authorization: `Bearer ${signToken()}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [{ id: "FOLIO_STANDARD", kind: "FOLIO" }],
      locales: ["en", "fr"],
    });
  });
});

describe("POST /v1/documents/render", () => {
  const render = (payload: Record<string, unknown>) =>
    server.inject({
      method: "POST",
      url: "/v1/documents/render",
      headers: { authorization: `Bearer ${signToken()}` },
      payload,
    });

  it("returns PDF bytes, not a JSON envelope", async () => {
    const response = await render({
      template_id: "FOLIO_STANDARD",
      format: "PDF",
      locale: "en",
      payload: folioFixture(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("application/pdf");
    expect(response.rawPayload.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(response.headers["x-document-locale"]).toBe("en");
    expect(response.headers["x-document-template"]).toBe("FOLIO_STANDARD");
  });

  it("returns an HTML page when asked for one", async () => {
    const response = await render({
      template_id: "FOLIO_STANDARD",
      format: "HTML",
      locale: "fr",
      payload: folioFixture(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(response.body).toContain("Solde dû");
    expect(response.headers["x-document-locale"]).toBe("fr");
  });

  it("percent-encodes the title header so a non-Latin-1 title cannot break it", async () => {
    const response = await render({
      template_id: "FOLIO_STANDARD",
      format: "HTML",
      locale: "fr",
      payload: folioFixture(),
    });
    const title = response.headers["x-document-title"];
    expect(typeof title).toBe("string");
    expect(decodeURIComponent(String(title))).toBe("Note de séjour");
  });

  it("404s an unknown template", async () => {
    const response = await render({
      template_id: "NOT_A_TEMPLATE",
      payload: folioFixture(),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "TEMPLATE_NOT_FOUND" });
  });

  it("422s a payload that is not a folio, naming the fields", async () => {
    const response = await render({
      template_id: "FOLIO_STANDARD",
      payload: { kind: "FOLIO" },
    });
    expect(response.statusCode).toBe(422);
    const body = response.json() as { code: string; issues: Array<{ path: string }> };
    expect(body.code).toBe("PAYLOAD_INVALID");
    expect(body.issues.map((issue) => issue.path)).toContain("folio");
  });

  it("400s a malformed render request", async () => {
    const response = await render({ format: "PDF" });
    expect(response.statusCode).toBe(400);
  });
});
