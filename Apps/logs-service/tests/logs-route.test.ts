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
							"@timestamp": "2025-11-14T10:00:00.000Z",
							time_unix_nano: 1763114400000000000,
							severity: { text: "INFO" },
							body: { message: "Processed request" },
							trace: { id: "trace-123", span: { id: "span-456" } },
							attributes: { "http.status_code": 200 },
							resource: { service: { name: "api-gateway" } },
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
			timestamp: "2025-11-14T10:00:00.000Z",
			service: "api-gateway",
			severity: "INFO",
			traceId: "trace-123",
			spanId: "span-456",
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

	it("uses time_unix_nano for sorting and filtering", async () => {
  const fastify = Fastify({ ignoreTrailingSlash: true });
  await fastify.register(logsRoute);
  await fastify.ready();

		(searchLogs as vi.Mock).mockResolvedValue({
			hits: {
				total: { value: 1, relation: "eq" },
				hits: [
					{
						_id: "def",
						_source: {
							observedTimestamp: "2025-11-14T10:00:00.000Z",
							time_unix_nano: 1763114400000000000,
							severity_text: "ERROR",
							resource: { service: { name: "core-service" } },
						},
						sort: [1763114400000000000, "trace-999", "def"],
					},
				],
			},
		});

		const from = encodeURIComponent("2025-11-14T00:00:00.000Z");
		const to = encodeURIComponent("2025-11-15T00:00:00.000Z");
		const response = await fastify.inject({
			method: "GET",
			url: `/v1/logs?from=${from}&to=${to}&size=1`,
		});

		expect(response.statusCode).toBe(200);
		const [[searchArgs]] = (searchLogs as vi.Mock).mock.calls;
		expect(searchArgs.body.query.bool.filter).toEqual([
			{
				bool: {
					minimum_should_match: 1,
					should: [
						{
							range: {
								"@timestamp": {
									gte: "2025-11-14T00:00:00.000Z",
									lte: "2025-11-15T00:00:00.000Z",
								},
							},
						},
						{
							range: {
								observedTimestamp: {
									gte: "2025-11-14T00:00:00.000Z",
									lte: "2025-11-15T00:00:00.000Z",
								},
							},
						},
						{
							range: {
								time_unix_nano: {
									gte: 1763078400000000000,
									lte: 1763164800000000000,
								},
							},
						},
					],
				},
			},
		]);

		const body = response.json();
		expect(body.entries[0].timestamp).toBe("2025-11-14T10:00:00.000Z");
		expect(body.entries[0].service).toBe("core-service");
		expect(body.nextCursor).not.toBeNull();
	});
});
