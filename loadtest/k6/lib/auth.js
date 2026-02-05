/**
 * Auth helpers (v2)
 *
 * Uses pre-provided API_TOKEN from environment to avoid login bottleneck.
 * Falls back to login if API_TOKEN is not provided.
 */

import http from "k6/http";
import { check } from "k6";
import { GATEWAY_URL, ENDPOINTS } from "./config.js";

// Pre-provided token from environment (set via get-token.sh before test)
const API_TOKEN = __ENV.API_TOKEN || "";

let cachedToken = API_TOKEN || null;
let tokenExpiry = API_TOKEN ? Date.now() + 3600000 : 0; // 1 hour if pre-provided

export function login(username, password) {
	const response = http.post(
		`${GATEWAY_URL}${ENDPOINTS.login}`,
		JSON.stringify({ username, password }),
		{ headers: { "Content-Type": "application/json" }, tags: { name: "auth_login" } },
	);

	const ok = check(response, {
		"login ok": (r) => r.status === 200,
		"token present": (r) => {
			try {
				return Boolean(r.json("access_token"));
			} catch {
				return false;
			}
		},
	});

	if (!ok) return null;
	const body = response.json();
	return {
		accessToken: body.access_token,
		expiresIn: body.expires_in || 3600,
	};
}

export function getToken(username, password) {
	// If we have a pre-provided API_TOKEN, use it directly
	if (API_TOKEN) {
		return API_TOKEN;
	}

	const now = Date.now();
	if (cachedToken && tokenExpiry > now + 60000) return cachedToken;

	const auth = login(username, password);
	if (!auth) return null;

	cachedToken = auth.accessToken;
	tokenExpiry = now + auth.expiresIn * 1000;
	return cachedToken;
}

export default { login, getToken };
