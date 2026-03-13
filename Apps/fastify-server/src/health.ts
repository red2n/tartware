import type { FastifyInstance, FastifyReply } from "fastify";

export type HealthDependency = {
	name: string;
	check: () => Promise<void>;
};

export type CreateHealthRoutesOptions = {
	serviceName: string;
	serviceVersion: string;
	dependencies?: HealthDependency[];
	/** Extra fields merged into the /ready response (e.g. kafka cluster info). */
	readyExtras?: Record<string, unknown>;
};

/**
 * Creates standard `/health` (liveness) and `/ready` (readiness) route handlers.
 *
 * `/health` returns static 200 for liveness probes.
 * `/ready` probes each registered dependency and returns 503 if any are down.
 */
export function createHealthRoutes(options: CreateHealthRoutesOptions) {
	return (app: FastifyInstance): void => {
		app.get("/health", async () => ({
			status: "ok",
			service: options.serviceName,
			version: options.serviceVersion,
		}));

		app.get("/ready", async (_request: unknown, reply: FastifyReply) => {
			const deps = options.dependencies ?? [];
			const extras = options.readyExtras ?? {};

			if (deps.length === 0) {
				return {
					status: "ready",
					service: options.serviceName,
					version: options.serviceVersion,
					...extras,
				};
			}

			const results = await Promise.allSettled(
				deps.map(async (dep) => {
					await dep.check();
					return dep.name;
				}),
			);

			const checks: Record<string, "up" | "down"> = {};
			for (let i = 0; i < results.length; i++) {
				const result = results[i]!;
				if (result.status === "fulfilled") {
					checks[result.value] = "up";
				} else {
					checks[deps[i]?.name ?? "unknown"] = "down";
				}
			}

			const allHealthy = Object.values(checks).every((s) => s === "up");

			const response = {
				status: allHealthy ? "ready" : "degraded",
				service: options.serviceName,
				version: options.serviceVersion,
				dependencies: checks,
				...extras,
			};

			if (!allHealthy) {
				return reply.status(503).send(response);
			}

			return response;
		});
	};
}
