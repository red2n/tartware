import { describe, expect, it, vi } from "vitest";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
	createLogSanitizer,
	withRequestLogging,
	DEFAULT_LOG_REDACT_CENSOR,
} from "../src/index.js";

describe("log sanitizer", () => {
	it("redacts sensitive fields recursively", () => {
		const sanitize = createLogSanitizer();
		const sample = {
			email: "user@example.com",
			nested: {
				password: "secret",
				details: [{ token: "abc" }, { safe: "ok" }],
			},
		};

		expect(sanitize(sample)).toEqual({
			email: DEFAULT_LOG_REDACT_CENSOR,
			nested: {
				password: DEFAULT_LOG_REDACT_CENSOR,
				details: [
					{ token: DEFAULT_LOG_REDACT_CENSOR },
					{ safe: "ok" },
				],
			},
		});
	});
});

const createMockApp = (): FastifyInstance & {
	__hooks: Record<string, Array<(...args: any[]) => unknown>>;
} => {
	const hooks: Record<string, Array<(...args: any[]) => unknown>> = {};
	return {
		__hooks: hooks,
		addHook(name: string, handler: (...args: any[]) => unknown) {
			if (!hooks[name]) {
				hooks[name] = [];
			}
			hooks[name]?.push(handler);
		},
	} as unknown as FastifyInstance & {
		__hooks: Record<string, Array<(...args: any[]) => unknown>>;
	};
};

describe("withRequestLogging", () => {
	it("sanitizes request and response logs", async () => {
		const app = createMockApp();
		withRequestLogging(app, {
			includeBody: true,
			includeRequestHeaders: true,
			includeResponseHeaders: true,
		});

		const onRequest = app.__hooks.onRequest?.[0];
		const onResponse = app.__hooks.onResponse?.[0];
		expect(onRequest).toBeTypeOf("function");
		expect(onResponse).toBeTypeOf("function");

		const requestLog = vi.fn();
		const request = {
			id: "req-1",
			method: "POST",
			url: "/test",
			query: { email: "user@example.com" },
			params: { tenantId: "tenant-1" },
			body: { password: "secret" },
			headers: { authorization: "Bearer token" },
			log: { info: requestLog },
		} as unknown as FastifyRequest;

		await onRequest?.(request);

		expect(requestLog).toHaveBeenCalledWith(
			{
				requestId: "req-1",
				method: "POST",
				url: "/test",
				query: { email: DEFAULT_LOG_REDACT_CENSOR },
				params: { tenantId: "tenant-1" },
				body: { password: DEFAULT_LOG_REDACT_CENSOR },
				headers: { authorization: DEFAULT_LOG_REDACT_CENSOR },
			},
			"request received",
		);

		const responseLog = vi.fn();
		request.log.info = responseLog;

		const reply = {
			statusCode: 200,
			elapsedTime: 42,
			getResponseTime: () => 42,
			getHeaders: () => ({ "set-cookie": "session=abc" }),
		} as unknown as FastifyReply;

	await onResponse?.(request, reply);

	expect(responseLog).toHaveBeenCalledWith(
		{
			requestId: "req-1",
			method: "POST",
			url: "/test",
			statusCode: 200,
			durationMs: 42,
			responseHeaders: { "set-cookie": "session=abc" },
		},
		"request completed",
	);
});
});
