/**
 * Generic reference-data cache (L1: in-process LRU + TTL).
 *
 * Designed for read-heavy reference tables (charge codes, room types,
 * rate plans, settings definitions, tenant config, GL batch IDs). Each
 * cache entry is bounded by both `ttlMs` (max age) and `maxSize`
 * (LRU eviction).
 *
 * For multi-instance fleets that need a shared cache (e.g. invalidate-on-write),
 * layer a Redis-backed L2 on top of this by:
 *   1. On miss, read L1 → if absent, read Redis → if absent, call `loader`.
 *   2. On `invalidate`, publish an invalidation event so peer instances drop L1.
 *
 * The helper itself is sync-friendly and has no external deps.
 */

export type ReferenceCacheOptions<K, V> = {
	/** Human-friendly name (used in metrics/logs). */
	name: string;
	/** Max number of entries before LRU eviction. */
	maxSize: number;
	/** Time-to-live in milliseconds. Use `Number.POSITIVE_INFINITY` to disable. */
	ttlMs: number;
	/** Resolver invoked on cache miss. Returning `null`/`undefined` is NOT cached. */
	loader: (key: K) => Promise<V | null | undefined>;
	/** Convert key → string (for Map storage and event keys). Defaults to `String(key)`. */
	keyFn?: (key: K) => string;
};

type Entry<V> = { value: V; expiresAt: number };

export type ReferenceCache<K, V> = {
	/** Read-through: returns cached value, loads + stores on miss, or null. */
	get: (key: K) => Promise<V | null>;
	/** Force-evict a single entry (e.g. after a write). */
	invalidate: (key: K) => void;
	/** Drop every entry (e.g. on tenant-wide config change). */
	invalidateAll: () => void;
	/** Pre-populate with already-known values (skips loader). */
	primeMany: (entries: ReadonlyArray<readonly [K, V]>) => void;
	/** Current entry count — useful for metrics. */
	size: () => number;
};

export const createReferenceCache = <K, V>(
	opts: ReferenceCacheOptions<K, V>,
): ReferenceCache<K, V> => {
	const keyFn = opts.keyFn ?? ((k: K) => String(k));
	// Map preserves insertion order, which we exploit for LRU.
	const store = new Map<string, Entry<V>>();
	// De-dupe in-flight loader calls per key (cache-stampede protection).
	const inflight = new Map<string, Promise<V | null>>();

	const evictIfFull = (): void => {
		if (store.size <= opts.maxSize) return;
		const overflow = store.size - opts.maxSize;
		let i = 0;
		for (const k of store.keys()) {
			if (i++ >= overflow) break;
			store.delete(k);
		}
	};

	const touch = (k: string, entry: Entry<V>): void => {
		// LRU bump — re-insert moves to end.
		store.delete(k);
		store.set(k, entry);
	};

	const get = async (key: K): Promise<V | null> => {
		const k = keyFn(key);
		const now = Date.now();
		const hit = store.get(k);
		if (hit) {
			if (hit.expiresAt > now) {
				touch(k, hit);
				return hit.value;
			}
			store.delete(k);
		}

		const pending = inflight.get(k);
		if (pending) return pending;

		const promise = (async () => {
			try {
				const loaded = await opts.loader(key);
				if (loaded === null || loaded === undefined) return null;
				store.set(k, { value: loaded, expiresAt: Date.now() + opts.ttlMs });
				evictIfFull();
				return loaded;
			} finally {
				inflight.delete(k);
			}
		})();
		inflight.set(k, promise);
		return promise;
	};

	const invalidate = (key: K): void => {
		store.delete(keyFn(key));
	};

	const invalidateAll = (): void => {
		store.clear();
	};

	const primeMany = (entries: ReadonlyArray<readonly [K, V]>): void => {
		const expiresAt = Date.now() + opts.ttlMs;
		for (const [k, v] of entries) {
			store.set(keyFn(k), { value: v, expiresAt });
		}
		evictIfFull();
	};

	return { get, invalidate, invalidateAll, primeMany, size: () => store.size };
};
