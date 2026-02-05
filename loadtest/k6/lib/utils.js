/**
 * Utility helpers for load testing (v2)
 */

export function uuid() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandom(arr) {
	if (!arr || arr.length === 0) return null;
	return arr[Math.floor(Math.random() * arr.length)];
}

export function futureDate(daysFromNow) {
	const date = new Date();
	date.setDate(date.getDate() + daysFromNow);
	return date.toISOString().split("T")[0];
}

export function randomEmail() {
	return `loadtest.${uuid().slice(0, 8)}@pms-loadtest.local`;
}

export function randomPhone() {
	return `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`;
}

export function isSuccess(response) {
	return response.status >= 200 && response.status < 300;
}

export function sleepWithJitter(baseSeconds, jitterPercent = 0.2) {
	const jitter = baseSeconds * jitterPercent * (Math.random() * 2 - 1);
	return Math.max(0.1, baseSeconds + jitter);
}

export function parseList(response) {
	try {
		const body = response.json();
		if (Array.isArray(body)) return body;
		return body?.data || [];
	} catch {
		return [];
	}
}

export function safeJson(response) {
	try {
		return response.json();
	} catch {
		return null;
	}
}

export default {
	uuid,
	randomInt,
	pickRandom,
	futureDate,
	randomEmail,
	randomPhone,
	isSuccess,
	sleepWithJitter,
	parseList,
	safeJson,
};
