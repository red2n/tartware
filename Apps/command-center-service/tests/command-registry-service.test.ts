import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommandRegistrySnapshot } from "../src/sql/command-registry.js";

const snapshot: CommandRegistrySnapshot = {
  templates: [
    {
      command_name: "reservations.create",
      description: "Create reservation",
      default_target_service: "reservations-command-service",
      default_topic: "commands.primary",
      required_modules: ["core"],
      version: "1.0",
      metadata: {},
      payload_schema: {},
      sample_payload: {},
    },
  ],
  routes: [],
  features: [],
};

vi.mock("../src/sql/command-registry.js", () => ({
  loadCommandRegistrySnapshot: vi.fn(async () => snapshot),
}));

import {
  resolveCommandForTenant,
  shutdownCommandRegistry,
  startCommandRegistry,
} from "../src/services/command-registry-service.js";

afterEach(async () => {
  await shutdownCommandRegistry();
});

describe("Command Registry Service", () => {
  it("ignores non-string tenant modules", async () => {
    process.env.COMMAND_REGISTRY_REFRESH_MS = "0";
    await startCommandRegistry();

    const result = resolveCommandForTenant({
      commandName: "reservations.create",
      tenantId: "tenant-1",
      membership: {
        tenantId: "tenant-1",
        tenantName: "Test Tenant",
        role: "ADMIN",
        isActive: true,
        permissions: {},
        modules: ["core", 123 as unknown as string, null as unknown as string],
      },
    });

    expect(result.status).toBe("RESOLVED");
  });
});
