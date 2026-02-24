import { setTimeout as delay } from "node:timers/promises";

type RetryAttemptContext = {
  attempt: number;
  delayMs: number;
  error: unknown;
};

type RetryOptions = {
  maxRetries: number;
  delayScheduleMs?: number[];
  baseDelayMs: number;
  jitterFactor?: number;
  onRetry?: (context: RetryAttemptContext) => void;
};

type RetryResult<T> = {
  value: T;
  attempts: number;
};

export class RetryExhaustedError extends Error {
  public readonly attempts: number;

  constructor(message: string, attempts: number, options?: { cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "RetryExhaustedError";
    this.attempts = attempts;
  }
}

/**
 * Execute an async operation with configurable retry + exponential backoff.
 *
 * Supports either a fixed `delayScheduleMs` array or exponential backoff
 * from `baseDelayMs` with optional jitter.
 */
export const processWithRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<RetryResult<T>> => {
  const maxRetries = Math.max(0, options.maxRetries);
  const baseDelayMs = Math.max(1, options.baseDelayMs);
  const schedule = Array.isArray(options.delayScheduleMs)
    ? options.delayScheduleMs.filter((value) => Number.isFinite(value) && value > 0)
    : [];
  const hasSchedule = schedule.length > 0;
  const jitterFactor = options.jitterFactor !== undefined ? options.jitterFactor : 0.2;

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
      const scheduleDelay = schedule[scheduleIndex] ?? baseDelayMs;
      const rawDelay = hasSchedule ? scheduleDelay : baseDelayMs * 2 ** attempt;
      const jitterBase = rawDelay;
      const jitter = jitterFactor === 0 ? 0 : Math.random() * jitterBase * jitterFactor;
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
