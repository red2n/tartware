import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/db.js", () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { rankRooms } from "../src/services/recommendation-service.js";

const { pool } = await import("../src/lib/db.js");
const mockedPool = pool as { query: ReturnType<typeof vi.fn> };

describe("rankRooms", () => {
  beforeEach(() => {
    mockedPool.query.mockReset();
  });

  it("ranks rooms using guest preferences and handles missing rooms", async () => {
    mockedPool.query
      .mockResolvedValueOnce({
        rows: [
          {
            preferred_room_type: "Suite",
            preferred_floor: "high",
            preferred_amenities: [],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "room-1",
            room_number: "801",
            floor: "6",
            room_type_id: "rt-1",
            room_type_name: "Executive Suite",
            base_rate: 250,
            max_occupancy: 2,
          },
        ],
      });

    const result = await rankRooms({
      tenantId: "tenant-1",
      propertyId: "property-1",
      guestId: "guest-1",
      checkInDate: "2026-02-10",
      checkOutDate: "2026-02-12",
      adults: 2,
      children: 0,
      roomIds: ["room-1", "room-2"],
    });

    expect(result.rankedRooms).toHaveLength(2);
    expect(result.rankedRooms[0].roomId).toBe("room-1");
    expect(result.rankedRooms[0].reasons).toEqual(
      expect.arrayContaining([
        "Matches your preferred room type",
        "High floor as preferred",
      ]),
    );
    expect(result.rankedRooms[1].reasons).toContain("Room not found in database");
  });

  it("continues when guest preferences query fails", async () => {
    mockedPool.query
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({
        rows: [
          {
            id: "room-1",
            room_number: "201",
            floor: "2",
            room_type_id: "rt-1",
            room_type_name: "Deluxe",
            base_rate: 180,
            max_occupancy: 2,
          },
        ],
      });

    const result = await rankRooms({
      tenantId: "tenant-1",
      propertyId: "property-1",
      guestId: "guest-1",
      checkInDate: "2026-02-10",
      checkOutDate: "2026-02-12",
      adults: 2,
      children: 0,
      roomIds: ["room-1"],
    });

    expect(result.rankedRooms).toHaveLength(1);
    expect(result.rankedRooms[0].rank).toBe(1);
    expect(result.rankedRooms[0].relevanceScore).toBeGreaterThan(0);
  });
});
