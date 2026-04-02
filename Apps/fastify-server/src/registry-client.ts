/**
 * Service-registry auto-registration plugin for Fastify.
 *
 * When `REGISTRY_URL` is set in the environment, this plugin:
 *  1. Registers the service with the registry on server listen
 *  2. Sends periodic heartbeats
 *  3. Retries registration if the registry was unavailable at startup
 *  4. Deregisters on server close
 *
 * All operations are fire-and-forget — registry availability never blocks
 * service startup or shutdown.
 */

const HEARTBEAT_INTERVAL_MS = 120_000;
const REGISTER_RETRY_INTERVAL_MS = 5_000;

export interface RegistryConfig {
	registryUrl: string;
	serviceName: string;
	description: string;
	tag: string;
	serviceVersion: string;
	host: string;
	port: number;
}

interface ResolveRegistryConfigOptions {
	registryUrl?: string;
	serviceName: string;
	description: string;
	tag: string;
	serviceVersion: string;
	host: string;
	port: number;
}

export function resolveServiceRegistryConfig(
	config: ResolveRegistryConfigOptions,
): RegistryConfig | undefined {
	const registryUrl =
		config.registryUrl ??
		process.env.SERVICE_REGISTRY_URL ??
		process.env.REGISTRY_URL;

	if (!registryUrl || !config.port) {
		return undefined;
	}

	return {
		registryUrl,
		serviceName: config.serviceName,
		description: config.description,
		tag: config.tag,
		serviceVersion: config.serviceVersion,
		host: config.host,
		port: config.port,
	};
}

async function registryFetch(
	url: string,
	method: string,
	body: Record<string, unknown>,
): Promise<boolean> {
	try {
		const response = await fetch(url, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(3_000),
		});
		return response.ok;
	} catch {
		return false;
	}
}

export function startServiceRegistration(
	config: RegistryConfig,
	logger: {
		info: (...args: unknown[]) => void;
		warn: (...args: unknown[]) => void;
	},
): { stop: () => Promise<void> } {
	const { registryUrl, serviceName, description, tag, serviceVersion, host, port } = config;
	let heartbeatTimer: NodeJS.Timeout | undefined;
	let registerRetryTimer: NodeJS.Timeout | undefined;
	let registryUnavailableLogged = false;

	const registerPayload = {
		name: tag,
		display_name: serviceName,
		description,
		tag,
		version: serviceVersion,
		host: host === "0.0.0.0" ? "localhost" : host,
		port,
	};

	const clearRegisterRetry = (): void => {
		if (registerRetryTimer) {
			clearInterval(registerRetryTimer);
			registerRetryTimer = undefined;
		}
	};

	const ensureRegisterRetry = (): void => {
		if (registerRetryTimer) {
			return;
		}

		registerRetryTimer = setInterval(() => {
			void register();
		}, REGISTER_RETRY_INTERVAL_MS);
		registerRetryTimer.unref();
	};

	const register = async (): Promise<void> => {
		const ok = await registryFetch(
			`${registryUrl}/v1/registry/register`,
			"POST",
			registerPayload,
		);

		if (ok) {
			clearRegisterRetry();
			registryUnavailableLogged = false;
			logger.info(
				{ registryUrl, instanceId: `${tag}:${port}`, serviceName },
				"registered with service registry",
			);
			return;
		}

		if (!registryUnavailableLogged) {
			logger.warn(
				{ registryUrl },
				"service registry unavailable — retrying registration in background",
			);
			registryUnavailableLogged = true;
		}

		ensureRegisterRetry();
	};

	// Register immediately and keep retrying until the registry is reachable.
	void register();

	// Send periodic heartbeats via the dedicated heartbeat endpoint
	heartbeatTimer = setInterval(() => {
		registryFetch(`${registryUrl}/v1/registry/heartbeat`, "PUT", {
			name: tag,
			port,
		})
			.then((ok) => {
				if (!ok) {
					void register();
				}
			})
			.catch(() => {
				void register();
			});
	}, HEARTBEAT_INTERVAL_MS);
	heartbeatTimer.unref();

	return {
		stop: async () => {
			if (heartbeatTimer) {
				clearInterval(heartbeatTimer);
				heartbeatTimer = undefined;
			}
			clearRegisterRetry();
			await registryFetch(`${registryUrl}/v1/registry/deregister`, "DELETE", {
				name: tag,
				port,
			});
		},
	};
}
