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

/**
 * Lightweight per-target circuit breaker.
 *
 * States: CLOSED → (failures reach threshold) → OPEN → (resetTimeout expires) → HALF_OPEN
 *   - HALF_OPEN: one probe request; success → CLOSED, failure → OPEN
 */
class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private consecutiveFailures = 0;
  private openedAt = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly name: string;
  private readonly logger: MinimalLogger;

  constructor(name: string, options: CircuitBreakerOptions) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.logger = options.logger;
  }

  /** Returns true when the circuit allows a request through. */
  allowRequest(): boolean {
    if (this.state === "CLOSED") return true;

    if (this.state === "OPEN") {
      if (Date.now() - this.openedAt >= this.resetTimeoutMs) {
        this.transitionTo("HALF_OPEN");
        return true;
      }
      return false;
    }

    // HALF_OPEN — allow exactly one probe (subsequent callers blocked until probe resolves)
    return false;
  }

  /** Record a successful response — close the circuit. */
  recordSuccess(): void {
    if (this.state !== "CLOSED") {
      this.transitionTo("CLOSED");
    }
    this.consecutiveFailures = 0;
  }

  /** Record a failure — open the circuit if threshold reached. */
  recordFailure(): void {
    this.consecutiveFailures += 1;

    if (this.state === "HALF_OPEN") {
      this.transitionTo("OPEN");
      return;
    }

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.transitionTo("OPEN");
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  private transitionTo(newState: CircuitState): void {
    const previous = this.state;
    this.state = newState;

    if (newState === "OPEN") {
      this.openedAt = Date.now();
    }

    this.logger.warn(
      { circuit: this.name, from: previous, to: newState, failures: this.consecutiveFailures },
      "circuit breaker state transition",
    );
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
