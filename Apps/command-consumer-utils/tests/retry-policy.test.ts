/**
 * Retry policy conformance.
 *
 * `processWithRetry` retries everything unless given a predicate, which is the
 * wrong default for a command consumer: commands are consumed in partition
 * order, so retrying a deterministic rejection burns the whole backoff ladder,
 * stalls every command queued behind it, and still routes to the DLQ.
 *
 * Five of nine consumers used to omit the predicate entirely. The policy now
 * lives in one place and applies unless a consumer opts out, so these tests
 * guard the default itself rather than each consumer's wiring.
 */

import { describe, expect, it } from "vitest";

import { COMMAND_ERROR_BRAND, CommandError } from "../src/command-utils.js";
import { isRetryableByDefault } from "../src/consumer-lifecycle.js";

class RoomCommandError extends CommandError {}

describe("isRetryableByDefault", () => {
  it("does not retry a business rejection", () => {
    expect(isRetryableByDefault(new CommandError("GUEST_NOT_FOUND", "Guest not found"))).toBe(false);
  });

  it("retries a CommandError explicitly marked transient", () => {
    expect(
      isRetryableByDefault(new CommandError("DB_WRITE_FAILED", "Write failed", true)),
    ).toBe(true);
  });

  it("applies the same rule to a service subclass", () => {
    expect(isRetryableByDefault(new RoomCommandError("ROOM_NOT_FOUND", "Room not found"))).toBe(
      false,
    );
    expect(isRetryableByDefault(new RoomCommandError("ROOM_LOCKED", "Locked", true))).toBe(true);
  });

  it("retries an unrecognised failure", () => {
    // An infrastructure error carries no verdict of its own, so the safe read
    // is that it may be transient — a dropped connection, a restarting broker.
    expect(isRetryableByDefault(new Error("ECONNREFUSED"))).toBe(true);
    expect(isRetryableByDefault({ code: "08006" })).toBe(true);
    expect(isRetryableByDefault(undefined)).toBe(true);
  });
});

describe("CommandError", () => {
  it("defaults retryable to false, so a handler must opt in to retries", () => {
    expect(new CommandError("CODE", "message").retryable).toBe(false);
  });

  it("reports the concrete subclass name, keeping DLQ entries diagnosable", () => {
    expect(new RoomCommandError("ROOM_NOT_FOUND", "Room not found").name).toBe("RoomCommandError");
  });

  it("serialises code and retryable, which pino's err serializer drops", () => {
    expect(new RoomCommandError("ROOM_NOT_FOUND", "Room not found", true).toJSON()).toEqual({
      name: "RoomCommandError",
      code: "ROOM_NOT_FOUND",
      message: "Room not found",
      retryable: true,
    });
  });
});

describe("a CommandError from another copy of this module", () => {
  /**
   * Why this exists, and why every test above it passed while the policy was
   * broken in production.
   *
   * Services run from source through tsx, and reach their siblings by
   * specifier: `@tartware/command-consumer-utils/command-utils` hit a tsconfig
   * path into `src`, while `/lifecycle` — whose file is `consumer-lifecycle.ts`,
   * so the `/*` wildcard missed it — fell through the exports map to `dist`.
   * Two copies of this module, two `CommandError` classes, and an `instanceof`
   * check between them that was simply false. Deterministic failures retried
   * four times and stalled their partition for ~36s each, with nothing in the
   * logs saying why beyond a DLQ entry whose own JSON read `"retryable": false`.
   *
   * The tests above import one copy and cannot see any of that. This class is
   * what the other copy looks like from here: same shape, same brand, unrelated
   * identity. The paths are fixed too — but the policy no longer depends on it.
   */
  class ForeignCommandError extends Error {
    readonly [Symbol.toStringTag] = COMMAND_ERROR_BRAND;
    readonly code: string;
    readonly retryable: boolean;

    constructor(code: string, message: string, retryable = false) {
      super(message);
      this.name = "CommandError";
      this.code = code;
      this.retryable = retryable;
    }
  }

  it("is recognised even though instanceof is false", () => {
    const foreign = new ForeignCommandError("REASON_CODE_NOT_FOUND", "not configured");
    expect(foreign instanceof CommandError).toBe(false);
    expect(isRetryableByDefault(foreign)).toBe(false);
  });

  it("still honours a transient one", () => {
    expect(
      isRetryableByDefault(new ForeignCommandError("DB_WRITE_FAILED", "write failed", true)),
    ).toBe(true);
  });

  it("does not mistake a plain object wearing the brand for one", () => {
    // The brand is necessary, not sufficient: the retry policy reads `code` and
    // `retryable`, so anything claiming to be a CommandError must carry both,
    // and be an Error at all.
    expect(isRetryableByDefault({ [Symbol.toStringTag]: COMMAND_ERROR_BRAND })).toBe(true);
    expect(
      isRetryableByDefault(
        Object.assign(new Error("boom"), { code: "X", retryable: false }),
      ),
    ).toBe(true);
  });
});
