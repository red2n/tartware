/**
 * Command-path capacity discovery.
 *
 * Measures the write path the Command Center actually exposes:
 * `POST /v1/commands/:name/execute`, which is where a request is validated,
 * routed, and committed to the transactional outbox. Publishing to Kafka is the
 * outbox dispatcher's job, so a 202 here means "durably accepted", and this
 * scenario measures acceptance throughput rather than end-to-end domain
 * processing.
 *
 * Deliberately separate from `command-pipeline.js`, which posts to
 * `/v1/reservations` — a route the gateway does not serve, so every request
 * there 404s before reaching any of this.
 *
 * Ramps arrival rate rather than fixing VUs: the question is the rate at which
 * acceptance starts failing or latency runs away, and a fixed VU count answers a
 * different question (how fast a set number of clients can go round-robin).
 *
 * Prerequisite the harness does not handle: command feature flags ship
 * `disabled` for all 195 commands, so every write 409s until they are enabled.
 * See executables/test-accounts-realdata/test-multi-tenant.sh, which documents
 * the same trap.
 */

import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

import { uuid } from "../lib/utils.js";

const BASE_URL = __ENV.GATEWAY_URL || "http://localhost:8080";
const TENANT_ID = __ENV.TENANT_ID || "11111111-1111-1111-1111-111111111111";
const PROPERTY_ID = __ENV.PROPERTY_ID || "22222222-2222-2222-2222-222222222222";
const ROOM_TYPE_ID = __ENV.ROOM_TYPE_ID || "44444444-4444-4444-4444-444444444444";
const COMMAND_NAME = __ENV.COMMAND_NAME || "reservation.create";
/**
 * Supply a real guest id to exercise the consumer as well as the gateway.
 * Left unset, each request carries a random one: acceptance still succeeds
 * (the gateway does not resolve foreign keys), but every command then fails
 * `fk_reservations_tenant_guest_id` downstream and no reservation is created —
 * so the run measures acceptance only. Register a guest via
 * `guest.register` first and pass its id here for an end-to-end measurement.
 */
const GUEST_ID = __ENV.GUEST_ID || "";

const startRate = Number(__ENV.START_RATE || 50);
const peakRate = Number(__ENV.PEAK_RATE || 1200);
const rampDuration = __ENV.RAMP_DURATION || "90s";
const holdDuration = __ENV.HOLD_DURATION || "45s";

const accepted = new Counter("commands_accepted");
const rejected = new Counter("commands_rejected");
const acceptRate = new Rate("command_accept_rate");
const acceptLatency = new Trend("command_accept_latency", true);

export const options = {
  scenarios: {
    commandCapacity: {
      executor: "ramping-arrival-rate",
      startRate,
      timeUnit: "1s",
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 200),
      maxVUs: Number(__ENV.MAX_VUS || 1500),
      stages: [
        { target: peakRate, duration: rampDuration },
        { target: peakRate, duration: holdDuration },
      ],
      gracefulStop: "15s",
    },
  },
  // No pass/fail thresholds: this run is for discovering where the ceiling is,
  // and a threshold abort would hide the shape of the curve past that point.
  thresholds: {},
};

export function setup() {
  const response = http.post(
    `${BASE_URL}/v1/auth/login`,
    JSON.stringify({
      username: __ENV.ADMIN_USERNAME || "setup.admin",
      password: __ENV.ADMIN_PASSWORD || "TempPass1234",
    }),
    { headers: { "Content-Type": "application/json" } },
  );

  if (response.status !== 200) {
    throw new Error(`login failed: HTTP ${response.status} ${response.body}`);
  }
  return { token: response.json("access_token") };
}

export default function (data) {
  const body = JSON.stringify({
    tenant_id: TENANT_ID,
    payload: {
      property_id: PROPERTY_ID,
      room_type_id: ROOM_TYPE_ID,
      guest_id: GUEST_ID || uuid(),
      check_in_date: "2026-10-01",
      check_out_date: "2026-10-03",
      adults: 2,
      children: 0,
      rate_code: "BAR",
      total_amount: 450.0,
    },
  });

  const response = http.post(`${BASE_URL}/v1/commands/${COMMAND_NAME}/execute`, body, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.token}`,
      // Every command write requires a client-supplied key; a fresh one per
      // iteration keeps each request a distinct command rather than a replay.
      "Idempotency-Key": uuid(),
    },
    tags: { path: "command_execute" },
  });

  const ok = check(response, {
    "command accepted (202)": (r) => r.status === 202,
  });

  acceptRate.add(ok);
  acceptLatency.add(response.timings.duration);
  if (ok) {
    accepted.add(1);
  } else {
    rejected.add(1);
  }
}
