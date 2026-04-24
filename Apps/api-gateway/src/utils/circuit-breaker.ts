import { circuitBreakerStateTotal } from "../lib/metrics.js";
import { getRedisClient } from "../lib/redis.js";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

type MinimalLogger = {
  warn: (obj: Record<string, unknown>, msg: string) => void;
};

type CircuitBreakerOptions = {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  failureThreshold?: number;
  /** Milliseconds to keep the circuit open before trying a probe. Default: 30 000 */
  resetTimeoutMs?: number;
  /** Logger instance for state transition events */
  logger: MinimalLogger;
};

/** Redis hash field names for circuit state. */
const FIELD_STATE = "s";
const FIELD_FAILURES = "f";
const FIELD_OPENED_AT = "o";

/**
 * Lua script for atomic failure recording in Redis.
 * Uses HINCRBY so concurrent recordFailure() calls never undercount.
 *
 * KEYS[1] = circuit-breaker hash key
 * ARGV[1] = failure threshold
 * ARGV[2] = TTL in seconds
 * ARGV[3] = current timestamp (ms) for openedAt when opening
 *
 * Returns: {previousState, newState, newFailures, openedAt}
 */
const RECORD_FAILURE_LUA = `
local state = redis.call('HGET', KEYS[1], 's')
if not state then
  state = 'CLOSED'
  redis.call('HSET', KEYS[1], 's', 'CLOSED')
end
local oa = redis.call('HGET', KEYS[1], 'o') or '0'

if state == 'HALF_OPEN' then
  redis.call('HSET', KEYS[1], 's', 'OPEN', 'f', '0', 'o', ARGV[3])
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
  return {state, 'OPEN', '0', ARGV[3]}
end

local nf = redis.call('HINCRBY', KEYS[1], 'f', 1)

if nf >= tonumber(ARGV[1]) then
  redis.call('HSET', KEYS[1], 's', 'OPEN', 'o', ARGV[3])
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
  return {state, 'OPEN', tostring(nf), ARGV[3]}
end

redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return {state, state, tostring(nf), oa}
`;

/**
 * Lightweight per-target circuit breaker with shared Redis state.
 *
 * When Redis is available, state is stored in a hash key per target so all
 * gateway replicas share a single view of circuit health. When Redis is
 * unavailable the breaker falls back to process-local state (same behaviour
 * as the previous in-memory-only implementation).
 *
 * States: CLOSED → (failures reach threshold) → OPEN → (resetTimeout expires) → HALF_OPEN
 *   - HALF_OPEN: one probe request; success → CLOSED, failure → OPEN
 */
class CircuitBreaker {
  /** In-memory fallback state — used when Redis is not available. */
  private localState: CircuitState = "CLOSED";
  private localFailures = 0;
  private localOpenedAt = 0;

  /**
   * Synchronous single-probe gate for the OPEN→HALF_OPEN transition.
   * Set immediately (no await) so only the first caller in the event loop
   * tick wins; cleared when the circuit moves out of HALF_OPEN.
   */
  private halfOpenProbeGranted = false;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly name: string;
  private readonly redisKey: string;
  private readonly logger: MinimalLogger;

  constructor(name: string, options: CircuitBreakerOptions) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.logger = options.logger;
    // Deterministic key; keyPrefix is applied by ioredis
    this.redisKey = `cb:${name}`;
  }

  // ---------------------------------------------------------------------------
  // Redis helpers (all silently fall back to local state on error)
  // ---------------------------------------------------------------------------

  private async readState(): Promise<{ state: CircuitState; failures: number; openedAt: number }> {
    const redis = getRedisClient();
    if (!redis) {
      return { state: this.localState, failures: this.localFailures, openedAt: this.localOpenedAt };
    }
    try {
      const data = await redis.hgetall(this.redisKey);
      if (!data || !data[FIELD_STATE]) {
        return { state: "CLOSED", failures: 0, openedAt: 0 };
      }
      return {
        state: (data[FIELD_STATE] as CircuitState) ?? "CLOSED",
        failures: Number(data[FIELD_FAILURES] ?? 0),
        openedAt: Number(data[FIELD_OPENED_AT] ?? 0),
      };
    } catch {
      return { state: this.localState, failures: this.localFailures, openedAt: this.localOpenedAt };
    }
  }

  private async writeState(state: CircuitState, failures: number, openedAt: number): Promise<void> {
    // Always keep local copy in sync for fallback
    this.localState = state;
    this.localFailures = failures;
    this.localOpenedAt = openedAt;

    const redis = getRedisClient();
    if (!redis) return;
    try {
      const ttl = Math.ceil((this.resetTimeoutMs * 3) / 1000);
      await redis
        .multi()
        .hset(
          this.redisKey,
          FIELD_STATE,
          state,
          FIELD_FAILURES,
          String(failures),
          FIELD_OPENED_AT,
          String(openedAt),
        )
        .expire(this.redisKey, ttl)
        .exec();
    } catch {
      // Swallow — local state is still consistent
    }
  }

  // ---------------------------------------------------------------------------
  // Public API — all async to support Redis round-trip
  // ---------------------------------------------------------------------------

  /** Returns true when the circuit allows a request through. */
  async allowRequest(): Promise<boolean> {
    const { state, openedAt } = await this.readState();

    if (state === "CLOSED") return true;

    if (state === "OPEN") {
      if (Date.now() - openedAt >= this.resetTimeoutMs) {
        // Synchronous gate: only the first caller between awaits wins.
        // Subsequent concurrent callers see the flag and fall through.
        if (this.halfOpenProbeGranted) return false;
        this.halfOpenProbeGranted = true;
        await this.transitionTo("HALF_OPEN");
        return true;
      }
      return false;
    }

    // HALF_OPEN — allow exactly one probe (subsequent callers blocked until probe resolves)
    return false;
  }

  /** Record a successful response — close the circuit. */
  async recordSuccess(): Promise<void> {
    const { state } = await this.readState();
    if (state !== "CLOSED") {
      await this.transitionTo("CLOSED");
    }
    await this.writeState("CLOSED", 0, 0);
  }

  /** Record a failure — open the circuit if threshold reached. */
  async recordFailure(): Promise<void> {
    const redis = getRedisClient();
    if (redis) {
      try {
        const ttl = Math.ceil((this.resetTimeoutMs * 3) / 1000);
        const now = String(Date.now());
        const result = (await redis.eval(
          RECORD_FAILURE_LUA,
          1,
          this.redisKey,
          String(this.failureThreshold),
          String(ttl),
          now,
        )) as string[];

        const [previous, newState, failures, openedAt] = result;

        // Keep local fallback in sync
        this.localState = newState as CircuitState;
        this.localFailures = Number(failures);
        this.localOpenedAt = Number(openedAt);

        // Side-effects for state transitions (logging + metrics)
        if (previous !== newState) {
          if (newState !== "HALF_OPEN") {
            this.halfOpenProbeGranted = false;
          }
          this.logger.warn(
            { circuit: this.name, from: previous, to: newState, failures: Number(failures) },
            "circuit breaker state transition",
          );
          circuitBreakerStateTotal.inc({ target: this.name, state: newState });
        }
        return;
      } catch {
        // Redis unavailable — fall through to local path
      }
    }

    // Local-only path: single-threaded Node.js, no race condition
    const state = this.localState;
    const failures = this.localFailures;
    const openedAt = this.localOpenedAt;
    const newFailures = failures + 1;

    if (state === "HALF_OPEN") {
      await this.transitionTo("OPEN");
      return;
    }

    if (newFailures >= this.failureThreshold) {
      await this.transitionTo("OPEN");
      return;
    }

    await this.writeState(state, newFailures, openedAt);
  }

  async getState(): Promise<CircuitState> {
    const { state } = await this.readState();
    return state;
  }

  private async transitionTo(newState: CircuitState): Promise<void> {
    const { state: previous, failures } = await this.readState();

    // Reset the single-probe gate when leaving HALF_OPEN
    if (newState !== "HALF_OPEN") {
      this.halfOpenProbeGranted = false;
    }

    const openedAt = newState === "OPEN" ? Date.now() : 0;
    const newFailures = newState === "CLOSED" ? 0 : failures;

    await this.writeState(newState, newFailures, openedAt);

    this.logger.warn(
      { circuit: this.name, from: previous, to: newState, failures },
      "circuit breaker state transition",
    );

    circuitBreakerStateTotal.inc({ target: this.name, state: newState });
  }
}

/** Registry of circuit breakers keyed by service name. */
const breakers = new Map<string, CircuitBreaker>();

export const getCircuitBreaker = (name: string, options: CircuitBreakerOptions): CircuitBreaker => {
  let breaker = breakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, options);
    breakers.set(name, breaker);
  }
  return breaker;
};
