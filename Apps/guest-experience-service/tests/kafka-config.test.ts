import { describe, expect, it } from "vitest";

describe("kafka config resolution", () => {
  it("selects primary brokers by default", async () => {
    // The config module is already loaded via setup with KAFKA_BROKERS=localhost:29092
    const { config } = await import("../src/config.js");
    expect(config.kafka.activeCluster).toBe("primary");
    expect(config.kafka.brokers.length).toBeGreaterThan(0);
  });

  it("uses correct service defaults", async () => {
    const { config } = await import("../src/config.js");
    expect(config.service.name).toBe("@tartware/guest-experience-service");
    expect(config.commandCenter.targetServiceId).toBe("guest-experience-service");
    expect(config.commandCenter.consumerGroupId).toBe(
      "guest-experience-command-center-consumer",
    );
  });
});
