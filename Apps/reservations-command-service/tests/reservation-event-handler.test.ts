import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, dispatchNotificationCommandMock } = vi.hoisted(() => ({
	queryMock: vi.fn(),
	dispatchNotificationCommandMock: vi.fn(),
}));

vi.mock("../src/lib/db.js", () => ({
	query: queryMock,
}));

vi.mock("../src/services/reservation-commands/notification-dispatch.js", () => ({
	dispatchNotificationCommand: dispatchNotificationCommandMock,
}));

import { processReservationEvent } from "../src/services/reservation-event-handler.js";

const buildQueryResult = <TRow extends Record<string, unknown>>(rows: TRow[] = []) => ({
	rows,
	rowCount: rows.length,
	command: "SELECT",
	oid: 0,
	fields: [],
});

describe("processReservationEvent", () => {
	beforeEach(() => {
		queryMock.mockReset();
		dispatchNotificationCommandMock.mockReset();
	});

	it("allows multiple reservations to reuse the same share unique identifier", async () => {
		const tenantId = "11111111-1111-1111-1111-111111111111";
		const propertyId = "22222222-2222-2222-2222-222222222222";
		const roomTypeId = "33333333-3333-3333-3333-333333333333";
		const sharedIdentifier = "44444444-4444-4444-4444-444444444444";
		const firstGuestId = "55555555-5555-5555-5555-555555555555";
		const secondGuestId = "66666666-6666-6666-6666-666666666666";

		queryMock
			.mockResolvedValueOnce(buildQueryResult([{}]))
			.mockResolvedValueOnce(
				buildQueryResult([
					{ first_name: "Alex", last_name: "One", email: "alex.one@example.com" },
				]),
			)
			.mockResolvedValueOnce(buildQueryResult())
			.mockResolvedValueOnce(buildQueryResult())
			.mockResolvedValueOnce(buildQueryResult())
			.mockResolvedValueOnce(buildQueryResult([{}]))
			.mockResolvedValueOnce(
				buildQueryResult([
					{ first_name: "Blair", last_name: "Two", email: "blair.two@example.com" },
				]),
			)
			.mockResolvedValueOnce(buildQueryResult())
			.mockResolvedValueOnce(buildQueryResult())
			.mockResolvedValueOnce(buildQueryResult());

		const firstReservationId = "77777777-7777-7777-7777-777777777777";
		const secondReservationId = "88888888-8888-8888-8888-888888888888";
		const timestamp = new Date("2026-03-16T07:14:29.085Z").toISOString();

		await processReservationEvent({
			metadata: {
				id: "99999999-9999-9999-9999-999999999999",
				source: "reservations-command-service-test",
				type: "reservation.created",
				timestamp,
				version: "1.0",
				tenantId,
				retryCount: 0,
			},
			payload: {
				id: firstReservationId,
				property_id: propertyId,
				guest_id: firstGuestId,
				room_type_id: roomTypeId,
				check_in_date: new Date("2026-04-01"),
				check_out_date: new Date("2026-04-03"),
				booking_date: new Date("2026-03-16"),
				status: "PENDING",
				source: "DIRECT",
				reservation_type: "TRANSIENT",
				total_amount: 300,
				currency: "USD",
				share_unique_identifier: sharedIdentifier,
			},
		});

		await processReservationEvent({
			metadata: {
				id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				source: "reservations-command-service-test",
				type: "reservation.created",
				timestamp,
				version: "1.0",
				tenantId,
				retryCount: 0,
			},
			payload: {
				id: secondReservationId,
				property_id: propertyId,
				guest_id: secondGuestId,
				room_type_id: roomTypeId,
				check_in_date: new Date("2026-04-01"),
				check_out_date: new Date("2026-04-03"),
				booking_date: new Date("2026-03-16"),
				status: "PENDING",
				source: "DIRECT",
				reservation_type: "TRANSIENT",
				total_amount: 300,
				currency: "USD",
				share_unique_identifier: sharedIdentifier,
			},
		});

		const reservationInsertCalls = queryMock.mock.calls.filter(
			([sql]) => typeof sql === "string" && sql.includes("INSERT INTO reservations"),
		);

		expect(reservationInsertCalls).toHaveLength(2);
		expect(reservationInsertCalls[0]?.[0]).toContain("share_unique_identifier");
		expect(reservationInsertCalls[1]?.[0]).toContain("share_unique_identifier");
		expect(reservationInsertCalls[0]?.[1]).toContain(sharedIdentifier);
		expect(reservationInsertCalls[1]?.[1]).toContain(sharedIdentifier);
		expect(dispatchNotificationCommandMock).not.toHaveBeenCalled();
	});
});
