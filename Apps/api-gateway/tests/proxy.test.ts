import type { FastifyReply, FastifyRequest } from "fastify";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxyRequest } from "../src/utils/proxy.js";

vi.mock("../src/utils/circuit-breaker.js", () => ({
  getCircuitBreaker: () => ({
    allowRequest: () => true,
    getState: () => "closed",
    recordFailure: vi.fn(),
    recordSuccess: vi.fn(),
  }),
}));

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const createReply = (): {
  reply: FastifyReply;
  state: {
    statusCode: number;
    headers: Map<string, string>;
    body: unknown;
  };
} => {
  const state = {
    statusCode: 200,
    headers: new Map<string, string>(),
    body: undefined as unknown,
  };

  const reply = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    header(key: string, value: string) {
      state.headers.set(key.toLowerCase(), value);
      return this;
    },
    send(payload: unknown) {
      state.body = payload;
      return this;
    },
  };

  return { reply: reply as unknown as FastifyReply, state };
};

const createRequest = (): FastifyRequest =>
  ({
    method: "GET",
    url: "/v1/self-service/booking/ABC123",
    raw: { url: "/v1/self-service/booking/ABC123" },
    headers: {},
    log: {
      warn: vi.fn(),
      error: vi.fn(),
    },
  }) as unknown as FastifyRequest;

describe("proxyRequest", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redacts nested guest-portal fields and drops upstream body validators", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          reservation: {
            guest_name: "Ada Lovelace",
            passport_number: "P1234567",
            metadata: { vip: true },
          },
          guests: [
            {
              id_number: "ID-1",
              notes: "sensitive",
              loyalty_tier: "gold",
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": "999",
            etag: '"upstream-etag"',
            "x-request-id": "req-1",
          },
        },
      ),
    );

    const request = createRequest();
    const { reply, state } = createReply();

    await proxyRequest(request, reply, "http://localhost:3010", true);

    expect(state.statusCode).toBe(200);
    expect(state.headers.get("content-type")).toBe("application/json");
    expect(state.headers.get("x-request-id")).toBe("req-1");
    expect(state.headers.has("etag")).toBe(false);
    expect(state.headers.has("content-length")).toBe(false);
    expect(state.body).toEqual({
      reservation: {
        guest_name: "Ada Lovelace",
      },
      guests: [
        {
          loyalty_tier: "gold",
        },
      ],
    });
  });
});
