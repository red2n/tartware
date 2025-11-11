import type { FastifyReply, FastifyRequest } from "fastify";

const hopByHopHeaders = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"te",
	"trailer",
	"transfer-encoding",
	"upgrade",
	"content-length",
	"host",
]);

const buildHeaders = (request: FastifyRequest): Headers => {
	const headers = new Headers();
	for (const [key, value] of Object.entries(request.headers)) {
		if (value === undefined || value === null) continue;
		if (hopByHopHeaders.has(key.toLowerCase())) continue;

		if (Array.isArray(value)) {
			for (const item of value) {
				headers.append(key, item);
			}
		} else {
			headers.set(key, String(value));
		}
	}
	return headers;
};

const serializeBody = (
	request: FastifyRequest,
	headers: Headers,
): BodyInit | undefined => {
	const method = request.method.toUpperCase();
	if (method === "GET" || method === "HEAD") {
		return undefined;
	}

	const body = request.body;
	if (!body) {
		return undefined;
	}

	if (Buffer.isBuffer(body)) {
		return new Uint8Array(body);
	}

	if (typeof body === "string") {
		return body;
	}

	if (body instanceof Uint8Array) {
		return new Uint8Array(body);
	}

	headers.set(
		"content-type",
		headers.get("content-type") ?? "application/json",
	);
	return JSON.stringify(body);
};

export const proxyRequest = async (
	request: FastifyRequest,
	reply: FastifyReply,
	targetBaseUrl: string,
): Promise<void> => {
	const url = request.raw.url ?? "/";
	const targetUrl = new URL(url, targetBaseUrl).toString();
	const headers = buildHeaders(request);
	const body = serializeBody(request, headers);

	const response = await fetch(targetUrl, {
		method: request.method,
		headers,
		body,
	});

	reply.status(response.status);
	response.headers.forEach((value, key) => {
		if (!hopByHopHeaders.has(key.toLowerCase())) {
			reply.header(key, value);
		}
	});

	const buffer = Buffer.from(await response.arrayBuffer());
	reply.send(buffer);
};
