import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildServer } from "../src/server.js";
import {
  MANAGER_USER_ID,
  TEST_PROPERTY_ID,
  TEST_TENANT_ID,
} from "./mocks/db.js";
import { buildAuthHeader } from "./utils/auth.js";

describe("Reservations API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns normalized reservation grid data for authorized users", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/reservations/grid?tenant_id=${TEST_TENANT_ID}`,
      headers: buildAuthHeader(MANAGER_USER_ID),
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.meta).toEqual({ count: 1 });

    const reservation = payload.data[0];
    expect(reservation).toMatchObject({
      id: "aa0e8400-e29b-41d4-a716-446655440099",
      confirmation_number: "CONF-123456",
      status: "confirmed",
      status_display: "Confirmed",
      guest_name: "John Doe",
      guest_email: "john.doe@example.com",
      room_number: "1205",
      total_amount: 450,
      currency: "USD",
    });
    expect(reservation.nights).toBe(2);
  });

  it("returns full reservation list payload for authorized users", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/v1/reservations/list?tenant_id=${TEST_TENANT_ID}`,
      headers: buildAuthHeader(MANAGER_USER_ID),
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.meta).toEqual({ count: 1 });

    const reservation = payload.data[0];
    expect(reservation).toMatchObject({
      id: "aa0e8400-e29b-41d4-a716-446655440099",
      tenant_id: TEST_TENANT_ID,
      property_id: TEST_PROPERTY_ID,
      confirmation_number: "CONF-123456",
      status: "confirmed",
      status_display: "Confirmed",
      guest_name: "John Doe",
      guest_email: "john.doe@example.com",
      room_number: "1205",
      total_amount: 450,
      paid_amount: 200,
      balance_due: 250,
      currency: "USD",
      version: "1",
    });
    expect(reservation.nights).toBe(2);
  });
});
