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

/**
 * Per-tenant manifest: token, property, and the aggregate ids that tenant owns.
 *
 * A user is authorised per tenant, so one token cannot drive fifty of them —
 * every command for a tenant the caller is not a member of is refused. Running
 * with a single token produced a 1.94% acceptance rate, almost exactly the 1-in-51
 * that authorisation allows, and measured nothing but the cost of a 403.
 */
const MANIFEST = JSON.parse(open(__ENV.MANIFEST_PATH || "/tmp/tartware-flow-manifest.json"));

const GATEWAY_URLS = (__ENV.GATEWAY_URLS || __ENV.GATEWAY_URL || "http://localhost:8085")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

/**
 * `TENANT_PAIRS` is a comma-separated list of `tenantId:propertyId`.
 *
 * Paired rather than two independent lists because a property belongs to
 * exactly one tenant: drawing them separately would send most commands with a
 * property the tenant does not own, and the run would measure authorisation
 * failures instead of throughput. Falls back to the single seeded tenant.
 */
const TENANT_PAIRS = (__ENV.TENANT_PAIRS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const [tenantId, propertyId] = entry.split(":");
    return { tenantId, propertyId };
  });

const FALLBACK_PAIR = {
  tenantId: __ENV.TENANT_ID || "11111111-1111-1111-1111-111111111111",
  propertyId: __ENV.PROPERTY_ID || "22222222-2222-2222-2222-222222222222",
};

const ROOM_TYPE_ID = __ENV.ROOM_TYPE_ID || "44444444-4444-4444-4444-444444444444";

const GUEST_IDS = (__ENV.GUEST_IDS || "").split(",").filter(Boolean);
const RESERVATION_IDS = (__ENV.RESERVATION_IDS || "").split(",").filter(Boolean);
const ROOM_IDS = (__ENV.ROOM_IDS || "").split(",").filter(Boolean);

const startRate = Number(__ENV.START_RATE || 1000);
const peakRate = Number(__ENV.PEAK_RATE || 20000);
const rampDuration = __ENV.RAMP_DURATION || "60s";
const holdDuration = __ENV.HOLD_DURATION || "60s";

const availabilityLatency = new Trend("availability_latency", true);
const rateLatency = new Trend("rate_lookup_latency", true);
const readErrors = new Rate("read_errors");
/**
 * Read outcomes counted by HTTP status.
 *
 * "98% of reads failed" is not a diagnosis — a 429, a 500 and a proxy timeout
 * each mean something different and are fixed in different places. Counting the
 * status is what turns the number into a cause.
 *
 * Every counter is declared here because k6 only permits metric creation in the
 * init context: building one on first sight of a status throws inside the
 * iteration and silently kills the rest of that code path, which is exactly how
 * the read metrics disappeared while availability latency kept recording.
 */
const READ_STATUSES = [0, 200, 400, 401, 403, 404, 429, 500, 502, 503, 504];
const readStatus = {};
for (const code of READ_STATUSES) {
  readStatus[code] = new Counter(`read_status_${code}`);
}
const readStatusOther = new Counter("read_status_other");

const countRead = (response) => {
  const counter = readStatus[response.status || 0];
  (counter || readStatusOther).add(1);
};
const totalOps = new Counter("total_ops");
const accepted = new Counter("commands_accepted");
const rejected = new Counter("commands_rejected");
const acceptRate = new Rate("command_accept_rate");
const acceptLatency = new Trend("command_accept_latency", true);

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
  const entry = pick(MANIFEST);
  const tenantId = entry.tenantId;
  const propertyId = entry.propertyId;
  const token = entry.token;
  const roomTypeId = entry.roomTypeId || ROOM_TYPE_ID;
  // Only ids this tenant owns: the guest and reservation foreign keys are
  // composite on tenant_id, so borrowing another tenant's id always fails.
  const guestId = entry.guestIds && entry.guestIds.length > 0 ? pick(entry.guestIds) : uuid();
  const reservationId =
    entry.reservationIds && entry.reservationIds.length > 0
      ? pick(entry.reservationIds)
      : uuid();
  const roomIds = entry.roomIds || [];

  if (roll < 0.24) {
    const checkIn = 1 + Math.floor(Math.random() * 60);
    return {
      tenantId,
      token,
      family: "reservation.create",
      name: "reservation.create",
      payload: {
        property_id: propertyId,
        room_type_id: roomTypeId,
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
      tenantId,
      token,
      family: "billing.charge.post",
      name: "billing.charge.post",
      payload: {
        property_id: propertyId,
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
      tenantId,
      token,
      family: "billing.payment.authorize",
      name: "billing.payment.authorize",
      payload: {
        payment_reference: `LT-${uuid().slice(0, 12)}`,
        property_id: propertyId,
        reservation_id: reservationId,
        guest_id: guestId,
        amount: Math.round((50 + Math.random() * 500) * 100) / 100,
        payment_method: pick(["CREDIT_CARD", "CASH", "BANK_TRANSFER"]),
      },
    };
  }

  if (roll < 0.56) {
    return {
      tenantId,
      token,
      family: "reservation.check_in",
      name: "reservation.check_in",
      payload: {
        reservation_id: reservationId,
        ...(roomIds.length > 0 ? { room_id: pick(roomIds) } : {}),
      },
    };
  }

  if (roll < 0.66) {
    return {
      tenantId,
      token,
      family: "reservation.check_out",
      name: "reservation.check_out",
      payload: { reservation_id: reservationId },
    };
  }

  if (roll < 0.74) {
    return {
      tenantId,
      token,
      family: "reservation.modify",
      name: "reservation.modify",
      payload: {
        reservation_id: reservationId,
        property_id: propertyId,
        adults: 1 + Math.floor(Math.random() * 3),
      },
    };
  }

  if (roll < 0.80) {
    return {
      tenantId,
      token,
      family: "reservation.cancel",
      name: "reservation.cancel",
      payload: {
        reservation_id: reservationId,
        property_id: propertyId,
        reason: "GUEST_REQUEST",
      },
    };
  }

  if (roll < 0.90) {
    return {
      tenantId,
      token,
      family: "housekeeping.task.create",
      name: "housekeeping.task.create",
      payload: {
        property_id: propertyId,
        ...(roomIds.length > 0 ? { room_id: pick(roomIds) } : {}),
        task_type: pick(["STAYOVER", "DEPARTURE", "DEEP_CLEAN", "INSPECTION"]),
        priority: pick(["LOW", "NORMAL", "HIGH"]),
      },
    };
  }

  return {
    tenantId,
    token,
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

/**
 * The shop-then-book sequence a real booking performs.
 *
 * A property management system never writes a reservation cold: the caller
 * searches availability for the stay window, prices it against the rate plans,
 * and only then books. Firing `reservation.create` on its own measures the
 * write path but not the funnel that produces it — and the funnel is where most
 * of a PMS's request volume actually lives.
 *
 * Counted separately from commands so the headline number cannot be inflated by
 * cheap reads: `commands_accepted` stays the write figure, `total_ops` is the
 * whole request volume.
 */
const shopBeforeBooking = (base, token, tenantId, propertyId, checkIn, checkOut) => {
  // The tenant's own token, not the harness login. Authorisation is per tenant,
  // so searching one tenant's availability with another's credentials is a 403 —
  // which looked exactly like a read-capacity problem and is not one.
  const headers = { Authorization: `Bearer ${token}` };

  const availability = http.get(
    `${base}/v1/rooms/availability?tenant_id=${tenantId}&property_id=${propertyId}` +
      `&check_in_date=${checkIn}&check_out_date=${checkOut}`,
    { headers, tags: { op: "availability" } },
  );
  availabilityLatency.add(availability.timings.duration);
  countRead(availability);
  readErrors.add(availability.status !== 200);
  totalOps.add(1);

  const rates = http.get(
    `${base}/v1/rates?tenant_id=${tenantId}&property_id=${propertyId}`,
    { headers, tags: { op: "rates" } },
  );
  rateLatency.add(rates.timings.duration);
  countRead(rates);
  readErrors.add(rates.status !== 200);
  totalOps.add(1);
};

export default function (data) {
  const command = buildCommand();
  // Round-robin across the fleet so no single process becomes the ceiling.
  const base = GATEWAY_URLS[__VU % GATEWAY_URLS.length];

  if (command.family === "reservation.create") {
    shopBeforeBooking(
      base,
      command.token,
      command.tenantId,
      command.payload.property_id,
      command.payload.check_in_date,
      command.payload.check_out_date,
    );
  }

  totalOps.add(1);
  const response = http.post(
    `${base}/v1/commands/${command.name}/execute`,
    JSON.stringify({ tenant_id: command.tenantId, payload: command.payload }),
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${command.token}`,
        "Idempotency-Key": uuid(),
      },
      tags: { command: command.family },
    },
  );

  const ok = response.status === 202;
  check(response, { "accepted (202)": () => ok });

  acceptRate.add(ok);
  acceptLatency.add(response.timings.duration);

  // Per-family breakdown comes from the `command` tag on the request rather
  // than a metric per family: k6 can split any metric by tag, and building the
  // metrics at runtime is what broke the read path.
  if (ok) {
    accepted.add(1);
  } else {
    rejected.add(1);
  }
}
