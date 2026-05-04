/**
 * Lightweight in-process circuit breaker for outbound HTTP calls.
 *
 * Pattern: CLOSED → (failures reach threshold) → OPEN → (after resetTimeoutMs)
 *          → HALF_OPEN → success → CLOSED, failure → OPEN.
 *
 * Designed for service-to-service `fetch()` calls that need fail-fast behaviour
 * when a downstream is misbehaving (avoid retry storms, cascade failures).
 *
 * For multi-replica fleets that need shared state across instances, layer
 * a Redis-backed store on top — see Apps/api-gateway/src/utils/circuit-breaker.ts
 * for that variant.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type CircuitBreakerOptions = {
	/** Identifier used in logs and the thrown error. */
	name: string;
	/** Consecutive failures before the circuit opens. Default: 5 */
	failureThreshold?: number;
	/** Milliseconds the circuit stays open before allowing a probe. Default: 30 000 */
	resetTimeoutMs?: number;
	/** Optional logger. */
	logger?: { warn: (obj: Record<string, unknown>, msg: string) => void };
	/** Optional callback when state changes (use for metrics). */
	onStateChange?: (from: CircuitState, to: CircuitState) => void;
};

export class CircuitOpenError extends Error {
	readonly statusCode = 503;
	readonly code = "CIRCUIT_OPEN";
	constructor(name: string) {
		super(`Circuit '${name}' is OPEN — fast-failing request`);
		this.name = "CircuitOpenError";
	}
}

export type CircuitBreaker = {
	/** Wrap an async call so it fast-fails when the circuit is OPEN. */
	exec: <T>(fn: () => Promise<T>) => Promise<T>;
	/** Current state — exposed for diagnostics/metrics. */
	state: () => CircuitState;
};

export const createCircuitBreaker = (
	opts: CircuitBreakerOptions,
): CircuitBreaker => {
	const failureThreshold = opts.failureThreshold ?? 5;
	const resetTimeoutMs = opts.resetTimeoutMs ?? 30_000;

	let state: CircuitState = "CLOSED";
	let failures = 0;
	let openedAt = 0;
	/** Single-probe gate so only one HALF_OPEN call is in-flight at a time. */
	let probing = false;

	const transition = (next: CircuitState): void => {
		if (next === state) return;
		const prev = state;
		state = next;
		opts.logger?.warn(
			{ name: opts.name, from: prev, to: next },
			"circuit-breaker state change",
		);
		opts.onStateChange?.(prev, next);
	};

	const onSuccess = (): void => {
		failures = 0;
		if (state !== "CLOSED") transition("CLOSED");
	};

	const onFailure = (): void => {
		if (state === "HALF_OPEN") {
			failures = 0;
			openedAt = Date.now();
			transition("OPEN");
			return;
		}
		failures += 1;
		if (failures >= failureThreshold) {
			openedAt = Date.now();
			transition("OPEN");
		}
	};

	const exec = async <T>(fn: () => Promise<T>): Promise<T> => {
		if (state === "OPEN") {
			if (Date.now() - openedAt < resetTimeoutMs) {
				throw new CircuitOpenError(opts.name);
			}
			// Allow exactly one probe.
			if (probing) {
				throw new CircuitOpenError(opts.name);
			}
			probing = true;
			transition("HALF_OPEN");
		}

		try {
			const result = await fn();
			onSuccess();
			return result;
		} catch (err) {
			onFailure();
			throw err;
		} finally {
			if (state === "HALF_OPEN") probing = false;
		}
	};

	return { exec, state: () => state };
};
