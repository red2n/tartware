import { config } from "../config.js";
import { appLogger } from "../lib/logger.js";
import {
  type CommandRegistrySnapshot,
  loadCommandRegistrySnapshot,
} from "../sql/command-registry.js";

const LEGACY_MODULE_MAP: Record<string, string> = {
  reservations: "core",
  guests: "core",
  inventory: "core",
  operations: "facility-maintenance",
  billing: "finance-automation",
};

const normalizeModuleId = (moduleId: string): string => {
  if (!moduleId || typeof moduleId !== "string") {
    return "";
  }
  const normalized = moduleId.trim().toLowerCase();
  return LEGACY_MODULE_MAP[normalized] ?? normalized;
};

import type { TenantMembership } from "./membership-service.js";

const registryLogger = appLogger.child({ module: "command-registry" });
const environment = process.env.NODE_ENV ?? "development";

type CommandTemplateRecord = CommandRegistrySnapshot["templates"][number] & {
  required_modules: string[];
  metadata: Record<string, unknown>;
  payload_schema: Record<string, unknown>;
  sample_payload: Record<string, unknown>;
};

type CommandRouteRecord = CommandRegistrySnapshot["routes"][number] & {
  metadata: Record<string, unknown>;
  tenant_id: string | null;
};

type CommandFeatureRecord = CommandRegistrySnapshot["features"][number] & {
  metadata: Record<string, unknown>;
  tenant_id: string | null;
};

type CommandRegistryState = {
  templates: Map<string, CommandTemplateRecord>;
  routes: Map<string, CommandRouteRecord[]>;
  features: Map<string, CommandFeatureRecord[]>;
};

const initialState = (): CommandRegistryState => ({
  templates: new Map(),
  routes: new Map(),
  features: new Map(),
});

let state: CommandRegistryState = initialState();
let refreshTimer: NodeJS.Timeout | null = null;

type CommandResolution =
  | {
      status: "RESOLVED";
      template: CommandTemplateRecord;
      route: CommandRouteRecord & { source: "tenant" | "global" | "template" };
      feature: CommandFeatureRecord | null;
    }
  | { status: "NOT_FOUND" }
  | { status: "MODULES_MISSING"; missingModules: string[] }
  | { status: "DISABLED"; reason: string };

/**
 * Start the command registry refresh loop.
 */
export const startCommandRegistry = async (): Promise<void> => {
  await refreshRegistry();
  if (config.registry.refreshIntervalMs > 0) {
    refreshTimer = setInterval(async () => {
      try {
        await refreshRegistry();
      } catch (error) {
        registryLogger.error(error, "failed to refresh command registry");
      }
    }, config.registry.refreshIntervalMs);
    refreshTimer.unref?.();
  }
};

/**
 * Stop the command registry refresh loop and reset state.
 */
export const shutdownCommandRegistry = async (): Promise<void> => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  state = initialState();
};

const refreshRegistry = async (): Promise<void> => {
  const snapshot = await loadCommandRegistrySnapshot(environment);
  const templates = new Map<string, CommandTemplateRecord>();
  const routes = new Map<string, CommandRouteRecord[]>();
  const features = new Map<string, CommandFeatureRecord[]>();

  for (const template of snapshot.templates) {
    templates.set(template.command_name, {
      ...template,
      required_modules: template.required_modules ?? [],
      metadata: template.metadata ?? {},
      payload_schema: template.payload_schema ?? {},
      sample_payload: template.sample_payload ?? {},
    });
  }

  for (const route of snapshot.routes) {
    const entry = routes.get(route.command_name) ?? [];
    entry.push({
      ...route,
      metadata: route.metadata ?? {},
      tenant_id: route.tenant_id,
    });
    routes.set(route.command_name, entry);
  }

  for (const feature of snapshot.features) {
    const entry = features.get(feature.command_name) ?? [];
    entry.push({
      ...feature,
      metadata: feature.metadata ?? {},
      tenant_id: feature.tenant_id,
    });
    features.set(feature.command_name, entry);
  }

  state = {
    templates,
    routes,
    features,
  };
  registryLogger.info(
    {
      commandCount: templates.size,
      routeCount: snapshot.routes.length,
      environment,
    },
    "command registry snapshot refreshed",
  );
};

type ResolveCommandOptions = {
  commandName: string;
  tenantId: string;
  membership: TenantMembership;
};

export type CommandDefinitionView = {
  name: string;
  label: string;
  description: string;
  samplePayload: Record<string, unknown>;
  requiredModules: string[];
  defaultTargetService: string;
  defaultTopic: string;
  version: string;
};

/**
 * Resolve the command route for a tenant based on registry state.
 */
export const resolveCommandForTenant = ({
  commandName,
  tenantId,
  membership,
}: ResolveCommandOptions): CommandResolution => {
  const template = state.templates.get(commandName);
  if (!template) {
    return { status: "NOT_FOUND" };
  }

  const tenantModules = new Set(
    (membership.modules ?? [])
      .filter((moduleId): moduleId is string => typeof moduleId === "string")
      .map((moduleId) => moduleId.toLowerCase()),
  );
  const requiredModules = (template.required_modules ?? []).map(normalizeModuleId);
  const missingModules = requiredModules.filter((moduleId) => !tenantModules.has(moduleId));
  if (missingModules.length > 0) {
    return { status: "MODULES_MISSING", missingModules };
  }

  const feature = resolveFeature(commandName, tenantId);
  if (feature && feature.status === "disabled") {
    return { status: "DISABLED", reason: "FEATURE_DISABLED" };
  }

  const route = resolveRoute(commandName, tenantId);
  if (!route) {
    // Fall back to template defaults if no active route exists.
    return {
      status: "RESOLVED",
      template,
      route: {
        id: "template-default",
        command_name: commandName,
        environment,
        tenant_id: null,
        service_id: template.default_target_service,
        topic: template.default_topic,
        weight: 100,
        status: "active",
        metadata: { source: "template" },
        source: "template",
      },
      feature: feature ?? null,
    };
  }

  return {
    status: "RESOLVED",
    template,
    route,
    feature: feature ?? null,
  };
};

const resolveRoute = (
  commandName: string,
  tenantId: string,
):
  | (CommandRouteRecord & {
      source: "tenant" | "global" | "template";
    })
  | null => {
  const entries = state.routes.get(commandName) ?? [];
  const tenantRoutes = entries.filter(
    (route) => route.tenant_id === tenantId && route.status === "active",
  );
  const globalRoutes = entries.filter(
    (route) => route.tenant_id === null && route.status === "active",
  );

  const candidates =
    tenantRoutes.length > 0 ? tenantRoutes : globalRoutes.length > 0 ? globalRoutes : [];

  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    if (b.weight === a.weight) {
      return a.service_id.localeCompare(b.service_id);
    }
    return b.weight - a.weight;
  });

  const selected = sorted[0];
  if (!selected) {
    return null;
  }
  return {
    ...selected,
    source: tenantRoutes.length > 0 ? "tenant" : "global",
  };
};

const resolveFeature = (commandName: string, tenantId: string): CommandFeatureRecord | null => {
  const entries = state.features.get(commandName) ?? [];
  const tenantFeature = entries.find((feature) => feature.tenant_id === tenantId);
  if (tenantFeature) {
    return tenantFeature;
  }
  return entries.find((feature) => feature.tenant_id === null) ?? null;
};

/**
 * List the command definitions available in the registry.
 */
export const listCommandDefinitions = (): CommandDefinitionView[] => {
  return Array.from(state.templates.values()).map((template) => {
    const label =
      typeof template.metadata.label === "string" && template.metadata.label.length > 0
        ? template.metadata.label
        : template.command_name;
    const description =
      typeof template.metadata.description === "string" && template.metadata.description.length > 0
        ? template.metadata.description
        : (template.description ?? template.command_name);

    return {
      name: template.command_name,
      label,
      description,
      samplePayload: template.sample_payload ?? {},
      requiredModules: template.required_modules ?? [],
      defaultTargetService: template.default_target_service,
      defaultTopic: template.default_topic,
      version: template.version,
    };
  });
};
