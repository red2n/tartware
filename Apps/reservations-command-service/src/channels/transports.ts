/**
 * DEV DOC
 * Module: channels/transports.ts
 * Purpose: The `ChannelTransport` adapters and the registry that picks one.
 * Ownership: reservations-command-service
 *
 * The contract is in `@tartware/schemas` (`api/channel-transport.ts`); this is
 * the composition root that turns an `ota_configurations` row into something
 * that can be called.
 *
 * There is deliberately no fallback. A channel whose `transport` is `NONE`
 * refuses the push rather than quietly succeeding — the whole finding this
 * file exists to fix is that three handlers recorded
 * `sync_status = 'completed', failed_items = 0` for a push that contacted
 * nothing, so an operator could not tell a working channel from an imaginary
 * one.
 */

import type {
  ChannelContentItem,
  ChannelInventoryItem,
  ChannelRateItem,
  ChannelTarget,
  ChannelTransport,
  ChannelTransportKind,
  ChannelTransportResult,
} from "@tartware/schemas";

import { reservationsLogger } from "../logger.js";
import { ReservationCommandError } from "../services/reservation-commands/common.js";

/** How long a channel manager gets to answer before the push is abandoned. */
const CHANNEL_PUSH_TIMEOUT_MS = 15_000;

/**
 * Declared stub. Contacts nothing, accepts everything, and stamps every result
 * `simulated` so the sync row it produces says which of the two happened.
 *
 * This is what the three handlers used to do implicitly, for every channel,
 * with no way to opt out and no mark on the record.
 */
class SimulatedChannelTransport implements ChannelTransport {
  readonly kind: ChannelTransportKind = "SIMULATED";

  private accept(target: ChannelTarget, count: number): ChannelTransportResult {
    reservationsLogger.info(
      { otaCode: target.ota_code, items: count },
      "Simulated channel push — no channel was contacted",
    );
    return {
      outcome: "COMPLETED",
      accepted_items: count,
      rejected_items: 0,
      channel_reference: null,
      http_status: null,
      response_time_ms: null,
      error_code: null,
      error_message: null,
      response_payload: null,
      simulated: true,
    };
  }

  async pushInventory(target: ChannelTarget, items: ChannelInventoryItem[]) {
    return this.accept(target, items.length);
  }

  async pushRates(target: ChannelTarget, items: ChannelRateItem[]) {
    return this.accept(target, items.length);
  }

  async pushContent(target: ChannelTarget, items: ChannelContentItem[]) {
    return this.accept(target, items.length);
  }
}

/**
 * Generic JSON-over-HTTPS adapter, posting to `ota_configurations.api_endpoint`.
 *
 * It is the shape a channel manager's REST API takes (SiteMinder, Cloudbeds and
 * Cloudbeds-alikes all speak a variant of it); a vendor whose message format
 * differs — HTNG/OTA XML, say — gets its own adapter beside this one rather
 * than a flag inside it.
 */
class HttpJsonChannelTransport implements ChannelTransport {
  readonly kind: ChannelTransportKind = "HTTP_JSON";

  async pushInventory(target: ChannelTarget, items: ChannelInventoryItem[]) {
    return this.post(target, "inventory", {
      hotel_id: target.hotel_id,
      inventory: items.map((item) => ({
        room_type_code: item.room_type_code,
        date: item.stay_date.toISOString().slice(0, 10),
        available: item.available,
        sold: item.sold,
        total_rooms: item.total_rooms,
      })),
    });
  }

  async pushRates(target: ChannelTarget, items: ChannelRateItem[]) {
    return this.post(target, "rates", {
      hotel_id: target.hotel_id,
      rates: items.map((item) => ({
        rate_code: item.ota_rate_code,
        amount: item.pushed_rate,
        currency: item.currency,
      })),
    });
  }

  async pushContent(target: ChannelTarget, items: ChannelContentItem[]) {
    return this.post(target, "content", {
      hotel_id: target.hotel_id,
      content: items.map((item) => ({
        type: item.content_type,
        reference_id: item.reference_id ?? null,
        language: item.language ?? null,
      })),
    });
  }

  /**
   * One request, one result.
   *
   * A channel rejection (4xx/5xx, or a body reporting rejected rows) is a
   * business outcome and comes back as FAILED/PARTIAL — retrying it would burn
   * the consumer's ladder on an answer that will not change. A transport
   * failure (timeout, socket, unparseable body) throws, because that is the
   * one a retry can fix.
   */
  private async post(
    target: ChannelTarget,
    path: string,
    body: Record<string, unknown>,
  ): Promise<ChannelTransportResult> {
    if (!target.api_endpoint) {
      throw new ReservationCommandError(
        "CHANNEL_ENDPOINT_MISSING",
        `Channel "${target.ota_code}" declares transport HTTP_JSON but has no api_endpoint`,
      );
    }

    const itemCount = Object.values(body).find(Array.isArray)?.length ?? 0;
    const url = `${target.api_endpoint.replace(/\/+$/, "")}/${path}`;
    const startedAt = Date.now();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(target.api_key ? { authorization: `Bearer ${target.api_key}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CHANNEL_PUSH_TIMEOUT_MS),
    });

    const responseTimeMs = Date.now() - startedAt;
    const raw = await response.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      // A body that is not JSON is only a transport problem when the channel
      // claimed success by it; a 4xx with an HTML error page is still a
      // perfectly legible rejection.
      if (response.ok) {
        throw new ReservationCommandError(
          "CHANNEL_RESPONSE_UNPARSEABLE",
          `Channel "${target.ota_code}" returned ${response.status} with a body that is not JSON`,
          true,
        );
      }
    }

    if (!response.ok) {
      return {
        outcome: "FAILED",
        accepted_items: 0,
        rejected_items: itemCount,
        channel_reference: null,
        http_status: response.status,
        response_time_ms: responseTimeMs,
        error_code: `HTTP_${response.status}`,
        error_message: raw.slice(0, 2000) || response.statusText,
        response_payload: parsed,
        simulated: false,
      };
    }

    // A channel that reports per-item results is believed over the status code:
    // 200 with ten rejected rows is a partial sync, and recording it as a clean
    // one is how a property loses ten days of inventory without a signal.
    const rejected = Number(parsed?.rejected ?? 0) || 0;
    const accepted = Number(parsed?.accepted ?? itemCount - rejected) || 0;

    return {
      outcome: rejected === 0 ? "COMPLETED" : accepted === 0 ? "FAILED" : "PARTIAL",
      accepted_items: accepted,
      rejected_items: rejected,
      channel_reference:
        typeof parsed?.reference === "string" ? parsed.reference.slice(0, 150) : null,
      http_status: response.status,
      response_time_ms: responseTimeMs,
      error_code: rejected > 0 ? "CHANNEL_REJECTED_ITEMS" : null,
      error_message: rejected > 0 ? `Channel rejected ${rejected} of ${itemCount} items` : null,
      response_payload: parsed,
      simulated: false,
    };
  }
}

const SIMULATED = new SimulatedChannelTransport();
const HTTP_JSON = new HttpJsonChannelTransport();

/**
 * Resolve the transport a channel is wired to.
 *
 * `NONE` throws rather than returning a no-op: a push that cannot reach a
 * channel has to fail where the operator can see it, and the throw is
 * non-retryable because no amount of waiting configures a channel.
 */
export const resolveChannelTransport = (kind: string, otaCode: string): ChannelTransport => {
  switch (kind) {
    case "SIMULATED":
      return SIMULATED;
    case "HTTP_JSON":
      return HTTP_JSON;
    default:
      throw new ReservationCommandError(
        "CHANNEL_TRANSPORT_NOT_CONFIGURED",
        `Channel "${otaCode}" has transport ${kind}; set ota_configurations.transport before pushing to it`,
      );
  }
};
