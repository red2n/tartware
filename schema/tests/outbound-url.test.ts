import { describe, expect, it } from "vitest";

import {
	assertSafeOutboundUrl,
	getOutboundUrlRejection,
	isSafeOutboundUrl,
	outboundWebhookUrl,
} from "../src/shared/outbound-url.js";

describe("outbound URL validation — accepted targets", () => {
	it.each([
		"https://hooks.example.com/tartware",
		"http://api.partner.example/webhooks/booking",
		"https://example.com:8443/hook?token=abc",
		"https://8.8.8.8/hook", // public literal IP
		"https://[2001:4860:4860::8888]/hook", // public IPv6
	])("accepts %s", (url) => {
		expect(getOutboundUrlRejection(url)).toBeNull();
		expect(isSafeOutboundUrl(url)).toBe(true);
	});
});

describe("outbound URL validation — SSRF targets", () => {
	it("rejects cluster-internal service names", () => {
		// The exact shape of the attack: a "webhook" aimed at a sibling service
		// that is otherwise only reachable from the api-gateway.
		expect(
			getOutboundUrlRejection(
				"http://core-service.tartware-system.svc.cluster.local/x",
			),
		).toMatch(/cluster/i);
	});

	it("rejects single-label hostnames", () => {
		// `http://billing-service:3025/` has no dot, so it can only resolve via
		// the cluster DNS search path — which expands it to a sibling service.
		// A dot-free host is never a real public webhook endpoint.
		expect(
			getOutboundUrlRejection("http://billing-service:3025/v1/invoices"),
		).toMatch(/single-label/i);
		expect(getOutboundUrlRejection("http://redis/x")).toMatch(/single-label/i);
	});

	it("still accepts public IPv6 literals, which contain no dot", () => {
		// Regression guard for the single-label rule: a naive `!includes(".")`
		// check rejects every public IPv6 endpoint.
		expect(
			getOutboundUrlRejection("https://[2606:4700::1111]/hook"),
		).toBeNull();
	});

	it("rejects the cloud metadata endpoint", () => {
		// 169.254.169.254 returns instance credentials on AWS/GCP/Azure.
		expect(
			getOutboundUrlRejection("http://169.254.169.254/latest/meta-data/"),
		).toMatch(/private or link-local/i);
		expect(
			getOutboundUrlRejection("http://metadata.google.internal/x"),
		).not.toBeNull();
	});

	it("rejects loopback, including the pod's own Envoy admin API", () => {
		expect(
			getOutboundUrlRejection("http://127.0.0.1:15000/config_dump"),
		).not.toBeNull();
		expect(getOutboundUrlRejection("http://localhost:3000/")).not.toBeNull();
		expect(getOutboundUrlRejection("http://[::1]:3000/")).not.toBeNull();
	});

	it.each([
		"http://10.0.0.5/x",
		"http://172.16.4.1/x",
		"http://172.31.255.254/x",
		"http://192.168.1.1/x",
		"http://100.64.0.1/x",
		"http://0.0.0.0/x",
	])("rejects private range %s", (url) => {
		expect(getOutboundUrlRejection(url)).toMatch(/private or link-local/i);
	});

	it("does not over-block public addresses adjacent to private ranges", () => {
		// 172.32.x is public even though 172.16-31 is not; an off-by-one here
		// would silently break legitimate customer webhooks.
		expect(getOutboundUrlRejection("http://172.32.0.1/x")).toBeNull();
		expect(getOutboundUrlRejection("http://11.0.0.1/x")).toBeNull();
		expect(getOutboundUrlRejection("http://100.128.0.1/x")).toBeNull();
	});

	it("rejects IPv4-mapped IPv6 pointing at metadata", () => {
		// ::ffff:169.254.169.254 reaches the IPv4 stack and would otherwise
		// slip past an IPv4-only check.
		expect(
			getOutboundUrlRejection("http://[::ffff:169.254.169.254]/x"),
		).not.toBeNull();
	});

	it("rejects IPv6 link-local and unique-local", () => {
		expect(getOutboundUrlRejection("http://[fe80::1]/x")).not.toBeNull();
		expect(getOutboundUrlRejection("http://[fd00::1]/x")).not.toBeNull();
	});

	it("rejects non-HTTP schemes", () => {
		expect(getOutboundUrlRejection("file:///etc/passwd")).toMatch(/scheme/i);
		expect(getOutboundUrlRejection("gopher://example.com/x")).toMatch(
			/scheme/i,
		);
		expect(getOutboundUrlRejection("data:text/plain,hello")).toMatch(/scheme/i);
	});

	it("rejects embedded credentials used to disguise the real host", () => {
		// Reads as "trusted.example" at a glance; connects to the metadata IP.
		expect(
			getOutboundUrlRejection("http://trusted.example@169.254.169.254/"),
		).toMatch(/credential/i);
	});

	it("rejects a trailing-dot bypass of the suffix check", () => {
		expect(
			getOutboundUrlRejection("http://foo.svc.cluster.local./x"),
		).not.toBeNull();
	});

	it("rejects values that are not absolute URLs", () => {
		expect(getOutboundUrlRejection("not a url")).toMatch(/valid absolute URL/i);
		expect(getOutboundUrlRejection("/relative/path")).toMatch(
			/valid absolute URL/i,
		);
		expect(getOutboundUrlRejection("")).toMatch(/valid absolute URL/i);
	});
});

describe("assertSafeOutboundUrl", () => {
	it("throws with the reason for an unsafe URL", () => {
		expect(() => assertSafeOutboundUrl("http://169.254.169.254/")).toThrow(
			/Unsafe outbound URL/,
		);
	});

	it("returns silently for a safe URL", () => {
		expect(() =>
			assertSafeOutboundUrl("https://example.com/hook"),
		).not.toThrow();
	});
});

describe("outboundWebhookUrl zod schema", () => {
	it("parses and trims a valid URL", () => {
		expect(outboundWebhookUrl.parse("  https://example.com/hook  ")).toBe(
			"https://example.com/hook",
		);
	});

	it("fails with the specific reason rather than a generic message", () => {
		const result = outboundWebhookUrl.safeParse("http://10.1.2.3/hook");
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toMatch(/private or link-local/i);
		}
	});

	it("rejects absurdly long URLs", () => {
		const long = `https://example.com/${"a".repeat(2100)}`;
		expect(outboundWebhookUrl.safeParse(long).success).toBe(false);
	});
});
