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

/**
 * A `reservation.create` command envelope.
 *
 * Two scripts imported a function by this name for months and none existed —
 * `generateReservation` was in nobody's exports, so both threw on their first
 * iteration and neither had ever reached the HTTP layer they were reported as
 * failing at. This is that function, written once.
 *
 * It returns the **envelope**, not a bare reservation: the command endpoint
 * takes `{ tenant_id, payload }` and everything about the booking lives under
 * `payload`. Getting that wrong is a 400 that reads like a schema problem.
 *
 * Dates are pushed well into the future and the window is short, because a
 * long stay consumes more inventory per command and a load run that exhausts
 * its room types starts measuring refusals instead of throughput.
 */
export function generateReservation(tenantId, propertyId, roomTypeId, options = {}) {
	const leadDays = randomInt(options.minLeadDays ?? 1, options.maxLeadDays ?? 120);
	const nights = randomInt(options.minNights ?? 1, options.maxNights ?? 3);
	return {
		tenant_id: tenantId,
		payload: {
			property_id: propertyId,
			room_type_id: roomTypeId,
			guest_id: options.guestId ?? uuid(),
			check_in_date: futureDate(leadDays),
			check_out_date: futureDate(leadDays + nights),
			adults: randomInt(1, 2),
			children: 0,
			rate_code: options.rateCode ?? "BAR",
			total_amount: Number((nights * randomInt(120, 400)).toFixed(2)),
		},
	};
}

/**
 * A `guest.create` command envelope.
 *
 * Same envelope shape as {@link generateReservation}: the command endpoint
 * takes `{ tenant_id, payload }`.
 */
export function generateGuest(tenantId, options = {}) {
	const n = randomInt(1, 1_000_000);
	return {
		tenant_id: tenantId,
		payload: {
			first_name: options.firstName ?? `Load${n}`,
			last_name: options.lastName ?? `Test${n}`,
			email: options.email ?? randomEmail(),
			phone: options.phone ?? randomPhone(),
			country: options.country ?? "US",
		},
	};
}

/**
 * A payment command envelope.
 *
 * `amount_minor` rather than a decimal: money crosses this boundary in minor
 * units, and a float here is the same rounding bug the ledger's NUMERIC
 * columns exist to avoid.
 */
export function generatePayment(tenantId, propertyId, options = {}) {
	return {
		tenant_id: tenantId,
		payload: {
			property_id: propertyId,
			folio_id: options.folioId ?? uuid(),
			amount_minor: options.amountMinor ?? randomInt(5_000, 80_000),
			currency: options.currency ?? "USD",
			payment_method: options.paymentMethod ?? pickRandom(["CASH", "CARD", "TRANSFER"]),
		},
	};
}

/** A housekeeping task command envelope. */
export function generateHousekeepingTask(tenantId, propertyId, options = {}) {
	return {
		tenant_id: tenantId,
		payload: {
			property_id: propertyId,
			room_id: options.roomId ?? uuid(),
			task_type: options.taskType ?? pickRandom(["DEPARTURE_CLEAN", "STAYOVER", "INSPECTION"]),
			priority: options.priority ?? pickRandom(["LOW", "NORMAL", "HIGH"]),
			scheduled_date: options.scheduledDate ?? futureDate(0),
		},
	};
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
	generateReservation,
	generateGuest,
	generatePayment,
	generateHousekeepingTask,
};
