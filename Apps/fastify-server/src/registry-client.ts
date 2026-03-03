/**
 * Service-registry auto-registration plugin for Fastify.
 *
 * When `REGISTRY_URL` is set in the environment, this plugin:
 *  1. Registers the service with the registry on server ready
 *  2. Sends periodic heartbeats
 *  3. Deregisters on server close
 *
 * All operations are fire-and-forget — registry availability never blocks
 * service startup or shutdown.
 */

const HEARTBEAT_INTERVAL_MS = 15_000;

export interface RegistryConfig {
	registryUrl: string;
	serviceName: string;
	serviceVersion: string;
	host: string;
	port: number;
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
	const { registryUrl, serviceName, serviceVersion, host, port } = config;
	let heartbeatTimer: NodeJS.Timeout | undefined;

	const registerPayload = {
		name: serviceName,
		version: serviceVersion,
		host: host === "0.0.0.0" ? "localhost" : host,
		port,
	};

	// Register immediately
	registryFetch(
		`${registryUrl}/v1/registry/register`,
		"POST",
		registerPayload,
	).then((ok) => {
		if (ok) {
			logger.info(
				{ registryUrl, instanceId: `${serviceName}:${port}` },
				"registered with service registry",
			);
		} else {
			logger.warn(
				{ registryUrl },
				"service registry unavailable — skipping registration",
			);
		}
	});

	// Send periodic heartbeats via the dedicated heartbeat endpoint
	heartbeatTimer = setInterval(() => {
		registryFetch(`${registryUrl}/v1/registry/heartbeat`, "PUT", {
			name: serviceName,
			port,
		}).catch(() => {
			/* intentionally swallowed */
		});
	}, HEARTBEAT_INTERVAL_MS);
	heartbeatTimer.unref();

	return {
		stop: async () => {
			if (heartbeatTimer) {
				clearInterval(heartbeatTimer);
				heartbeatTimer = undefined;
			}
			await registryFetch(`${registryUrl}/v1/registry/deregister`, "DELETE", {
				name: serviceName,
				port,
			});
		},
	};
}
