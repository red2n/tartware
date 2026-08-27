/**
 * Tenant throttler.
 *
 * The throttler paces outbox publishes so one busy tenant cannot monopolise a
 * Kafka partition. Its clock, sleep and jitter source are all injectable, so
 * the pacing can be asserted exactly rather than by sleeping in a test.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createTenantThrottler } from "../src/throttler.js";

/** A throttler with a controllable clock, recording what it was asked to wait. */
const harness = (options: {
	minSpacingMs: number;
	maxJitterMs: number;
	random?: () => number;
	maxTrackedTenants?: number;
}) => {
	const waits: number[] = [];
	let now = 1_000;
	const throttle = createTenantThrottler({
		...options,
		now: () => now,
		random: options.random ?? (() => 0),
		delayFn: async (ms) => {
			waits.push(ms);
			now += ms;
		},
	});
	return {
		throttle,
		waits,
		advance: (ms: number) => {
			now += ms;
		},
	};
};

describe("createTenantThrottler", () => {
	it("does not wait on a tenant's first publish", async () => {
		const { throttle, waits } = harness({ minSpacingMs: 100, maxJitterMs: 0 });

		await throttle("tenant-a");

		assert.deepEqual(waits, []);
	});

	it("waits out the remaining spacing on a second publish", async () => {
		const { throttle, waits, advance } = harness({
			minSpacingMs: 100,
			maxJitterMs: 0,
		});

		await throttle("tenant-a");
		advance(30);
		await throttle("tenant-a");

		assert.deepEqual(waits, [70]);
	});

	it("does not wait once the spacing has already elapsed", async () => {
		const { throttle, waits, advance } = harness({
			minSpacingMs: 100,
			maxJitterMs: 0,
		});

		await throttle("tenant-a");
		advance(250);
		await throttle("tenant-a");

		assert.deepEqual(waits, []);
	});

	it("paces each tenant independently", async () => {
		const { throttle, waits } = harness({ minSpacingMs: 100, maxJitterMs: 0 });

		await throttle("tenant-a");
		await throttle("tenant-b");

		// Neither has published before, so neither waits.
		assert.deepEqual(waits, []);
	});

	it("adds jitter on top of the spacing", async () => {
		const { throttle, waits, advance } = harness({
			minSpacingMs: 100,
			maxJitterMs: 20,
			random: () => 0.5,
		});

		await throttle("tenant-a");
		advance(40);
		await throttle("tenant-a");

		// 60ms of spacing left, plus floor(0.5 * 21) = 10ms of jitter.
		assert.deepEqual(waits, [10, 70]);
	});

	it("is a no-op when neither spacing nor jitter is configured", async () => {
		const { throttle, waits } = harness({ minSpacingMs: 0, maxJitterMs: 0 });

		await throttle("tenant-a");
		await throttle("tenant-a");

		assert.deepEqual(waits, []);
	});

	it("paces publishes that carry no tenant under one shared key", async () => {
		const { throttle, waits, advance } = harness({
			minSpacingMs: 100,
			maxJitterMs: 0,
		});

		await throttle(null);
		advance(10);
		await throttle(undefined);

		assert.deepEqual(waits, [90]);
	});

	it("evicts the least recently used tenant past the tracking cap", async () => {
		const { throttle, waits, advance } = harness({
			minSpacingMs: 100,
			maxJitterMs: 0,
			maxTrackedTenants: 2,
		});

		await throttle("tenant-a");
		await throttle("tenant-b");
		await throttle("tenant-c"); // evicts tenant-a, the oldest

		advance(10);
		await throttle("tenant-a"); // forgotten, so treated as a first publish

		assert.deepEqual(waits, []);
	});
});
