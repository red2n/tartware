import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import {
	meshIdentityOptionsFromEnv,
	meshIdentityPlugin,
	parseClientCertPrincipals,
} from "../src/mesh-identity.js";

const GATEWAY = "cluster.local/ns/tartware-system/sa/api-gateway";
const ATTACKER = "cluster.local/ns/tartware-system/sa/some-other-service";

/** Build the XFCC header Envoy writes for a verified peer. */
const xfccFor = (spiffeId: string) =>
	`By=spiffe://cluster.local/ns/tartware-system/sa/core-service;` +
	`Hash=0f1e2d;Subject="";URI=spiffe://${spiffeId}`;

const buildApp = async (
	options: Parameters<typeof meshIdentityPlugin>[1] extends never
		? never
		: {
				allowedPrincipals: string[];
				enforcement?: "enforce" | "off" | "warn";
			},
) => {
	const app = Fastify();
	await app.register(meshIdentityPlugin, options);
	app.get("/reservations", async () => ({ ok: true }));
	app.get("/health", async () => ({ status: "up" }));
	await app.ready();
	return app;
};

describe("parseClientCertPrincipals", () => {
	it("extracts the peer SPIFFE id from an Envoy XFCC header", () => {
		expect(parseClientCertPrincipals(xfccFor(GATEWAY))).toEqual([GATEWAY]);
	});

	it("strips surrounding quotes that Envoy adds around values", () => {
		const header = `Hash=abc;Subject="";URI="spiffe://${GATEWAY}"`;
		expect(parseClientCertPrincipals(header)).toEqual([GATEWAY]);
	});

	it("collects every element of a certificate chain", () => {
		const header = `${xfccFor(GATEWAY)},${xfccFor(ATTACKER)}`;
		expect(parseClientCertPrincipals(header)).toEqual([GATEWAY, ATTACKER]);
	});

	it("ignores the By= field, which is the receiving proxy not the caller", () => {
		// A caller must never be authorized by the identity of the proxy that
		// validated the connection — that value is the same for every caller.
		const header = `By=spiffe://${GATEWAY};Hash=abc;Subject=""`;
		expect(parseClientCertPrincipals(header)).toEqual([]);
	});

	it("returns nothing for a malformed or non-SPIFFE header", () => {
		expect(parseClientCertPrincipals("")).toEqual([]);
		expect(parseClientCertPrincipals("garbage")).toEqual([]);
		expect(parseClientCertPrincipals("URI=http://evil.example")).toEqual([]);
	});
});

describe("meshIdentityPlugin", () => {
	it("accepts a caller whose SPIFFE id is on the allowlist", async () => {
		const app = await buildApp({
			allowedPrincipals: [GATEWAY],
			enforcement: "enforce",
		});

		const response = await app.inject({
			method: "GET",
			url: "/reservations",
			headers: { "x-forwarded-client-cert": xfccFor(GATEWAY) },
		});

		expect(response.statusCode).toBe(200);
		await app.close();
	});

	it("accepts the spiffe:// spelling of an allowlist entry", async () => {
		const app = await buildApp({
			allowedPrincipals: [`spiffe://${GATEWAY}`],
			enforcement: "enforce",
		});

		const response = await app.inject({
			method: "GET",
			url: "/reservations",
			headers: { "x-forwarded-client-cert": xfccFor(GATEWAY) },
		});

		expect(response.statusCode).toBe(200);
		await app.close();
	});

	it("rejects a caller with a valid mesh identity that is not allowlisted", async () => {
		// This is the case Istio AuthorizationPolicy is meant to stop. The
		// check is repeated here so it still holds if the sidecar is missing.
		const app = await buildApp({
			allowedPrincipals: [GATEWAY],
			enforcement: "enforce",
		});

		const response = await app.inject({
			method: "GET",
			url: "/reservations",
			headers: { "x-forwarded-client-cert": xfccFor(ATTACKER) },
		});

		expect(response.statusCode).toBe(403);
		expect(response.json().code).toBe("MESH_IDENTITY_REJECTED");
		await app.close();
	});

	it("rejects a caller presenting no client certificate at all", async () => {
		const app = await buildApp({
			allowedPrincipals: [GATEWAY],
			enforcement: "enforce",
		});

		const response = await app.inject({ method: "GET", url: "/reservations" });

		expect(response.statusCode).toBe(403);
		await app.close();
	});

	it("leaves health probes reachable — the kubelet has no mesh identity", async () => {
		const app = await buildApp({
			allowedPrincipals: [GATEWAY],
			enforcement: "enforce",
		});

		const response = await app.inject({ method: "GET", url: "/health" });

		expect(response.statusCode).toBe(200);
		await app.close();
	});

	it("allows unverified callers through in warn mode", async () => {
		// Rollout mode: log what would be rejected without dropping traffic.
		const app = await buildApp({
			allowedPrincipals: [GATEWAY],
			enforcement: "warn",
		});

		const response = await app.inject({ method: "GET", url: "/reservations" });

		expect(response.statusCode).toBe(200);
		await app.close();
	});

	it("refuses to start when enforcing with an empty allowlist", async () => {
		// Failing closed would take the service down on a config typo; failing
		// open would be a silent hole. Refuse at boot instead.
		const app = Fastify();
		await expect(
			app
				.register(meshIdentityPlugin, {
					allowedPrincipals: [],
					enforcement: "enforce",
				})
				.ready(),
		).rejects.toThrow(/allowedPrincipals is empty/);
		await app.close();
	});
});

describe("meshIdentityOptionsFromEnv", () => {
	it("defaults to off so local dev and non-mesh deploys are unaffected", () => {
		expect(meshIdentityOptionsFromEnv({}).enforcement).toBe("off");
	});

	it("treats an unrecognised enforcement value as off rather than guessing", () => {
		expect(
			meshIdentityOptionsFromEnv({ MESH_IDENTITY_ENFORCEMENT: "yes-please" })
				.enforcement,
		).toBe("off");
	});

	it("parses a comma-separated principal list", () => {
		const options = meshIdentityOptionsFromEnv({
			MESH_IDENTITY_ENFORCEMENT: "enforce",
			MESH_ALLOWED_PRINCIPALS: ` ${GATEWAY} , ${ATTACKER} `,
		});

		expect(options.enforcement).toBe("enforce");
		expect(options.allowedPrincipals).toEqual([GATEWAY, ATTACKER]);
	});
});
