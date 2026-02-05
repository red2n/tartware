/**
 * Booking journey (v2)
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import {
	GATEWAY_URL,
	ADMIN_USERNAME,
	ADMIN_PASSWORD,
	TENANT_IDS,
	PROPERTY_IDS,
	ROOM_TYPE_IDS,
	RATE_CODE,
	VUS,
	DURATION,
	RAMP_UP,
	DEFAULT_THRESHOLDS,
	getHeaders,
	ENDPOINTS,
} from "../lib/config.js";
import {
	uuid,
	randomInt,
	pickRandom,
	futureDate,
	randomEmail,
	randomPhone,
	sleepWithJitter,
	isSuccess,
	parseList,
} from "../lib/utils.js";
import { getToken } from "../lib/auth.js";

const journeyLatency = new Trend("journey_latency");
const journeyErrors = new Counter("journey_errors");
const journeySuccess = new Rate("journey_success_rate");

export const options = {
	stages: [
		{ duration: RAMP_UP, target: Math.max(1, Math.floor(VUS / 2)) },
		{ duration: DURATION, target: VUS },
		{ duration: "30s", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		journey_success_rate: ["rate>0.9"],
		journey_latency: ["p(95)<1500"],
	},
};

export default function () {
	const token = getToken(ADMIN_USERNAME, ADMIN_PASSWORD);
	if (!token) return;
	const headers = getHeaders(token);

	const tenantId = pickRandom(TENANT_IDS);
	const propertyId = pickRandom(PROPERTY_IDS);
	const roomTypeId = pickRandom(ROOM_TYPE_IDS);

	group("Booking Journey", () => {
		const availabilityRes = http.get(
			`${GATEWAY_URL}${ENDPOINTS.availability}?tenant_id=${tenantId}&property_id=${propertyId}&check_in=${futureDate(10)}&check_out=${futureDate(12)}`,
			{ headers, tags: { operation: "availability" } },
		);
		check(availabilityRes, { "availability ok": (r) => isSuccess(r) });

		const guestEmail = randomEmail();
		const guestPayload = {
			first_name: "Load",
			last_name: "Tester",
			email: guestEmail,
			phone: randomPhone(),
			metadata: { source: "journey" },
		};

		const guestRes = http.post(
			`${GATEWAY_URL}${ENDPOINTS.commands}/guest.register/execute`,
			JSON.stringify({ tenant_id: tenantId, payload: guestPayload }),
			{
				headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `journey-guest-${uuid()}` },
				tags: { operation: "guest.register" },
			},
		);

		const guestOk = guestRes.status === 202;
		if (!guestOk) {
			journeyErrors.add(1);
			journeySuccess.add(false);
			return;
		}

		sleep(0.4);
		const guestLookup = http.get(
			`${GATEWAY_URL}${ENDPOINTS.guests}?tenant_id=${tenantId}&email=${encodeURIComponent(guestEmail)}`,
			{ headers, tags: { operation: "guest.lookup" } },
		);
		const guests = parseList(guestLookup);
		const guest = guests[0];
		const guestId = guest?.guest_id || guest?.id || null;
		if (!guestId) {
			journeyErrors.add(1);
			journeySuccess.add(false);
			return;
		}

		const reservationPayload = {
			property_id: propertyId,
			guest_id: guestId,
			room_type_id: roomTypeId,
			check_in_date: futureDate(10),
			check_out_date: futureDate(12),
			rate_code: RATE_CODE,
			total_amount: randomInt(150, 900),
			currency: "USD",
			source: "DIRECT",
			notes: `journey ${uuid().slice(0, 6)}`,
		};

		const reservationRes = http.post(
			`${GATEWAY_URL}${ENDPOINTS.commands}/reservation.create/execute`,
			JSON.stringify({ tenant_id: tenantId, payload: reservationPayload }),
			{
				headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `journey-res-${uuid()}` },
				tags: { operation: "reservation.create" },
			},
		);

		const ok = reservationRes.status === 202;
		journeyLatency.add(reservationRes.timings.duration);
		journeySuccess.add(ok);
		if (!ok) journeyErrors.add(1);

		if (!ok) return;

		const reservationId = findReservationByGuest(
			headers,
			tenantId,
			guestId,
		);
		if (!reservationId) {
			journeyErrors.add(1);
			journeySuccess.add(false);
			return;
		}

		const modifyPayload = {
			reservation_id: reservationId,
			check_out_date: futureDate(13),
			notes: "journey modify",
		};

		const modifyRes = http.post(
			`${GATEWAY_URL}${ENDPOINTS.commands}/reservation.modify/execute`,
			JSON.stringify({ tenant_id: tenantId, payload: modifyPayload }),
			{
				headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `journey-mod-${uuid()}` },
				tags: { operation: "reservation.modify" },
			},
		);

		const modifyOk = modifyRes.status === 202;
		journeySuccess.add(modifyOk);
		if (!modifyOk) journeyErrors.add(1);

		const cancelPayload = {
			reservation_id: reservationId,
			reason: "journey cancel",
		};

		const cancelRes = http.post(
			`${GATEWAY_URL}${ENDPOINTS.commands}/reservation.cancel/execute`,
			JSON.stringify({ tenant_id: tenantId, payload: cancelPayload }),
			{
				headers: { ...headers, "X-Request-ID": uuid(), "X-Idempotency-Key": `journey-cancel-${uuid()}` },
				tags: { operation: "reservation.cancel" },
			},
		);

		const cancelOk = cancelRes.status === 202;
		journeySuccess.add(cancelOk);
		if (!cancelOk) journeyErrors.add(1);
	});

	sleep(sleepWithJitter(0.6));
}

function findReservationByGuest(headers, tenantId, guestId) {
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.reservations}?tenant_id=${tenantId}&guest_id=${guestId}&limit=1`,
			{ headers, tags: { operation: "reservation.lookup" } },
		);
		if (isSuccess(response)) {
			const reservations = parseList(response);
			const reservation = reservations[0];
			const reservationId =
				reservation?.reservation_id || reservation?.id || null;
			if (reservationId) return reservationId;
		}
		sleep(0.4);
	}

	return null;
}
