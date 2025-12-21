import { commandRegistryConfig, gatewayConfig } from "../config.js";
import { gatewayLogger } from "../logger.js";
import type { TenantMembership } from "../services/membership-service.js";

import {
	type CommandRegistrySnapshot,
	loadCommandRegistrySnapshot,
} from "./sql/command-registry.js";

const registryLogger = gatewayLogger.child({
	module: "command-registry",
});
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
			route: CommandRouteRecord & {
				source: "tenant" | "global" | "template";
			};
			feature: CommandFeatureRecord | null;
	  }
	| { status: "NOT_FOUND" }
	| { status: "MODULES_MISSING"; missingModules: string[] }
	| { status: "DISABLED"; reason: string };

export const startCommandRegistry = async (): Promise<void> => {
	await primeRegistryWithRetry();
	if (commandRegistryConfig.refreshIntervalMs > 0) {
		refreshTimer = setInterval(async () => {
			try {
				await refreshRegistry();
			} catch (error) {
				registryLogger.error(error, "failed to refresh command registry");
			}
		}, commandRegistryConfig.refreshIntervalMs);
		refreshTimer.unref?.();
	}
};

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
			serviceId: gatewayConfig.serviceId,
		},
		"command registry snapshot refreshed",
	);
};

const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

const primeRegistryWithRetry = async (): Promise<void> => {
	let attempt = 0;
	const maxRetries = commandRegistryConfig.startupMaxRetries;
	for (;;) {
		try {
			await refreshRegistry();
			if (attempt > 0) {
				registryLogger.info(
					{ attempt },
					"command registry refreshed after retries",
				);
			}
			return;
		} catch (error) {
			attempt += 1;
			if (maxRetries >= 0 && attempt > maxRetries) {
				registryLogger.error(
					{ attempt, maxRetries },
					"exhausted command registry startup retries",
				);
				throw error;
			}
			const delayMs =
				commandRegistryConfig.startupRetryDelayMs * Math.max(1, attempt);
			registryLogger.warn(
				{
					attempt,
					delayMs,
					maxRetries,
					error,
				},
				"failed to refresh command registry, retrying",
			);
			await delay(delayMs);
		}
	}
};

type ResolveCommandOptions = {
	commandName: string;
	tenantId: string;
	membership: TenantMembership;
};

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
		(membership.modules ?? []).map((moduleId) => moduleId.toLowerCase()),
	);
	const requiredModules = (template.required_modules ?? []).map((moduleId) =>
		moduleId.toLowerCase(),
	);
	const missingModules = requiredModules.filter(
		(moduleId) => !tenantModules.has(moduleId),
	);
	if (missingModules.length > 0) {
		return { status: "MODULES_MISSING", missingModules };
	}

	const feature = resolveFeature(commandName, tenantId);
	if (feature && feature.status === "disabled") {
		return { status: "DISABLED", reason: "FEATURE_DISABLED" };
	}

	const route = resolveRoute(commandName, tenantId);
	if (!route) {
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
	const tenantRoutes = (state.routes.get(commandName) ?? []).filter(
		(route) => route.tenant_id === tenantId && route.status === "active",
	);
	if (tenantRoutes.length > 0) {
		return {
			...tenantRoutes[0],
			source: "tenant",
		};
	}

	const globalRoutes = (state.routes.get(commandName) ?? []).filter(
		(route) => route.tenant_id === null && route.status === "active",
	);
	if (globalRoutes.length > 0) {
		return {
			...globalRoutes[0],
			source: "global",
		};
	}
	return null;
};

const resolveFeature = (
	commandName: string,
	tenantId: string,
): CommandFeatureRecord | null => {
	const entries = state.features.get(commandName) ?? [];
	const tenantFeature = entries.find(
		(feature) => feature.tenant_id === tenantId,
	);
	if (tenantFeature) {
		return tenantFeature;
	}
	const globalFeature = entries.find((feature) => feature.tenant_id === null);
	return globalFeature ?? null;
};
