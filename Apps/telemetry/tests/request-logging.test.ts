import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
	createLogSanitizer,
	withRequestLogging,
	DEFAULT_LOG_REDACT_CENSOR,
} from "../src/index.js";

type MockFn = ((...args: unknown[]) => void) & { calls: unknown[][] };

const createMockFn = (): MockFn => {
	const calls: unknown[][] = [];
	const fn = ((...args: unknown[]) => {
		calls.push(args);
	}) as MockFn;
	fn.calls = calls;
	return fn;
};

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

		assert.deepStrictEqual(sanitize(sample), {
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

	it("redacts email patterns even when the key is not flagged", () => {
		const sanitize = createLogSanitizer();
		const sample = {
			notes: "Contact guest at guest@example.com for follow-up",
		};

		assert.deepStrictEqual(sanitize(sample), {
			notes: DEFAULT_LOG_REDACT_CENSOR,
		});
	});

	it("redacts credit card numbers using Luhn detection", () => {
		const sanitize = createLogSanitizer();
		const sample = {
			comment: "Card 4111 1111 1111 1111 expires soon",
			other: "no pii here",
		};

		assert.deepStrictEqual(sanitize(sample), {
			comment: DEFAULT_LOG_REDACT_CENSOR,
			other: "no pii here",
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
		assert.strictEqual(typeof onRequest, "function");
		assert.strictEqual(typeof onResponse, "function");

		const requestLog = createMockFn();
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

		assert.deepStrictEqual(requestLog.calls[0], [
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
		]);

		const responseLog = createMockFn();
		request.log.info = responseLog;

		const reply = {
			statusCode: 200,
			elapsedTime: 42,
			getResponseTime: () => 42,
			getHeaders: () => ({ "set-cookie": "session=abc" }),
		} as unknown as FastifyReply;

		await onResponse?.(request, reply);

		assert.deepStrictEqual(responseLog.calls[0], [
			{
				requestId: "req-1",
				method: "POST",
				url: "/test",
				statusCode: 200,
				durationMs: 42,
				responseHeaders: { "set-cookie": "session=abc" },
			},
			"request completed",
		]);
	});
});
