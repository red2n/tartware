import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.LOADTEST_BASE_URL ?? "http://localhost:3333";
const TENANT_ID = __ENV.LOADTEST_TENANT_ID;
const PROPERTY_ID = __ENV.LOADTEST_PROPERTY_ID;
const AUTH_TOKEN = __ENV.LOADTEST_AUTH_TOKEN;
const WRITE_RATIO = Number(__ENV.LOADTEST_WRITE_RATIO ?? 0.1); // 0.0-1.0

if (!TENANT_ID) {
  throw new Error("LOADTEST_TENANT_ID is required");
}
if (!AUTH_TOKEN) {
  throw new Error("LOADTEST_AUTH_TOKEN is required");
}

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 25 },
        { duration: "30s", target: 25 },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750"],
    "http_req_duration{type:write}": ["p(95)<1000"],
    "http_req_duration{type:read}": ["p(95)<600"],
  },
};

const readTrend = new Trend("crud_read_duration");
const writeTrend = new Trend("crud_write_duration");

const sharedHeaders = {
  Authorization: `Bearer ${AUTH_TOKEN}`,
  "Content-Type": "application/json",
};

const queryString = (() => {
  const params = new URLSearchParams({ tenant_id: TENANT_ID });
  if (PROPERTY_ID) {
    params.append("property_id", PROPERTY_ID);
  }
  return params.toString();
})();

const randomUuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });

const reservationPayload = () => ({
  property_id: PROPERTY_ID ?? randomUuid(),
  guest_id: randomUuid(),
  room_type_id: randomUuid(),
  check_in_date: new Date().toISOString(),
  check_out_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  booking_date: new Date().toISOString(),
  total_amount: 199,
  currency: "USD",
});

export default function () {
  const readResponses = http.batch(
    [
      ["GET", `${BASE_URL}/v1/reservations?${queryString}`, null, { headers: sharedHeaders, tags: { type: "read", endpoint: "reservations" } }],
      ["GET", `${BASE_URL}/v1/housekeeping/tasks?${queryString}`, null, { headers: sharedHeaders, tags: { type: "read", endpoint: "housekeeping" } }],
      ["GET", `${BASE_URL}/v1/billing/payments?${queryString}`, null, { headers: sharedHeaders, tags: { type: "read", endpoint: "billing" } }],
    ],
    { tags: { batch: "reads" } },
  );

  for (const response of readResponses) {
    readTrend.add(response.timings.duration);
    check(response, {
      "read status is 2xx/304": (res) => res.status >= 200 && res.status < 305,
    });
  }

  if (Math.random() < WRITE_RATIO) {
    const writeRes = http.post(
      `${BASE_URL}/v1/tenants/${TENANT_ID}/reservations`,
      JSON.stringify(reservationPayload()),
      { headers: sharedHeaders, tags: { type: "write", endpoint: "reservation-create" } },
    );

    writeTrend.add(writeRes.timings.duration);
    check(writeRes, {
      "write accepted 202": (res) => res.status === 202,
    });
  }

  sleep(1);
}
