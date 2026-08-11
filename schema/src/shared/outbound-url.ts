/**
 * DEV DOC
 * Module: shared/outbound-url.ts
 * Description: SSRF-resistant validation for customer-supplied outbound URLs
 * Primary exports: outboundWebhookUrl, assertSafeOutboundUrl, isSafeOutboundUrl
 * Ownership: Schema package
 */

/**
 * Validation for URLs that the platform will later make an HTTP request to on
 * a customer's behalf — currently webhook subscription targets.
 *
 * WHY THIS EXISTS
 *
 * A webhook destination is chosen by whoever creates the subscription and is
 * then dialled by `core-service` from inside the cluster, with the response
 * status and timing recorded in the delivery log. That is the shape of a
 * Server-Side Request Forgery primitive: without validation a tenant can
 * point a "webhook" at
 *
 *   http://billing-service:3025/...              an internal service
 *   http://169.254.169.254/latest/meta-data/     cloud instance credentials
 *   http://127.0.0.1:15000/                      the pod's own Envoy admin API
 *   file:///etc/passwd                           a non-HTTP scheme
 *
 * and read the outcome back out.
 *
 * DEFENCE IN DEPTH — THIS IS THE SECOND LAYER, NOT THE ONLY ONE
 *
 * The `allow-core-service-webhook-egress` NetworkPolicy
 * (platform/kubernetes/network-policies.yaml) already blocks the packet at
 * the CNI by excluding RFC1918, link-local and loopback ranges from
 * core-service's egress. That control is authoritative because it applies to
 * the address actually connected to.
 *
 * This validator cannot replace it, because a hostname is resolved at request
 * time rather than at validation time: `evil.example` may return a public
 * address when the subscription is created and 169.254.169.254 when the
 * webhook fires (DNS rebinding). What this layer does add is a clear,
 * immediate error at subscription time instead of a silent delivery failure
 * later, and it blocks the obvious literal cases before they reach the
 * network at all.
 *
 * @see docs/ZERO_TRUST_MTLS.md
 */

import { z } from "zod";

/**
 * Schemes we will dial. Everything else — `file:`, `gopher:`, `data:`,
 * `ftp:`, `jar:` — is rejected, since none is a webhook and several are
 * classic SSRF and local-file-read vectors.
 */
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Hostnames that name the local machine or cluster-internal infrastructure.
 * Matched case-insensitively, against the exact host and against any subdomain
 * for the suffix entries.
 */
const BLOCKED_HOSTNAMES = new Set([
	"localhost",
	"metadata",
	"metadata.google.internal",
	"metadata.goog",
	"instance-data",
]);

/** Suffixes that only ever resolve inside a cluster or private network. */
const BLOCKED_HOST_SUFFIXES = [
	".localhost",
	".local",
	".internal",
	".cluster.local",
	".svc",
	".svc.cluster.local",
];

/**
 * Literal IPv4 addresses in ranges that are not routable on the public
 * internet. Ordered to mirror the `except` list on the NetworkPolicy so the
 * two layers agree.
 */
const isPrivateIPv4 = (host: string): boolean => {
	const parts = host.split(".");
	if (parts.length !== 4) return false;

	const octets = parts.map((part) => Number(part));
	if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
		return false;
	}

	const [a, b] = octets as [number, number, number, number];

	if (a === 10) return true; // 10.0.0.0/8 — pod and service CIDRs
	if (a === 127) return true; // 127.0.0.0/8 — loopback
	if (a === 0) return true; // 0.0.0.0/8 — "this network"
	if (a === 169 && b === 254) return true; // 169.254.0.0/16 — cloud metadata
	if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
	if (a === 192 && b === 168) return true; // 192.168.0.0/16
	if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 — CGNAT
	if (a === 192 && b === 0) return true; // 192.0.0.0/24 — IETF assignments
	if (a >= 224) return true; // multicast + reserved

	return false;
};

/**
 * IPv6 loopback, link-local and unique-local addresses. `URL` keeps the
 * brackets on an IPv6 host, so they are stripped before comparison.
 */
const isPrivateIPv6 = (host: string): boolean => {
	const address = host.replace(/^\[|\]$/g, "").toLowerCase();

	if (address === "::1" || address === "::") return true;
	if (address.startsWith("fe80:")) return true; // link-local
	if (/^f[cd][0-9a-f]{2}:/.test(address)) return true; // unique-local fc00::/7

	// IPv4-mapped addresses reach the IPv4 stack, so the IPv4 rules must be
	// applied to the embedded address too. Two spellings must be handled:
	// the dotted form the user types (::ffff:169.254.169.254) and the hex
	// form the URL parser normalises it to (::ffff:a9fe:a9fe). Checking only
	// the dotted form leaves the metadata endpoint reachable.
	const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(address);
	if (dotted?.[1]) return isPrivateIPv4(dotted[1]);

	const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
	if (hex) {
		const high = Number.parseInt(hex[1] as string, 16);
		const low = Number.parseInt(hex[2] as string, 16);
		const octets = [high >> 8, high & 0xff, low >> 8, low & 0xff];
		return isPrivateIPv4(octets.join("."));
	}

	return false;
};

/**
 * A hostname with no dot — `billing-service`, `core-service`, `redis`.
 *
 * These can only resolve through the resolver's search path, which inside the
 * cluster expands to `<name>.<namespace>.svc.cluster.local`. A real webhook
 * endpoint on the public internet always has a dot, so a single-label host is
 * either a mistake or an attempt to reach a sibling service by its short
 * Kubernetes name — the exact bypass that motivated this validator.
 *
 * IPv6 literals are excluded: `URL` reports them bracketed and they contain
 * no dot, so a naive check would reject every public IPv6 endpoint. Private
 * IPv6 is already handled by `isPrivateIPv6`.
 */
const isSingleLabelHostname = (hostname: string): boolean => {
	const isIPv6Literal = hostname.startsWith("[") || hostname.includes(":");
	return !isIPv6Literal && !hostname.includes(".");
};

/** Reason a URL was rejected, or `null` when it is acceptable. */
export const getOutboundUrlRejection = (value: string): string | null => {
	let parsed: URL;
	try {
		parsed = new URL(value);
	} catch {
		return "must be a valid absolute URL";
	}

	if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
		return `scheme "${parsed.protocol.replace(":", "")}" is not allowed; use http or https`;
	}

	// Credentials in the URL leak into logs and are a known filter-bypass
	// trick (http://trusted.example@169.254.169.254/).
	if (parsed.username || parsed.password) {
		return "must not embed credentials; use the authentication_config field instead";
	}

	const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
	if (!hostname) {
		return "must include a hostname";
	}

	if (BLOCKED_HOSTNAMES.has(hostname)) {
		return `host "${hostname}" is internal and cannot be used as a webhook target`;
	}

	if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
		return `host "${hostname}" resolves inside the cluster and cannot be used as a webhook target`;
	}

	if (isPrivateIPv4(hostname) || isPrivateIPv6(hostname)) {
		return `host "${hostname}" is a private or link-local address and cannot be used as a webhook target`;
	}

	// Checked after the IP rules so a bare IPv4 literal reports the more
	// specific "private address" reason rather than this one.
	if (isSingleLabelHostname(hostname)) {
		return `host "${hostname}" is a single-label name that only resolves inside the cluster; use a fully qualified public hostname`;
	}

	return null;
};

/**
 * True when the URL is safe to dial from inside the cluster.
 *
 * Remember this is a point-in-time check on the *hostname*. The network-layer
 * egress policy is what constrains the address actually connected to.
 */
export const isSafeOutboundUrl = (value: string): boolean =>
	getOutboundUrlRejection(value) === null;

/**
 * Throwing form, for use at dispatch time where there is no Zod parse.
 *
 * @throws {Error} when the URL is not an acceptable outbound target.
 */
export const assertSafeOutboundUrl = (value: string): void => {
	const rejection = getOutboundUrlRejection(value);
	if (rejection !== null) {
		throw new Error(`Unsafe outbound URL: ${rejection}`);
	}
};

/**
 * Zod schema for a customer-supplied webhook target.
 *
 * Use this in place of `z.string()` or the generic `url` helper anywhere a
 * value will be dialled by the platform on a customer's behalf.
 */
export const outboundWebhookUrl = z
	.string()
	.trim()
	.max(2048, { message: "URL must be 2048 characters or fewer" })
	.superRefine((value, ctx) => {
		const rejection = getOutboundUrlRejection(value);
		if (rejection !== null) {
			ctx.addIssue({ code: z.ZodIssueCode.custom, message: rejection });
		}
	})
	.describe(
		"Publicly routable http(s) URL the platform will POST to. Private, loopback, link-local and cluster-internal hosts are rejected.",
	);
