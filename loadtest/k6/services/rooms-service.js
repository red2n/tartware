/**
 * Rooms Service Load Test
 *
 * Tests: Rooms, Room Types, Room Status, Room Features
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";
import {
	GATEWAY_URL,
	TENANT_ID,
	PROPERTY_ID,
	VUS,
	DURATION,
	getHeaders,
	ENDPOINTS,
	DEFAULT_THRESHOLDS,
} from "../lib/config.js";
import {
	sleepWithJitter,
	isSuccess,
	pickRandom,
} from "../lib/utils.js";

const roomsLatency = new Trend("rooms_service_latency");
const roomsErrors = new Counter("rooms_service_errors");
const roomsSuccess = new Rate("rooms_service_success_rate");

export const options = {
	stages: [
		{ duration: "30s", target: Math.floor(VUS / 2) },
		{ duration: DURATION, target: VUS },
		{ duration: "30s", target: 0 },
	],
	thresholds: {
		...DEFAULT_THRESHOLDS,
		rooms_service_latency: ["p(95)<300", "p(99)<700"],
		rooms_service_success_rate: ["rate>0.98"],
	},
};

const headers = getHeaders();

let cachedRoomTypes = [];
let cachedRooms = [];

export function setup() {
	const roomTypesRes = http.get(
		`${GATEWAY_URL}${ENDPOINTS.roomTypes}?tenant_id=${TENANT_ID}`,
		{ headers },
	);

	if (roomTypesRes.status === 200) {
		try {
			const data = JSON.parse(roomTypesRes.body);
			cachedRoomTypes = Array.isArray(data) ? data : data.data || [];
		} catch (e) {
			cachedRoomTypes = [];
		}
	}

	const roomsRes = http.get(
		`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=50`,
		{ headers },
	);

	if (roomsRes.status === 200) {
		try {
			const data = JSON.parse(roomsRes.body);
			cachedRooms = Array.isArray(data) ? data : data.data || [];
		} catch (e) {
			cachedRooms = [];
		}
	}

	return { roomTypes: cachedRoomTypes, rooms: cachedRooms };
}

export default function (data) {
	const { roomTypes, rooms } = data || { roomTypes: [], rooms: [] };
	const selector = Math.random();

	if (selector < 0.3) {
		testListRooms();
	} else if (selector < 0.5) {
		testListRoomTypes();
	} else if (selector < 0.65) {
		testRoomsByProperty();
	} else if (selector < 0.8) {
		testGetRoom(rooms);
	} else if (selector < 0.9) {
		testRoomStatus(rooms);
	} else {
		testRoomTypeDetails(roomTypes);
	}

	sleep(sleepWithJitter(0.2));
}

function testListRooms() {
	group("Rooms - List Rooms", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&limit=50`,
			{ headers, tags: { service: "rooms", endpoint: "rooms-list" } },
		);

		recordMetrics(response, "rooms-list");
	});
}

function testListRoomTypes() {
	group("Rooms - List Room Types", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.roomTypes}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "rooms", endpoint: "room-types-list" } },
		);

		recordMetrics(response, "room-types-list");
	});
}

function testRoomsByProperty() {
	group("Rooms - Rooms by Property", () => {
		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.rooms}?tenant_id=${TENANT_ID}&property_id=${PROPERTY_ID}`,
			{ headers, tags: { service: "rooms", endpoint: "rooms-by-property" } },
		);

		recordMetrics(response, "rooms-by-property");
	});
}

function testGetRoom(rooms) {
	if (!rooms || rooms.length === 0) {
		testListRooms();
		return;
	}

	group("Rooms - Get Room by ID", () => {
		const room = pickRandom(rooms);
		const roomId = room.room_id || room.id;

		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.rooms}/${roomId}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "rooms", endpoint: "room-get" } },
		);

		recordMetrics(response, "room-get");
	});
}

function testRoomStatus(rooms) {
	if (!rooms || rooms.length === 0) {
		testListRooms();
		return;
	}

	group("Rooms - Room Status", () => {
		const room = pickRandom(rooms);
		const roomId = room.room_id || room.id;

		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.rooms}/${roomId}/status?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "rooms", endpoint: "room-status" } },
		);

		const success = isSuccess(response) || response.status === 404;

		roomsLatency.add(response.timings.duration);
		roomsSuccess.add(success);

		if (!success) {
			roomsErrors.add(1);
		}

		check(
			response,
			{
				"room-status ok or 404": (r) => isSuccess(r) || r.status === 404,
			},
			{ endpoint: "room-status" },
		);
	});
}

function testRoomTypeDetails(roomTypes) {
	if (!roomTypes || roomTypes.length === 0) {
		testListRoomTypes();
		return;
	}

	group("Rooms - Room Type Details", () => {
		const roomType = pickRandom(roomTypes);
		const typeId = roomType.room_type_id || roomType.id;

		const response = http.get(
			`${GATEWAY_URL}${ENDPOINTS.roomTypes}/${typeId}?tenant_id=${TENANT_ID}`,
			{ headers, tags: { service: "rooms", endpoint: "room-type-get" } },
		);

		recordMetrics(response, "room-type-get");
	});
}

function recordMetrics(response, endpoint) {
	const success = isSuccess(response);

	roomsLatency.add(response.timings.duration);
	roomsSuccess.add(success);

	if (!success) {
		roomsErrors.add(1);
	}

	check(
		response,
		{
			[`${endpoint} status ok`]: (r) => isSuccess(r),
		},
		{ endpoint },
	);
}

export function handleSummary(data) {
	return {
		stdout: `
╔════════════════════════════════════════════════════════════╗
║              ROOMS SERVICE TEST SUMMARY                     ║
╠════════════════════════════════════════════════════════════╣
║  Success Rate: ${((data.metrics.rooms_service_success_rate?.values.rate || 0) * 100).toFixed(1)}%
║  p95 Latency: ${data.metrics.rooms_service_latency?.values["p(95)"]?.toFixed(0) || "N/A"}ms
║  Error Count: ${data.metrics.rooms_service_errors?.values.count || 0}
║  Total Requests: ${data.metrics.http_reqs?.values.count || 0}
╚════════════════════════════════════════════════════════════╝
`,
	};
}
