import { describe, expect, it } from "vitest";

import {
  ConsoleKeyVendor,
  type KeyVendor,
} from "../src/services/key-service.js";

describe("ConsoleKeyVendor", () => {
  const vendor: KeyVendor = new ConsoleKeyVendor();

  it("issues a key with correct fields", async () => {
    const key = await vendor.issueKey({
      roomId: "room-1",
      guestId: "guest-1",
      validFrom: new Date("2025-06-15T14:00:00Z"),
      validTo: new Date("2025-06-18T11:00:00Z"),
      keyType: "nfc",
    });

    expect(key.keyId).toBeDefined();
    expect(key.keyCode).toMatch(/^KEY-/);
    expect(key.keyType).toBe("nfc");
    expect(key.status).toBe("active");
    expect(key.validFrom).toEqual(new Date("2025-06-15T14:00:00Z"));
    expect(key.validTo).toEqual(new Date("2025-06-18T11:00:00Z"));
  });

  it("defaults keyType to bluetooth", async () => {
    const key = await vendor.issueKey({
      roomId: "room-1",
      guestId: "guest-1",
      validFrom: new Date(),
      validTo: new Date(Date.now() + 86400000),
    });
    expect(key.keyType).toBe("bluetooth");
  });

  it("revokeKey resolves without error", async () => {
    await expect(vendor.revokeKey("key-123")).resolves.toBeUndefined();
  });

  it("getKeyStatus returns active status", async () => {
    const status = await vendor.getKeyStatus("key-123");
    expect(status).not.toBeNull();
    expect(status!.keyId).toBe("key-123");
    expect(status!.status).toBe("active");
    expect(status!.usageCount).toBe(0);
  });
});
