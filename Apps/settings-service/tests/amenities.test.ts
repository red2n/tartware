import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "@tartware/telemetry";

import { buildServer } from "../src/server.js";
import { config } from "../src/config.js";
import {
  type AmenityRecord,
  createAmenity as createAmenityRepo,
  listAmenities as listAmenitiesRepo,
  updateAmenity as updateAmenityRepo,
} from "../src/repositories/amenity-catalog-repository.js";

vi.mock("../src/repositories/amenity-catalog-repository.js", async () => {
  const actual = await vi.importActual<
    typeof import("../src/repositories/amenity-catalog-repository.js")
  >("../src/repositories/amenity-catalog-repository.js");
  return {
    ...actual,
    listAmenities: vi.fn(),
    createAmenity: vi.fn(),
    updateAmenity: vi.fn(),
  };
});

const TEST_TENANT_ID = "11111111-1111-1111-1111-111111111111";
const TEST_PROPERTY_ID = "22222222-2222-2222-2222-222222222222";

const buildToken = (scopes: string[]) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: "317edc15-bd7b-4fec-afbd-be6a8f316f56",
    iss: config.auth.jwt.issuer,
    aud: config.auth.jwt.audience,
    scope: scopes,
    tenantId: TEST_TENANT_ID,
    iat: now,
    exp: now + 300,
  };
  const encode = (segment: unknown) => Buffer.from(JSON.stringify(segment)).toString("base64url");
  const signingInput = `${encode(header)}.${encode(payload)}`;
  const signature = createHmac("sha256", config.auth.jwt.secret)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
};

const buildTestServer = () =>
  buildServer({
    logger: createLogger({
      serviceName: config.service.name,
      level: "silent",
      pretty: false,
      environment: "test",
    }),
  });

const baseAmenity: AmenityRecord = {
  id: "66666666-6666-6666-6666-666666666661",
  tenantId: TEST_TENANT_ID,
  propertyId: TEST_PROPERTY_ID,
  amenityCode: "WIFI",
  displayName: "WiFi",
  description: "High speed internet",
  category: "TECHNOLOGY",
  icon: "wifi",
  tags: ["TECH"],
  sortOrder: 1,
  isDefault: true,
  isActive: true,
  isRequired: true,
  metadata: {},
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: undefined,
  createdBy: "317edc15-bd7b-4fec-afbd-be6a8f316f56",
  updatedBy: "317edc15-bd7b-4fec-afbd-be6a8f316f56",
};

describe("amenity catalog routes", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("lists amenities for a property", async () => {
    const app = buildTestServer();
    const token = buildToken(["settings:read"]);
    vi.mocked(listAmenitiesRepo).mockResolvedValue([baseAmenity]);

    const response = await app.inject({
      method: "GET",
      url: `/v1/settings/properties/${TEST_PROPERTY_ID}/amenities`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(listAmenitiesRepo).toHaveBeenCalledWith({
      tenantId: TEST_TENANT_ID,
      propertyId: TEST_PROPERTY_ID,
    });
    const body = response.json();
    expect(body.meta.count).toBe(1);
    expect(body.data[0].amenityCode).toBe("WIFI");
    await app.close();
  });

  it("creates a new amenity", async () => {
    const app = buildTestServer();
    const token = buildToken(["settings:write"]);
    vi.mocked(createAmenityRepo).mockResolvedValue(baseAmenity);

    const response = await app.inject({
      method: "POST",
      url: `/v1/settings/properties/${TEST_PROPERTY_ID}/amenities`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        amenityCode: "wifi",
        displayName: "WiFi",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(createAmenityRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TEST_TENANT_ID,
        propertyId: TEST_PROPERTY_ID,
        payload: expect.objectContaining({ amenityCode: "WIFI" }),
      }),
    );
    const body = response.json();
    expect(body.data.amenityCode).toBe("WIFI");
    await app.close();
  });

  it("returns 409 when amenity already exists", async () => {
    const app = buildTestServer();
    const token = buildToken(["settings:write"]);
    vi.mocked(createAmenityRepo).mockRejectedValue({ code: "23505" });

    const response = await app.inject({
      method: "POST",
      url: `/v1/settings/properties/${TEST_PROPERTY_ID}/amenities`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        amenityCode: "wifi",
        displayName: "WiFi",
      },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("updates an existing amenity", async () => {
    const app = buildTestServer();
    const token = buildToken(["settings:write"]);
    vi.mocked(updateAmenityRepo).mockResolvedValue({
      ...baseAmenity,
      displayName: "Updated WiFi",
    });

    const response = await app.inject({
      method: "PUT",
      url: `/v1/settings/properties/${TEST_PROPERTY_ID}/amenities/WIFI`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        displayName: "Updated WiFi",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(updateAmenityRepo).toHaveBeenCalledWith(
      expect.objectContaining({
        amenityCode: "WIFI",
        payload: expect.objectContaining({ displayName: "Updated WiFi" }),
      }),
    );
    await app.close();
  });

  it("returns 404 when amenity not found", async () => {
    const app = buildTestServer();
    const token = buildToken(["settings:write"]);
    vi.mocked(updateAmenityRepo).mockResolvedValue(null);

    const response = await app.inject({
      method: "PUT",
      url: `/v1/settings/properties/${TEST_PROPERTY_ID}/amenities/UNKNOWN`,
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {},
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
