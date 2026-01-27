import { setTimeout as delay } from "node:timers/promises";

/**
 * Context passed to retry callbacks so callers can observe backoff behavior.
 */
type RetryAttemptContext = {
  /**
   * 1-based attempt number (1 = first retry after the initial failure).
   */
  attempt: number;
  /**
   * Delay in milliseconds applied before the next retry.
   */
  delayMs: number;
  /**
   * The error thrown by the previous attempt.
   */
  error: unknown;
};

/**
 * Configuration for {@link processWithRetry}.
 */
type RetryOptions = {
  /**
   * Maximum number of retries (failures) before surfacing the error.
   * A value of 0 means no retries (single attempt).
   */
  maxRetries: number;
  /**
   * Optional explicit delay schedule in milliseconds. When provided,
   * each retry attempt uses the corresponding delay from the list.
   * If the number of retries exceeds the schedule length, the last
   * delay value is reused.
   */
  delayScheduleMs?: number[];
  /**
   * Base delay applied to the first retry attempt. Subsequent retries
   * use exponential backoff.
   */
  baseDelayMs: number;
  /**
   * Optional jitter multiplier (0-1). Defaults to 0.2 (20% jitter).
   */
  jitterFactor?: number;
  /**
   * Optional callback invoked before each retry attempt.
   */
  onRetry?: (context: RetryAttemptContext) => void;
};

/**
 * Result returned by {@link processWithRetry}.
 */
type RetryResult<T> = {
  /**
   * Value returned by the operation.
   */
  value: T;
  /**
   * Number of attempts performed (includes the successful one).
   */
  attempts: number;
};

/**
 * Error thrown when all retry attempts are exhausted.
 */
export class RetryExhaustedError extends Error {
  /**
   * Total attempts performed before failing.
   */
  public readonly attempts: number;

  constructor(
    message: string,
    attempts: number,
    options?: { cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
  }
}

/**
 * Executes an async operation with bounded retries, exponential backoff,
 * and jitter to reduce thundering herds.
 *
 * @param operation - async function to execute
 * @param options - retry configuration (max attempts, backoff, callbacks)
 */
export const processWithRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<RetryResult<T>> => {
  const maxRetries = Math.max(0, options.maxRetries);
  const baseDelayMs = Math.max(1, options.baseDelayMs);
  const schedule = Array.isArray(options.delayScheduleMs)
    ? options.delayScheduleMs.filter(
        (value) => Number.isFinite(value) && value > 0,
      )
    : [];
  const hasSchedule = schedule.length > 0;
  const jitterFactor =
    options.jitterFactor !== undefined ? options.jitterFactor : 0.2;

  let attempt = 0;

  for (;;) {
    try {
      const value = await operation();
      return { value, attempts: attempt + 1 };
    } catch (error) {
      if (attempt >= maxRetries) {
        throw new RetryExhaustedError(
          "Operation failed after maximum retry attempts",
          attempt + 1,
          { cause: error },
        );
      }

      const scheduleIndex = Math.min(attempt, Math.max(0, schedule.length - 1));
      const rawDelay = hasSchedule
        ? schedule[scheduleIndex]
        : baseDelayMs * 2 ** attempt;
      const jitterBase = rawDelay;
      const jitter =
        jitterFactor === 0 ? 0 : Math.random() * jitterBase * jitterFactor;
      const delayMs = rawDelay + jitter;

      options.onRetry?.({
        attempt: attempt + 1,
        delayMs,
        error,
      });

      await delay(delayMs);
      attempt += 1;
    }
  }
};
