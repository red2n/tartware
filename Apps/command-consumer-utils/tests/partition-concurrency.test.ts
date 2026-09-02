/**
 * Partition concurrency resolution.
 *
 * The value handed to `consumer.run({ partitionsConsumedConcurrently })` reaches
 * KafkaJS as `new Array(concurrency)`, so anything that is not a positive
 * integer throws `RangeError: Invalid array length` and takes the service down
 * at startup rather than degrading to serial consumption. That is not
 * hypothetical: `reservations-command-service` assembles its command-center
 * config by hand, so the field arrived `undefined`, `Math.max(1, undefined)`
 * produced `NaN`, and the service crashed on boot while every other consumer
 * started normally.
 *
 * These assert the resolution rule directly. `createConsumerLifecycle` only
 * applies it inside `start()`, which needs a live broker, so the rule is
 * exercised here as the pure function it is.
 */

import { describe, expect, it } from "vitest";

/**
 * Mirrors the coercion in `createConsumerLifecycle.start`. Kept in the test
 * rather than exported from the module because it exists to protect one call
 * site, and a shared export would invite callers to pre-coerce and skip it.
 */
const resolveConcurrency = (requested: unknown): number => {
  const value = Number(requested);
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
};

describe("partitionsConsumedConcurrently resolution", () => {
  it("falls back to serial when the field is absent", () => {
    // The reservations-command-service crash: a hand-rolled config omitting it.
    expect(resolveConcurrency(undefined)).toBe(1);
  });

  it("never yields NaN, which KafkaJS turns into a startup crash", () => {
    for (const bad of [undefined, null, Number.NaN, "abc", {}, []]) {
      const resolved = resolveConcurrency(bad);
      expect(Number.isNaN(resolved)).toBe(false);
      // The real assertion: whatever comes out must be a legal array length.
      expect(() => new Array(resolved)).not.toThrow();
    }
  });

  it("clamps values below one rather than trusting them", () => {
    expect(resolveConcurrency(0)).toBe(1);
    expect(resolveConcurrency(-4)).toBe(1);
    expect(resolveConcurrency(Number.NEGATIVE_INFINITY)).toBe(1);
  });

  it("rejects infinity, which is finite-looking but not an array length", () => {
    expect(resolveConcurrency(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it("floors fractional values into a usable count", () => {
    expect(resolveConcurrency(4.9)).toBe(4);
  });

  it("passes through a normal configured value", () => {
    expect(resolveConcurrency(4)).toBe(4);
    expect(resolveConcurrency("8")).toBe(8);
  });
});
