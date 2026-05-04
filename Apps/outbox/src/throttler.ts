import { setTimeout as delay } from "node:timers/promises";

export type TenantThrottlerOptions = {
	minSpacingMs: number;
	maxJitterMs: number;
	cleanupIntervalMs?: number;
	/**
	 * Hard cap on number of tenants tracked. When exceeded, oldest entries (by
	 * insertion order) are evicted. Prevents unbounded memory growth on
	 * high-tenant deployments. Default: 50_000.
	 */
	maxTrackedTenants?: number;
	now?: () => number;
	delayFn?: (ms: number) => Promise<void>;
	random?: () => number;
};

export type TenantThrottler = (tenantId?: string | null) => Promise<void>;

const noopThrottler: TenantThrottler = async () => {};

/**
 * Enforces a minimum spacing between publishes for the same tenant while adding
 * optional jitter to avoid hammering Kafka partitions with bursty batches.
 */
export const createTenantThrottler = (
	options: TenantThrottlerOptions,
): TenantThrottler => {
	const minSpacing = Math.max(0, Math.trunc(options.minSpacingMs));
	const maxJitter = Math.max(0, Math.trunc(options.maxJitterMs));

	if (minSpacing === 0 && maxJitter === 0) {
		return noopThrottler;
	}

	const nowFn = options.now ?? Date.now;
	const delayFn = options.delayFn ?? delay;
	const randomFn = options.random ?? Math.random;

	const cleanupInterval = Math.max(
		options.cleanupIntervalMs ?? Math.max(minSpacing * 10, 60_000),
		1_000,
	);
	const maxTrackedTenants = Math.max(
		1,
		Math.trunc(options.maxTrackedTenants ?? 50_000),
	);

	const lastPublished = new Map<string, number>();
	let lastCleanupAt = 0;
	const cleanupTimer = setInterval(() => {
		maybeCleanup(nowFn());
	}, cleanupInterval);
	cleanupTimer.unref?.();

	const maybeCleanup = (nowTs: number) => {
		if (nowTs - lastCleanupAt < cleanupInterval) {
			return;
		}
		lastCleanupAt = nowTs;
		for (const [tenantId, publishedAt] of lastPublished.entries()) {
			if (nowTs - publishedAt > cleanupInterval) {
				lastPublished.delete(tenantId);
			}
		}
	};

	const calculateJitter = (): number => {
		if (maxJitter === 0) {
			return 0;
		}
		return Math.floor(randomFn() * (maxJitter + 1));
	};

	return async (tenantId?: string | null) => {
		const key =
			tenantId && tenantId.length > 0 ? tenantId : "__unknown_tenant__";
		const startedAt = nowFn();
		maybeCleanup(startedAt);

		let waitMs = 0;
		const lastPublish = lastPublished.get(key);
		if (minSpacing > 0 && lastPublish !== undefined) {
			const elapsed = startedAt - lastPublish;
			if (elapsed < minSpacing) {
				waitMs += minSpacing - elapsed;
			}
		}
		waitMs += calculateJitter();

		if (waitMs > 0) {
			await delayFn(waitMs);
		}

		// LRU bump: re-insert key so it becomes most-recently-used in iteration order.
		lastPublished.delete(key);
		lastPublished.set(key, startedAt + waitMs);

		// Hard cap: evict oldest entries (front of insertion order) when over the limit.
		while (lastPublished.size > maxTrackedTenants) {
			const oldestKey = lastPublished.keys().next().value;
			if (oldestKey === undefined) break;
			lastPublished.delete(oldestKey);
		}
	};
};
