/**
 * Service-registry auto-registration plugin for Fastify.
 *
 * When `REGISTRY_URL` is set in the environment, this plugin:
 *  1. Registers the service with the registry on server ready, with
 *     exponential-backoff retries if core-service is still starting up
 *  2. Sends periodic heartbeats
 *  3. Deregisters on server close
 *
 * All operations are fire-and-forget — registry availability never blocks
 * service startup or shutdown.
 */

const HEARTBEAT_INTERVAL_MS = 120_000;
/** Max registration attempts (initial + retries). */
const REGISTER_MAX_ATTEMPTS = 5;
/** Base delay in ms between registration attempts; doubles each time. */
const REGISTER_BASE_DELAY_MS = 2_000;

export interface RegistryConfig {
	registryUrl: string;
	serviceName: string;
	serviceVersion: string;
	host: string;
	port: number;
	/** Human-readable display name (e.g. "Core Service"). Falls back to derived name in UI. */
	displayName?: string;
	/** Short description shown in the service dashboard. */
	description?: string;
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
	const {
		registryUrl,
		serviceName,
		serviceVersion,
		host,
		port,
		displayName,
		description,
	} = config;
	let heartbeatTimer: NodeJS.Timeout | undefined;

	const metadata: Record<string, string> = {};
	if (displayName) metadata.displayName = displayName;
	if (description) metadata.description = description;

	const registerPayload: Record<string, unknown> = {
		name: serviceName,
		version: serviceVersion,
		host: host === "0.0.0.0" ? "localhost" : host,
		port,
	};
	if (Object.keys(metadata).length > 0) registerPayload.metadata = metadata;

	// Register with exponential-backoff retry so services that start in parallel
	// with core-service (the registry) succeed even when the registry isn't ready yet.
	(async () => {
		for (let attempt = 1; attempt <= REGISTER_MAX_ATTEMPTS; attempt++) {
			const ok = await registryFetch(
				`${registryUrl}/v1/registry/register`,
				"POST",
				registerPayload,
			);
			if (ok) {
				logger.info(
					{ registryUrl, instanceId: `${serviceName}:${port}` },
					"registered with service registry",
				);
				return;
			}
			if (attempt < REGISTER_MAX_ATTEMPTS) {
				const delay = REGISTER_BASE_DELAY_MS * 2 ** (attempt - 1);
				logger.warn(
					{ registryUrl, attempt, nextRetryMs: delay },
					"service registry unavailable — retrying registration",
				);
				await new Promise<void>((resolve) => setTimeout(resolve, delay));
			} else {
				logger.warn(
					{ registryUrl },
					"service registry unavailable — skipping registration after all retries",
				);
			}
		}
	})();

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
