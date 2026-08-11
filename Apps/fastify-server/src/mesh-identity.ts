/**
 * Mesh caller-identity verification.
 *
 * Istio's AuthorizationPolicy already restricts which SPIFFE principals may
 * reach a service, and it is enforced by the Envoy sidecar before a request
 * ever reaches Node. This plugin re-checks the same thing in the application.
 *
 * That redundancy is deliberate. Sidecar enforcement disappears the moment a
 * pod runs without a sidecar — injection disabled on a namespace, a
 * `sidecar.istio.io/inject: "false"` annotation, a pod scheduled while the
 * injector webhook was unavailable, or someone port-forwarding straight to
 * the container port. In every one of those cases the mesh policy silently
 * stops applying rather than failing loudly, and the service would go back to
 * accepting calls from anyone who can reach its port.
 *
 * The identity is read from the `x-forwarded-client-cert` (XFCC) header,
 * which the receiving Envoy writes from the *verified* client certificate of
 * the mTLS connection. Envoy replaces any inbound value (SANITIZE_SET), and
 * the api-gateway strips the header from client traffic as well, so it cannot
 * be forged by a caller.
 *
 * @see docs/ZERO_TRUST_MTLS.md
 */
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

/**
 * How strictly to treat a request that carries no acceptable mesh identity.
 *
 * `warn` exists for rollout: turning enforcement straight on across a running
 * cluster rejects traffic from every workload whose ServiceAccount has not
 * yet been added to the allowlist. Run in `warn`, watch the logs until they
 * are clean, then switch to `enforce`.
 */
export type MeshIdentityEnforcement = "enforce" | "off" | "warn";

export interface MeshIdentityOptions {
	/**
	 * SPIFFE principals permitted to call this service. Accepts either the
	 * full `spiffe://cluster.local/ns/<ns>/sa/<sa>` form or the bare
	 * `cluster.local/ns/<ns>/sa/<sa>` form used by Istio policy files, so the
	 * same strings can be pasted between the two without editing.
	 */
	allowedPrincipals: string[];

	/**
	 * @default "off"
	 */
	enforcement?: MeshIdentityEnforcement;

	/**
	 * Paths exempt from the check. Probes come from the kubelet, which holds
	 * no mesh identity, and metrics are scraped by the sidecar itself.
	 */
	exemptPaths?: string[];
}

/** Probe and telemetry endpoints that never carry a caller identity. */
const DEFAULT_EXEMPT_PATHS = [
	"/health",
	"/health/liveness",
	"/health/readiness",
	"/ready",
	"/live",
	"/metrics",
];

const SPIFFE_SCHEME = "spiffe://";

/** Strip the URI scheme so both accepted spellings compare equal. */
const normalisePrincipal = (principal: string): string =>
	principal.trim().replace(/^spiffe:\/\//, "");

/**
 * Extract the SPIFFE identities from an XFCC header value.
 *
 * Envoy emits a comma-separated list of elements, each a set of `Key=Value`
 * pairs, e.g.
 *
 *   By=spiffe://cluster.local/ns/x/sa/y;Hash=1a2b;Subject="";URI=spiffe://cluster.local/ns/a/sa/b
 *
 * `URI` holds the peer's identity and `By` the identity of the proxy that
 * validated it. Values may be double-quoted and a chain may contain several
 * elements, so every `URI` key is collected rather than assuming one.
 */
export const parseClientCertPrincipals = (headerValue: string): string[] => {
	const principals: string[] = [];

	for (const element of headerValue.split(",")) {
		for (const pair of element.split(";")) {
			const separatorIndex = pair.indexOf("=");
			if (separatorIndex === -1) continue;

			const key = pair.slice(0, separatorIndex).trim().toLowerCase();
			if (key !== "uri") continue;

			const rawValue = pair
				.slice(separatorIndex + 1)
				.trim()
				.replace(/^"|"$/g, "");

			if (rawValue.startsWith(SPIFFE_SCHEME)) {
				principals.push(normalisePrincipal(rawValue));
			}
		}
	}

	return principals;
};

const resolveHeaderValue = (request: FastifyRequest): string | undefined => {
	const raw = request.headers["x-forwarded-client-cert"];
	if (Array.isArray(raw)) return raw.join(",");
	return raw;
};

const meshIdentity: FastifyPluginAsync<MeshIdentityOptions> = async (
	fastify,
	options,
) => {
	const enforcement = options.enforcement ?? "off";
	if (enforcement === "off") return;

	const allowed = new Set(options.allowedPrincipals.map(normalisePrincipal));
	const exemptPaths = new Set(options.exemptPaths ?? DEFAULT_EXEMPT_PATHS);

	if (allowed.size === 0) {
		// Failing closed here would take the service down on a config typo, and
		// failing open silently would be worse. Refuse to start instead, so the
		// mistake surfaces at deploy time rather than as an outage or a hole.
		throw new Error(
			"meshIdentity: enforcement is enabled but allowedPrincipals is empty. " +
				"Set MESH_ALLOWED_PRINCIPALS, or set MESH_IDENTITY_ENFORCEMENT=off.",
		);
	}

	fastify.log.info(
		{ enforcement, allowedPrincipals: [...allowed] },
		"mesh caller-identity verification active",
	);

	fastify.addHook("onRequest", async (request, reply) => {
		const path = request.raw.url?.split("?")[0] ?? "";
		if (exemptPaths.has(path)) return;

		const headerValue = resolveHeaderValue(request);
		const principals = headerValue
			? parseClientCertPrincipals(headerValue)
			: [];
		const matched = principals.find((principal) => allowed.has(principal));

		if (matched) {
			request.log.debug({ principal: matched }, "mesh caller verified");
			return;
		}

		const detail = {
			method: request.method,
			url: request.url,
			presentedPrincipals: principals,
			hasClientCertHeader: headerValue !== undefined,
		};

		if (enforcement === "warn") {
			request.log.warn(
				detail,
				"unverified mesh caller — would be rejected under MESH_IDENTITY_ENFORCEMENT=enforce",
			);
			return;
		}

		request.log.error(detail, "rejected unverified mesh caller");

		// 403 rather than 401: the caller's problem is identity, not a missing
		// credential it could supply, and there is no challenge to issue.
		return reply
			.status(403)
			.header("content-type", "application/problem+json")
			.send({
				type: "about:blank",
				title: "Forbidden",
				status: 403,
				detail:
					"Caller is not an authorized service. Requests must arrive through the API gateway.",
				instance: request.url,
				code: "MESH_IDENTITY_REJECTED",
			});
	});
};

/**
 * Build options from the environment.
 *
 * `MESH_IDENTITY_ENFORCEMENT`  off | warn | enforce   (default: off)
 * `MESH_ALLOWED_PRINCIPALS`    comma-separated SPIFFE ids
 *
 * Defaults to `off` so local development, tests and any deployment without a
 * mesh keep working unchanged. The Kubernetes manifests set it explicitly.
 */
export const meshIdentityOptionsFromEnv = (
	env: NodeJS.ProcessEnv = process.env,
): MeshIdentityOptions => {
	const rawEnforcement = env.MESH_IDENTITY_ENFORCEMENT?.trim().toLowerCase();
	const enforcement: MeshIdentityEnforcement =
		rawEnforcement === "enforce" || rawEnforcement === "warn"
			? rawEnforcement
			: "off";

	return {
		enforcement,
		allowedPrincipals: (env.MESH_ALLOWED_PRINCIPALS ?? "")
			.split(",")
			.map((value) => value.trim())
			.filter((value) => value.length > 0),
	};
};

export const meshIdentityPlugin = fp(meshIdentity, { name: "mesh-identity" });
