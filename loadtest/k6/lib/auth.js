/**
 * Authentication utilities for Tartware load tests
 */

import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";
import { GATEWAY_URL, ENDPOINTS } from "./config.js";

const authErrors = new Counter("auth_errors");
const tokenRefreshes = new Counter("token_refreshes");

// Token cache
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Login and get JWT token
 */
export function login(username, password) {
	const url = `${GATEWAY_URL}${ENDPOINTS.login}`;
	const payload = JSON.stringify({ username, password });

	const response = http.post(url, payload, {
		headers: {
			"Content-Type": "application/json",
		},
		tags: { name: "auth_login" },
	});

	const success = check(response, {
		"login successful": (r) => r.status === 200,
		"has access_token": (r) => {
			try {
				return !!r.json("access_token");
			} catch {
				return false;
			}
		},
	});

	if (!success) {
		authErrors.add(1);
		console.error(`Login failed: ${response.status} - ${response.body}`);
		return null;
	}

	tokenRefreshes.add(1);
	const body = response.json();
	return {
		accessToken: body.access_token,
		refreshToken: body.refresh_token,
		expiresIn: body.expires_in || 3600,
	};
}

/**
 * Get cached token or refresh if expired
 */
export function getToken(username = "setup.admin", password = "TempPass123") {
	const now = Date.now();

	// Return cached token if still valid (with 60s buffer)
	if (cachedToken && tokenExpiry > now + 60000) {
		return cachedToken;
	}

	// Refresh token
	const auth = login(username, password);
	if (auth) {
		cachedToken = auth.accessToken;
		tokenExpiry = now + auth.expiresIn * 1000;
		return cachedToken;
	}

	return null;
}

/**
 * Build authorization header
 */
export function authHeader(token) {
	return {
		Authorization: `Bearer ${token}`,
	};
}

/**
 * Check if response indicates token expiry
 */
export function isTokenExpired(response) {
	if (response.status === 401) {
		try {
			const body = response.json();
			return (
				body.code === "TOKEN_EXPIRED" ||
				body.code === "AUTHENTICATION_REQUIRED"
			);
		} catch {
			return true;
		}
	}
	return false;
}

/**
 * Force token refresh
 */
export function refreshToken(username = "setup.admin", password = "TempPass123") {
	cachedToken = null;
	tokenExpiry = 0;
	return getToken(username, password);
}

export default {
	login,
	getToken,
	authHeader,
	isTokenExpired,
	refreshToken,
};
