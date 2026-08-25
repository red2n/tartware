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

import { CommandError } from "../src/command-utils.js";
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
