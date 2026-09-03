import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyWebhookSignature } from "../src/webhook-signature.js";

const SECRET = "whsec_test_secret";
const body = Buffer.from(JSON.stringify({ id: "evt_1", amount: 1200 }));

const generic = (payload: Buffer, secret = SECRET) =>
  `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

const timestamped = (payload: Buffer, at: number, secret = SECRET) => {
  const signed = Buffer.from(`${at}.${payload.toString("utf8")}`);
  return `t=${at},v1=${createHmac("sha256", secret).update(signed).digest("hex")}`;
};

describe("generic signatures", () => {
  it("accepts a correct sha256= signature", () => {
    expect(verifyWebhookSignature(body, generic(body), SECRET)).toBe(true);
  });

  it("accepts a bare hex signature", () => {
    expect(verifyWebhookSignature(body, generic(body).slice(7), SECRET)).toBe(true);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyWebhookSignature(body, generic(body, "other"), SECRET)).toBe(false);
  });

  it("rejects a signature over different bytes", () => {
    // The reason callers must keep the raw Buffer: re-stringifying parsed JSON
    // reorders keys and changes whitespace, and every signature then fails.
    const reordered = Buffer.from(JSON.stringify({ amount: 1200, id: "evt_1" }));
    expect(verifyWebhookSignature(reordered, generic(body), SECRET)).toBe(false);
  });
});

describe("timestamped signatures", () => {
  const now = () => Math.floor(Date.now() / 1000);

  it("accepts a fresh one", () => {
    expect(verifyWebhookSignature(body, timestamped(body, now()), SECRET)).toBe(true);
  });

  it("refuses a replayed one beyond the tolerance window", () => {
    expect(verifyWebhookSignature(body, timestamped(body, now() - 600), SECRET)).toBe(
      false,
    );
  });

  it("refuses one dated well into the future", () => {
    expect(verifyWebhookSignature(body, timestamped(body, now() + 600), SECRET)).toBe(
      false,
    );
  });
});

describe("malformed input", () => {
  it.each([
    ["", "empty header"],
    ["sha256=", "empty digest"],
    ["t=,v1=", "no timestamp"],
    ["t=abc,v1=def", "unparseable timestamp"],
    ["not-a-signature", "not hex"],
  ])("refuses %j (%s)", (header) => {
    expect(verifyWebhookSignature(body, header, SECRET)).toBe(false);
  });

  it("refuses when no secret is configured", () => {
    // A channel with no api_secret must not be verifiable by an empty string.
    expect(verifyWebhookSignature(body, generic(body, ""), "")).toBe(false);
  });
});
