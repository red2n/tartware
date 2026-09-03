import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Inbound webhook signature verification, shared by every service that accepts
 * a signed callback from an outside system.
 *
 * It lives here rather than in the service that needed it first because a
 * second copy is how two ingresses come to disagree about what a valid
 * signature is — and the one that is wrong is wrong in the direction that
 * accepts a forgery. `sse-token.ts` beside it is the same kind of primitive.
 *
 * Two callers today: billing's payment-gateway webhook and the channel
 * reservation ingress in reservations-command-service.
 */

/** How stale a timestamped signature may be before it is refused. */
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Constant-time HMAC-SHA256 verification. Supports two formats:
 *   Timestamped: "t=<unix>,v1=<hexSig>" — Stripe's, and validates recency, so
 *                a captured request cannot be replayed indefinitely.
 *   Generic:     "sha256=<hexSig>" or a bare "<hexSig>".
 *
 * Returns false on any parse or comparison failure — a signature that cannot be
 * understood is not a signature.
 *
 * @param rawBody         The exact bytes the sender signed. NEVER re-stringify
 *                        parsed JSON to produce these: key order and whitespace
 *                        will differ and every signature will fail, or worse,
 *                        a normalising round-trip will make two different
 *                        payloads verify against one signature.
 * @param signatureHeader The provider's signature header value.
 * @param secret          The tenant-scoped signing secret.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  try {
    if (!signatureHeader || !secret) return false;

    if (signatureHeader.startsWith("t=")) {
      const map: Record<string, string> = {};
      for (const part of signatureHeader.split(",")) {
        const eq = part.indexOf("=");
        if (eq > 0) map[part.slice(0, eq)] = part.slice(eq + 1);
      }
      const timestamp = Number(map.t);
      const receivedHex = map.v1;
      if (!timestamp || !receivedHex) return false;

      const ageSeconds = Math.floor(Date.now() / 1000) - timestamp;
      if (ageSeconds > TIMESTAMP_TOLERANCE_SECONDS || ageSeconds < -60) return false;

      const sigPayload = Buffer.from(`${timestamp}.${rawBody.toString("utf8")}`);
      const expectedHex = createHmac("sha256", secret).update(sigPayload).digest("hex");
      if (expectedHex.length !== receivedHex.length) return false;
      return timingSafeEqual(Buffer.from(expectedHex), Buffer.from(receivedHex));
    }

    const receivedHex = signatureHeader.startsWith("sha256=")
      ? signatureHeader.slice(7)
      : signatureHeader;
    const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (expectedHex.length !== receivedHex.length) return false;
    return timingSafeEqual(Buffer.from(expectedHex), Buffer.from(receivedHex));
  } catch {
    return false;
  }
}
