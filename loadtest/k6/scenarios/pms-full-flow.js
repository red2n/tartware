/**
 * Full PMS write flow, at fleet scale.
 *
 * Exercises the command mix a property management system actually carries
 * rather than one command repeated: reservations created, modified, checked in
 * and out, folio charges posted, payments taken, rooms and housekeeping
 * updated. Every one goes through `POST /v1/commands/:name/execute`, so each
 * request pays the whole accept path — auth, tenant scope, module gate, payload
 * validation, registry resolution, feature flag, and the transaction that
 * writes the dispatch row and the outbox row together.
 *
 * Load is spread across a fleet of gateway processes (`GATEWAY_URLS`). One Node
 * process is one event loop; a fleet-scale target needs a fleet, the same way
 * the Kubernetes deployment runs one.
 *
 * Commands are asynchronous by design — a 202 means durably accepted, not
 * applied — so this cannot chain request-to-response. Guests and reservations
 * are seeded first and their ids passed in, which is also what lets the mix use
 * real aggregates instead of random UUIDs that would fail every foreign key.
 *
 * Prerequisites, neither of which the harness does for you:
 *   1. Command feature flags ship `disabled` for all 195 commands — every write
 *      409s until they are enabled. See
 *      executables/test-accounts-realdata/test-multi-tenant.sh.
 *   2. Seed guests and reservations, and pass their ids via GUEST_IDS /
 *      RESERVATION_IDS (see loadtest/seed-flow-data.sh).
 */

import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

import { uuid } from "../lib/utils.js";

const GATEWAY_URLS = (__ENV.GATEWAY_URLS || __ENV.GATEWAY_URL || "http://localhost:8085")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

const TENANT_ID = __ENV.TENANT_ID || "11111111-1111-1111-1111-111111111111";
const PROPERTY_ID = __ENV.PROPERTY_ID || "22222222-2222-2222-2222-222222222222";
const ROOM_TYPE_ID = __ENV.ROOM_TYPE_ID || "44444444-4444-4444-4444-444444444444";

const GUEST_IDS = (__ENV.GUEST_IDS || "").split(",").filter(Boolean);
const RESERVATION_IDS = (__ENV.RESERVATION_IDS || "").split(",").filter(Boolean);
const ROOM_IDS = (__ENV.ROOM_IDS || "").split(",").filter(Boolean);

const startRate = Number(__ENV.START_RATE || 1000);
const peakRate = Number(__ENV.PEAK_RATE || 20000);
const rampDuration = __ENV.RAMP_DURATION || "60s";
const holdDuration = __ENV.HOLD_DURATION || "60s";

const accepted = new Counter("commands_accepted");
const rejected = new Counter("commands_rejected");
const acceptRate = new Rate("command_accept_rate");
const acceptLatency = new Trend("command_accept_latency", true);
/** Per-command-family acceptance, so one failing family cannot hide in the total. */
const familyLatency = {};
const familyRejects = {};

export const options = {
  scenarios: {
    pmsFlow: {
      executor: "ramping-arrival-rate",
      startRate,
      timeUnit: "1s",
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 2000),
      maxVUs: Number(__ENV.MAX_VUS || 12000),
      stages: [
        { target: peakRate, duration: rampDuration },
        { target: peakRate, duration: holdDuration },
      ],
      gracefulStop: "20s",
    },
  },
  // Capacity discovery: a threshold abort would hide the shape of the curve
  // past the point where it matters most.
  thresholds: {},
  discardResponseBodies: true,
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const futureDay = (offset) => {
  const date = new Date(Date.UTC(2026, 9, 1));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

/**
 * The write mix of a working property.
 *
 * Weighted toward reservation churn and folio activity, which is where a real
 * PMS spends its writes: every stay produces one booking but many charges,
 * status changes and housekeeping updates.
 */
const buildCommand = () => {
  const roll = Math.random();
  const guestId = GUEST_IDS.length > 0 ? pick(GUEST_IDS) : uuid();
  const reservationId = RESERVATION_IDS.length > 0 ? pick(RESERVATION_IDS) : uuid();

  if (roll < 0.24) {
    const checkIn = 1 + Math.floor(Math.random() * 60);
    return {
      family: "reservation.create",
      name: "reservation.create",
      payload: {
        property_id: PROPERTY_ID,
        room_type_id: ROOM_TYPE_ID,
        guest_id: guestId,
        check_in_date: futureDay(checkIn),
        check_out_date: futureDay(checkIn + 1 + Math.floor(Math.random() * 4)),
        adults: 1 + Math.floor(Math.random() * 3),
        children: Math.floor(Math.random() * 2),
        rate_code: "BAR",
        total_amount: Math.round((120 + Math.random() * 600) * 100) / 100,
      },
    };
  }

  if (roll < 0.34) {
    return {
      family: "billing.charge.post",
      name: "billing.charge.post",
      payload: {
        property_id: PROPERTY_ID,
        reservation_id: reservationId,
        amount: Math.round((10 + Math.random() * 250) * 100) / 100,
        charge_code: pick(["ROOM", "FNB", "MINIBAR", "SPA", "PARKING"]),
        posting_type: "DEBIT",
        quantity: 1,
        description: "Load test charge",
      },
    };
  }

  if (roll < 0.44) {
    return {
      family: "billing.payment.authorize",
      name: "billing.payment.authorize",
      payload: {
        payment_reference: `LT-${uuid().slice(0, 12)}`,
        property_id: PROPERTY_ID,
        reservation_id: reservationId,
        guest_id: guestId,
        amount: Math.round((50 + Math.random() * 500) * 100) / 100,
        payment_method: pick(["CREDIT_CARD", "CASH", "BANK_TRANSFER"]),
      },
    };
  }

  if (roll < 0.56) {
    return {
      family: "reservation.check_in",
      name: "reservation.check_in",
      payload: {
        reservation_id: reservationId,
        ...(ROOM_IDS.length > 0 ? { room_id: pick(ROOM_IDS) } : {}),
      },
    };
  }

  if (roll < 0.66) {
    return {
      family: "reservation.check_out",
      name: "reservation.check_out",
      payload: { reservation_id: reservationId },
    };
  }

  if (roll < 0.74) {
    return {
      family: "reservation.modify",
      name: "reservation.modify",
      payload: {
        reservation_id: reservationId,
        property_id: PROPERTY_ID,
        adults: 1 + Math.floor(Math.random() * 3),
      },
    };
  }

  if (roll < 0.80) {
    return {
      family: "reservation.cancel",
      name: "reservation.cancel",
      payload: {
        reservation_id: reservationId,
        property_id: PROPERTY_ID,
        reason: "GUEST_REQUEST",
      },
    };
  }

  if (roll < 0.90) {
    return {
      family: "housekeeping.task.create",
      name: "housekeeping.task.create",
      payload: {
        property_id: PROPERTY_ID,
        ...(ROOM_IDS.length > 0 ? { room_id: pick(ROOM_IDS) } : {}),
        task_type: pick(["STAYOVER", "DEPARTURE", "DEEP_CLEAN", "INSPECTION"]),
        priority: pick(["LOW", "NORMAL", "HIGH"]),
      },
    };
  }

  return {
    family: "guest.register",
    name: "guest.register",
    payload: {
      first_name: `Guest${Math.floor(Math.random() * 100000)}`,
      last_name: "Flow",
      email: `flow${uuid().slice(0, 12)}@example.com`,
      phone: "+15550000000",
    },
  };
};

export function setup() {
  // Authenticate once against the first gateway; the token is valid fleet-wide.
  const response = http.post(
    `${GATEWAY_URLS[0]}/v1/auth/login`,
    JSON.stringify({
      username: __ENV.ADMIN_USERNAME || "setup.admin",
      password: __ENV.ADMIN_PASSWORD || "TempPass1234",
    }),
    {
      headers: { "Content-Type": "application/json" },
      // `discardResponseBodies` is on for the load requests, where the body is
      // dead weight — but the token only exists in this one.
      responseType: "text",
    },
  );
  if (response.status !== 200) {
    throw new Error(`login failed: HTTP ${response.status} ${response.body}`);
  }
  return { token: response.json("access_token") };
}

export default function (data) {
  const command = buildCommand();
  // Round-robin across the fleet so no single process becomes the ceiling.
  const base = GATEWAY_URLS[__VU % GATEWAY_URLS.length];

  const response = http.post(
    `${base}/v1/commands/${command.name}/execute`,
    JSON.stringify({ tenant_id: TENANT_ID, payload: command.payload }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.token}`,
        "Idempotency-Key": uuid(),
      },
      tags: { command: command.family },
    },
  );

  const ok = response.status === 202;
  check(response, { "accepted (202)": () => ok });

  acceptRate.add(ok);
  acceptLatency.add(response.timings.duration);

  if (!familyLatency[command.family]) {
    familyLatency[command.family] = new Trend(`accept_latency_${command.family}`, true);
    familyRejects[command.family] = new Counter(`rejected_${command.family}`);
  }
  familyLatency[command.family].add(response.timings.duration);

  if (ok) {
    accepted.add(1);
  } else {
    rejected.add(1);
    familyRejects[command.family].add(1);
  }
}
