import { describe, expect, it } from "vitest";

import { buildDomainEvent } from "./event-builder.js";

describe("buildDomainEvent", () => {
  it("creates metadata defaults", () => {
    const event = buildDomainEvent({
      type: "reservation.created",
      payload: { foo: "bar" },
      source: "test-service",
      tenantId: "11111111-1111-4111-8111-111111111111",
    });

    expect(event.metadata.type).toBe("reservation.created");
    expect(event.metadata.source).toBe("test-service");
    expect(event.metadata.tenantId).toBe("11111111-1111-4111-8111-111111111111");
    expect(event.metadata.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(event.metadata.timestamp).toMatch(/Z$/);
  });
});
