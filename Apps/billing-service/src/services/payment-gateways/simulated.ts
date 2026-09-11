/**
 * DEV DOC
 * Module: services/payment-gateways/simulated.ts
 * Purpose: A declared stub processor — contacts nothing, and says so on every
 *          row it produces.
 * Ownership: billing-service
 *
 * **Why a stub is the right second step.** Step 01 made `payment.authorize`
 * refuse when no processor is configured, which is correct and, on its own, a
 * regression: no property has a configuration, so the desk cannot take a card
 * at all. WS-09 hit the same wall and answered it the same way — `NONE` refuses,
 * `SIMULATED` is a stub a property has to *choose*, and every row it writes says
 * which of the two happened.
 *
 * The distinction that matters is not stub-versus-real. It is
 * **declared-versus-hidden**. Before this change the handler recorded
 * `status = 'AUTHORIZED'` with a `gateway_reference` supplied in the request
 * body: indistinguishable, in the ledger, from a bank approval. A simulated
 * authorization that announces itself is honest; a real-looking one that nobody
 * performed is the defect.
 *
 * So this adapter does two things and no more: it returns a deterministic
 * result, and it stamps `SIMULATED:` into the reference and the response so no
 * reader of `payments` can mistake it. It deliberately does not simulate
 * declines, 3DS or latency — a fake that is elaborate enough to be mistaken for
 * a real integration is the thing this file exists to prevent.
 */

import { randomUUID } from "node:crypto";

import type { ResolvedGateway } from "@tartware/schemas";

/** Marks every artefact this adapter produces. Grep-able, and stored. */
const SIMULATED_PREFIX = "SIMULATED";

export type GatewayCallResult = {
  /** What the processor calls this operation. Written to `gateway_reference`. */
  reference: string;
  /** Written to `gateway_name` — the provider, not a caller-supplied label. */
  name: string;
  /** Written to `gateway_response`. Carries the marker as data, not just text. */
  response: Record<string, unknown>;
};

/**
 * Authorize against the declared stub.
 *
 * Deterministic and always successful. A stub that randomly declined would make
 * every failure in the system ambiguous — an operator could not tell a seeded
 * decline from a real defect, and neither could a test.
 */
export const simulatedAuthorize = (
  gateway: ResolvedGateway,
  amount: number,
  currency: string,
): GatewayCallResult => {
  const reference = `${SIMULATED_PREFIX}-AUTH-${randomUUID()}`;
  return {
    reference,
    name: gateway.provider,
    response: {
      simulated: true,
      note: "No payment processor was contacted — gateway_provider is SIMULATED.",
      config_id: gateway.configId,
      environment: gateway.environment,
      amount,
      currency: currency.toUpperCase(),
      authorized_at: new Date().toISOString(),
    },
  };
};
