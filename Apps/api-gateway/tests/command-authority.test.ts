/**
 * Per-command authority at the registry, which is the one point every accepted
 * command passes through.
 *
 * The schema package proves the decision function; what is worth guarding here
 * is the wiring: that the registry actually asks it, that it asks before it
 * checks whether the command is switched on, and that the refusal reaching the
 * caller does not describe the permission model to someone who failed it.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../src/config.js", () => ({
  commandRegistryConfig: { refreshIntervalMs: 0, startupMaxRetries: 0, startupRetryDelayMs: 1 },
  gatewayConfig: { serviceId: "api-gateway" },
}));

const registryLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
vi.mock("../src/logger.js", () => ({
  gatewayLogger: { child: () => registryLogger },
}));

const loadCommandRegistrySnapshot = vi.fn();
vi.mock("../src/command-center/sql/command-registry.js", () => ({
  loadCommandRegistrySnapshot: (...args: unknown[]) => loadCommandRegistrySnapshot(...args),
}));

const { resolveCommandForTenant, startCommandRegistry, shutdownCommandRegistry } = await import(
  "../src/command-center/command-registry.js"
);

type Template = { command_name: string; default_target_service: string; default_topic: string };

const template = (command_name: string): Template => ({
  command_name,
  default_target_service: "billing-service",
  default_topic: "commands.primary",
});

const prime = async (
  templates: string[],
  features: Array<{ command_name: string; status: string; tenant_id: string | null }> = [],
) => {
  loadCommandRegistrySnapshot.mockResolvedValue({
    templates: templates.map(template),
    routes: [],
    features,
  });
  await startCommandRegistry();
};

const TENANT = "11111111-1111-1111-1111-111111111111";

const membership = (role: string, permissions: Record<string, unknown> = {}) =>
  ({
    tenantId: TENANT,
    tenantName: "Test",
    role,
    isActive: true,
    permissions,
    modules: ["core", "finance-automation"],
  }) as never;

const resolve = (commandName: string, role: string, permissions?: Record<string, unknown>) =>
  resolveCommandForTenant({
    commandName,
    tenantId: TENANT,
    membership: membership(role, permissions ?? {}),
  });

describe("resolveCommandForTenant — per-command authority", () => {
  it("lets STAFF through on a command declared at STAFF", async () => {
    await prime(["reservation.check_in"]);
    expect(resolve("reservation.check_in", "STAFF").status).toBe("RESOLVED");
    await shutdownCommandRegistry();
  });

  it("refuses STAFF a command declared above them", async () => {
    // The finding in one assertion: this used to be indistinguishable from a
    // check-in, because both needed MANAGER and nothing needed more.
    await prime(["ar.city_ledger.write_off"]);
    const result = resolve("ar.city_ledger.write_off", "STAFF");
    expect(result.status).toBe("PERMISSION_DENIED");
    expect(result).toMatchObject({ reason: "ROLE_INSUFFICIENT", requiredRole: "OWNER" });
    await shutdownCommandRegistry();
  });

  it("refuses MANAGER the commands the audit named", async () => {
    await prime(["billing.comp.post", "billing.deposit.waive", "billing.folio.reopen"]);
    for (const name of ["billing.comp.post", "billing.deposit.waive", "billing.folio.reopen"]) {
      expect(resolve(name, "MANAGER").status, name).toBe("PERMISSION_DENIED");
      expect(resolve(name, "ADMIN").status, name).toBe("RESOLVED");
    }
    await shutdownCommandRegistry();
  });

  it("honours a grant on the membership without promoting the role", async () => {
    await prime(["billing.fiscal_period.reopen"]);
    const grants = { commands: { allow: ["billing.fiscal_period.reopen"] } };
    expect(resolve("billing.fiscal_period.reopen", "MANAGER").status).toBe("PERMISSION_DENIED");
    expect(resolve("billing.fiscal_period.reopen", "MANAGER", grants).status).toBe("RESOLVED");
    await shutdownCommandRegistry();
  });

  it("honours a deny on the membership against a role that would pass", async () => {
    await prime(["billing.charge.void"]);
    const grants = { commands: { deny: ["billing.charge.void"] } };
    expect(resolve("billing.charge.void", "OWNER").status).toBe("RESOLVED");
    expect(resolve("billing.charge.void", "OWNER", grants)).toMatchObject({
      status: "PERMISSION_DENIED",
      reason: "EXPLICIT_DENY",
    });
    await shutdownCommandRegistry();
  });

  it("refuses a catalogued command that declares no floor", async () => {
    // A command can reach the registry from the database alone. Until someone
    // decides who may run it, nobody may.
    await prime(["billing.brand.new"]);
    expect(resolve("billing.brand.new", "OWNER")).toMatchObject({
      status: "PERMISSION_DENIED",
      reason: "UNDECLARED",
      requiredRole: null,
    });
    await shutdownCommandRegistry();
  });

  it("answers PERMISSION_DENIED before FEATURE_DISABLED", async () => {
    // Otherwise the 409 tells an unauthorised caller that the command exists
    // and is merely switched off for their tenant.
    await prime(
      ["ar.city_ledger.write_off"],
      [{ command_name: "ar.city_ledger.write_off", status: "disabled", tenant_id: null }],
    );
    expect(resolve("ar.city_ledger.write_off", "STAFF").status).toBe("PERMISSION_DENIED");
    expect(resolve("ar.city_ledger.write_off", "OWNER").status).toBe("DISABLED");
    await shutdownCommandRegistry();
  });

  it("still answers NOT_FOUND for a command that is not catalogued at all", async () => {
    await prime(["reservation.check_in"]);
    expect(resolve("reservation.check_in", "STAFF").status).toBe("RESOLVED");
    expect(resolve("nothing.at.all", "OWNER").status).toBe("NOT_FOUND");
    await shutdownCommandRegistry();
  });

  it("logs the reason it refused, since the response will not carry it", async () => {
    registryLogger.warn.mockClear();
    await prime(["billing.comp.post"]);
    resolve("billing.comp.post", "STAFF");
    expect(registryLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        commandName: "billing.comp.post",
        role: "STAFF",
        requiredRole: "ADMIN",
        reason: "ROLE_INSUFFICIENT",
      }),
      expect.any(String),
    );
    await shutdownCommandRegistry();
  });
});
