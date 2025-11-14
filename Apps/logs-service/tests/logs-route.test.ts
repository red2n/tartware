import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import logsRoute from "../src/routes/logs.js";

vi.mock("../src/opensearch.js", async () => {
	const actual = await vi.importActual("../src/opensearch.js");
	return {
		...actual,
		searchLogs: vi.fn(),
	};
});

const { searchLogs } = await import("../src/opensearch.js");

describe("logs route", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("returns normalized log entries", async () => {
  const fastify = Fastify({ ignoreTrailingSlash: true });
  await fastify.register(logsRoute);
  await fastify.ready();

		(searchLogs as vi.Mock).mockResolvedValue({
			hits: {
				total: { value: 1, relation: "eq" },
				hits: [
					{
						_id: "abc",
						_source: {
							time: "2025-11-14T10:00:00.000Z",
							severity_text: "INFO",
							body: { message: "Processed request" },
							trace_id: "trace-123",
							span_id: "span-456",
							attributes: { "http.status_code": 200 },
							resource: { "service.name": "api-gateway" },
						},
						sort: ["cursor"],
					},
				],
			},
		});

		const response = await fastify.inject({
			method: "GET",
      url: "/v1/logs?service=api-gateway&severity=INFO",
		});

		expect(response.statusCode).toBe(200);
		const body = response.json();
		expect(body.entries).toHaveLength(1);
		expect(body.entries[0]).toMatchObject({
			id: "abc",
			service: "api-gateway",
			severity: "INFO",
			traceId: "trace-123",
			attributes: { "http.status_code": 200 },
		});
		expect(body.nextCursor).toBeNull();
		expect(body.total).toBe(1);
	});

	it("rejects invalid query parameters", async () => {
  const fastify = Fastify({ ignoreTrailingSlash: true });
  await fastify.register(logsRoute);
  await fastify.ready();

		const response = await fastify.inject({
			method: "GET",
      url: "/v1/logs?size=999999",
		});

		expect(response.statusCode).toBe(400);
		const body = response.json();
		expect(body.error).toBe("INVALID_QUERY");
	});
});
