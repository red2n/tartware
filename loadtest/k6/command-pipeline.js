import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

const BASE_URL = __ENV.GATEWAY_BASE_URL ?? "http://localhost:8080";
const API_TOKEN = __ENV.API_TOKEN ?? "";
const TEST_DURATION = __ENV.TEST_DURATION ?? "20m";

const TENANT_IDS = parseList(__ENV.TENANT_IDS);
const PROPERTY_IDS = parseList(__ENV.PROPERTY_IDS);
const ROOM_TYPE_IDS = parseList(__ENV.ROOM_TYPE_IDS);
const RESERVATION_IDS = parseList(__ENV.RESERVATION_IDS);
const GUEST_IDS = parseList(__ENV.GUEST_IDS);
const HOUSEKEEPING_TASK_IDS = parseList(__ENV.HOUSEKEEPING_TASK_IDS);
const HOUSEKEEPING_STAFF_IDS = parseList(__ENV.HOUSEKEEPING_STAFF_IDS);

const headers = (() => {
	if (!API_TOKEN) {
		throw new Error("API_TOKEN environment variable is required for authenticated load tests.");
	}
	return {
		Authorization: `Bearer ${API_TOKEN}`,
		"Content-Type": "application/json",
		"User-Agent": "tartware-k6-loadtest",
	};
})();

const commandDuration = new Trend("command_duration_ms");
const commandFailures = new Counter("command_failures_total");
const readDuration = new Trend("read_duration_ms");
const readFailures = new Counter("read_failures_total");

export const options = {
	thresholds: {
		http_req_failed: ["rate<0.05"],
		http_req_duration: ["p(95)<1000", "p(99)<1500"],
		command_failures_total: ["count<1000"],
	},
	scenarios: {
		command_pipeline: {
			executor: "ramping-arrival-rate",
			startRate: Number(__ENV.COMMAND_START_RATE ?? 500),
			timeUnit: "1s",
			stages: [
				{ target: Number(__ENV.COMMAND_TARGET_RATE ?? 5000), duration: "3m" },
				{ target: Number(__ENV.COMMAND_TARGET_RATE ?? 5000), duration: TEST_DURATION },
				{ target: 0, duration: "2m" },
			],
			preAllocatedVUs: Number(__ENV.COMMAND_PREALLOCATED_VUS ?? 500),
			maxVUs: Number(__ENV.COMMAND_MAX_VUS ?? 5000),
			exec: "driveCommands",
		},
		read_proxies: {
			executor: "constant-arrival-rate",
			rate: Number(__ENV.READ_RATE ?? 5000),
			timeUnit: "1s",
			duration: TEST_DURATION,
			preAllocatedVUs: Number(__ENV.READ_PREALLOCATED_VUS ?? 300),
			maxVUs: Number(__ENV.READ_MAX_VUS ?? 1500),
			exec: "driveReads",
		},
		health_probes: {
			executor: "constant-arrival-rate",
			rate: 100,
			timeUnit: "1s",
			duration: TEST_DURATION,
			preAllocatedVUs: 20,
			maxVUs: 50,
			exec: "checkHealth",
		},
	},
};

export function driveCommands() {
	const selector = Math.random();
	if (selector < 0.30) {
		createReservation();
	} else if (selector < 0.5) {
		registerGuest();
	} else if (selector < 0.65) {
		modifyReservation();
	} else if (selector < 0.75) {
		cancelReservation();
	} else if (selector < 0.9) {
		captureBillingPayment();
	} else if (selector < 0.95) {
		assignHousekeepingTask();
	} else {
		completeHousekeepingTask();
	}
	sleep(0.05);
}

export function driveReads() {
	const tenantId = pickRandom(TENANT_IDS);
	const ops = [
		() => listRooms(tenantId),
		() => listGuests(tenantId),
		() => listBillingPayments(tenantId),
	];
	pickRandom(ops)();
	sleep(0.05);
}

export function checkHealth() {
	const res = http.get(`${BASE_URL}/health`, { headers });
	const ok = check(res, { "health is up": (r) => r.status === 200 });
	if (!ok) {
		readFailures.add(1);
	}
	readDuration.add(res.timings.duration);
}

function registerGuest() {
	const tenantId = pickRandom(TENANT_IDS);
	const payload = {
		tenant_id: tenantId,
		first_name: `Load${randomInt(1000, 9999)}`,
		last_name: `Tester${randomInt(1000, 9999)}`,
		email: `load${randomInt(100000, 999999)}@example.com`,
		phone: `+1${randomInt(1000000000, 1999999999)}`,
		address: {
			street: `${randomInt(100, 999)} Test Ave`,
			city: "K6City",
			state: "CA",
			country: "US",
			postal_code: "90001",
		},
		metadata: {
			loadTest: true,
			source: "k6",
		},
	};
	sendCommand("guest.register", () =>
		http.post(`${BASE_URL}/v1/guests`, JSON.stringify(payload), { headers }),
	);
}

function createReservation() {
	const tenantId = pickRandom(TENANT_IDS);
	const reservationId = randomUuid();
	const payload = {
		property_id: pickRandom(PROPERTY_IDS),
		guest_id: pickRandom(GUEST_IDS) ?? randomUuid(),
		room_type_id: pickRandom(ROOM_TYPE_IDS),
		check_in_date: futureDate(2),
		check_out_date: futureDate(5),
		booking_date: new Date().toISOString(),
		status: "PENDING",
		total_amount: randomInt(100, 600),
		currency: "USD",
		source: "DIRECT",
		notes: `k6 reservation ${reservationId}`,
	};
	sendCommand("reservation.create", () =>
		http.post(
			`${BASE_URL}/v1/tenants/${tenantId}/reservations`,
			JSON.stringify(payload),
			{ headers },
		),
	);
}

function modifyReservation() {
	const tenantId = pickRandom(TENANT_IDS);
	const reservationId = pickRandom(RESERVATION_IDS) ?? randomUuid();
	const payload = {
		property_id: pickRandom(PROPERTY_IDS),
		check_in_date: futureDate(3),
		check_out_date: futureDate(6),
		total_amount: randomInt(120, 650),
		notes: "k6 modification",
	};
	sendCommand("reservation.modify", () =>
		http.patch(
			`${BASE_URL}/v1/tenants/${tenantId}/reservations/${reservationId}`,
			JSON.stringify(payload),
			{ headers },
		),
	);
}

function cancelReservation() {
	const tenantId = pickRandom(TENANT_IDS);
	const reservationId = pickRandom(RESERVATION_IDS) ?? randomUuid();
	const payload = {
		property_id: pickRandom(PROPERTY_IDS),
		reason: "load-test-cancel",
	};
	sendCommand("reservation.cancel", () =>
		http.del(
			`${BASE_URL}/v1/tenants/${tenantId}/reservations/${reservationId}`,
			JSON.stringify(payload),
			{ headers },
		),
	);
}

function captureBillingPayment() {
	const tenantId = pickRandom(TENANT_IDS);
	const reservationId = pickRandom(RESERVATION_IDS) ?? randomUuid();
	const guestId = pickRandom(GUEST_IDS) ?? randomUuid();
	const payload = {
		property_id: pickRandom(PROPERTY_IDS),
		reservation_id: reservationId,
		guest_id: guestId,
		payment_reference: `k6-${randomUuid()}`,
		payment_method: "CARD",
		amount: randomInt(50, 500),
		currency: "USD",
		gateway: {
			name: "k6-gateway",
			reference: randomUuid(),
			response: { status: "APPROVED" },
		},
		metadata: {
			loadTest: true,
			source: "k6",
		},
	};
	sendCommand("billing.payment.capture", () =>
		http.post(
			`${BASE_URL}/v1/tenants/${tenantId}/billing/payments/capture`,
			JSON.stringify(payload),
			{ headers },
		),
	);
}

function assignHousekeepingTask() {
	const tenantId = pickRandom(TENANT_IDS);
	const taskId = pickRandom(HOUSEKEEPING_TASK_IDS);
	const assignee = pickRandom(HOUSEKEEPING_STAFF_IDS);
	const payload = {
		priority: Math.random() > 0.7 ? "HIGH" : "NORMAL",
		notes: "k6 assignment",
		assigned_to: assignee,
	};
	sendCommand("housekeeping.task.assign", () =>
		http.post(
			`${BASE_URL}/v1/tenants/${tenantId}/housekeeping/tasks/${taskId}/assign`,
			JSON.stringify(payload),
			{ headers },
		),
	);
}

function completeHousekeepingTask() {
	const tenantId = pickRandom(TENANT_IDS);
	const taskId = pickRandom(HOUSEKEEPING_TASK_IDS);
	const completedBy = pickRandom(HOUSEKEEPING_STAFF_IDS);
	const payload = {
		completed_by: completedBy,
		notes: "k6 completion",
		inspection: {
			inspected_by: completedBy,
			passed: Math.random() > 0.2,
			notes: "auto inspection",
		},
	};
	sendCommand("housekeeping.task.complete", () =>
		http.post(
			`${BASE_URL}/v1/tenants/${tenantId}/housekeeping/tasks/${taskId}/complete`,
			JSON.stringify(payload),
			{ headers },
		),
	);
}

function listRooms(tenantId) {
	const res = http.get(
		`${BASE_URL}/v1/rooms?tenant_id=${tenantId}&limit=50`,
		{ headers },
	);
	const ok = check(res, { "rooms ok": (r) => r.status === 200 });
	if (!ok) {
		readFailures.add(1);
	}
	readDuration.add(res.timings.duration);
}

function listGuests(tenantId) {
	const res = http.get(
		`${BASE_URL}/v1/guests?tenant_id=${tenantId}&limit=50`,
		{ headers },
	);
	const ok = check(res, { "guests ok": (r) => r.status === 200 });
	if (!ok) {
		readFailures.add(1);
	}
	readDuration.add(res.timings.duration);
}

function listBillingPayments(tenantId) {
	const res = http.get(
		`${BASE_URL}/v1/billing/payments?tenant_id=${tenantId}&limit=50`,
		{ headers },
	);
	const ok = check(res, { "billing ok": (r) => r.status === 200 });
	if (!ok) {
		readFailures.add(1);
	}
	readDuration.add(res.timings.duration);
}

function sendCommand(name, requestFn) {
	const res = requestFn();
	const ok = check(res, {
		[`${name} accepted`]: (r) => r.status === 202,
	});
	commandDuration.add(res.timings.duration);
	if (!ok) {
		commandFailures.add(1);
	}
}

function parseList(value) {
	if (!value) {
		return [];
	}
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function pickRandom(values) {
	if (!values || values.length === 0) {
		throw new Error(
			"Load test requires TENANT_IDS, PROPERTY_IDS, and ROOM_TYPE_IDS environment variables.",
		);
	}
	const index = Math.floor(Math.random() * values.length);
	return values[index];
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomUuid() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

function futureDate(offsetDays) {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	return date.toISOString();
}
