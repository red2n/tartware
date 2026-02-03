/**
 * Utility functions for Tartware load tests
 */

import { Counter, Trend, Rate } from "k6/metrics";

// Custom metrics per service
export const serviceMetrics = {
	coreService: {
		duration: new Trend("core_service_duration"),
		errors: new Counter("core_service_errors"),
		success: new Rate("core_service_success"),
	},
	billingService: {
		duration: new Trend("billing_service_duration"),
		errors: new Counter("billing_service_errors"),
		success: new Rate("billing_service_success"),
	},
	guestsService: {
		duration: new Trend("guests_service_duration"),
		errors: new Counter("guests_service_errors"),
		success: new Rate("guests_service_success"),
	},
	housekeepingService: {
		duration: new Trend("housekeeping_service_duration"),
		errors: new Counter("housekeeping_service_errors"),
		success: new Rate("housekeeping_service_success"),
	},
	roomsService: {
		duration: new Trend("rooms_service_duration"),
		errors: new Counter("rooms_service_errors"),
		success: new Rate("rooms_service_success"),
	},
	settingsService: {
		duration: new Trend("settings_service_duration"),
		errors: new Counter("settings_service_errors"),
		success: new Rate("settings_service_success"),
	},
};

/**
 * Generate a random UUID v4
 */
export function uuid() {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random element from an array
 */
export function pickRandom(arr) {
	if (!arr || arr.length === 0) return null;
	return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a future date string (ISO format, date only)
 */
export function futureDate(daysFromNow) {
	const date = new Date();
	date.setDate(date.getDate() + daysFromNow);
	return date.toISOString().split("T")[0];
}

/**
 * Generate a random email
 */
export function randomEmail() {
	return `loadtest.${uuid().slice(0, 8)}@tartware-test.com`;
}

/**
 * Generate a random phone number
 */
export function randomPhone() {
	return `+1${randomInt(200, 999)}${randomInt(100, 999)}${randomInt(1000, 9999)}`;
}

/**
 * Generate guest test data
 */
export function generateGuest(tenantId) {
	return {
		tenant_id: tenantId,
		first_name: `LoadTest${randomInt(1000, 9999)}`,
		last_name: `User${randomInt(100, 999)}`,
		email: randomEmail(),
		phone: randomPhone(),
		nationality: pickRandom(["US", "GB", "DE", "FR", "JP", "AU"]),
		language_preference: "en",
		vip_status: pickRandom(["NONE", "SILVER", "GOLD", "PLATINUM"]),
	};
}

/**
 * Generate reservation test data
 */
export function generateReservation(tenantId, propertyId, roomTypeId) {
	const checkIn = futureDate(randomInt(1, 30));
	const nights = randomInt(1, 7);
	const checkInDate = new Date(checkIn);
	checkInDate.setDate(checkInDate.getDate() + nights);
	const checkOut = checkInDate.toISOString().split("T")[0];

	return {
		tenant_id: tenantId,
		property_id: propertyId,
		room_type_id: roomTypeId,
		guest_id: uuid(),
		check_in_date: checkIn,
		check_out_date: checkOut,
		adults: randomInt(1, 4),
		children: randomInt(0, 2),
		status: "CONFIRMED",
		booking_source: pickRandom(["DIRECT", "OTA", "PHONE", "WALKIN"]),
		total_amount: randomInt(100, 1000),
		currency: "USD",
		notes: `k6 load test reservation ${uuid().slice(0, 8)}`,
	};
}

/**
 * Generate payment test data
 */
export function generatePayment(tenantId, propertyId) {
	return {
		tenant_id: tenantId,
		property_id: propertyId,
		guest_id: uuid(),
		folio_id: uuid(),
		amount: randomInt(50, 500),
		currency: "USD",
		payment_method: pickRandom([
			"CASH",
			"CREDIT_CARD",
			"DEBIT_CARD",
			"BANK_TRANSFER",
		]),
		payment_status: "COMPLETED",
		reference_number: `PAY-${uuid().slice(0, 8).toUpperCase()}`,
		notes: "k6 load test payment",
	};
}

/**
 * Generate housekeeping task test data
 */
export function generateHousekeepingTask(tenantId, propertyId) {
	return {
		tenant_id: tenantId,
		property_id: propertyId,
		room_id: uuid(),
		task_type: pickRandom([
			"CHECKOUT_CLEAN",
			"STAYOVER_CLEAN",
			"DEEP_CLEAN",
			"TURNDOWN",
		]),
		priority: pickRandom(["LOW", "NORMAL", "HIGH", "URGENT"]),
		status: "PENDING",
		scheduled_date: futureDate(randomInt(0, 3)),
		notes: "k6 load test task",
	};
}

/**
 * Record service metrics from response
 */
export function recordServiceMetrics(serviceName, response, success) {
	const metrics = serviceMetrics[serviceName];
	if (metrics) {
		metrics.duration.add(response.timings.duration);
		metrics.success.add(success);
		if (!success) {
			metrics.errors.add(1);
		}
	}
}

/**
 * Check if response is successful (2xx status)
 */
export function isSuccess(response) {
	return response.status >= 200 && response.status < 300;
}

/**
 * Check if response is a list endpoint success
 */
export function isListSuccess(response) {
	if (!isSuccess(response)) return false;
	try {
		const body = response.json();
		return Array.isArray(body);
	} catch {
		return false;
	}
}

/**
 * Check if response is a single item success
 */
export function isItemSuccess(response) {
	if (!isSuccess(response)) return false;
	try {
		const body = response.json();
		return body && typeof body === "object" && !Array.isArray(body);
	} catch {
		return false;
	}
}

/**
 * Sleep with jitter (random variance)
 */
export function sleepWithJitter(baseSeconds, jitterPercent = 0.2) {
	const jitter = baseSeconds * jitterPercent * (Math.random() * 2 - 1);
	const duration = Math.max(0.1, baseSeconds + jitter);
	return duration;
}

export default {
	uuid,
	randomInt,
	pickRandom,
	futureDate,
	randomEmail,
	randomPhone,
	generateGuest,
	generateReservation,
	generatePayment,
	generateHousekeepingTask,
	recordServiceMetrics,
	isSuccess,
	isListSuccess,
	isItemSuccess,
	sleepWithJitter,
	serviceMetrics,
};
