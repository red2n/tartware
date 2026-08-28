/**
 * DEV DOC
 * Module: api/stay-plan.ts
 * Purpose: The wire shape of a multi-room, per-night stay, plus the expansion
 *          that turns a caller's sparse request into the exact rows
 *          `reservation_rooms` / `reservation_nights` / `reservation_occupants`
 *          need.
 * Ownership: Schema package
 *
 * A reservation used to be one room at one flat rate: `reservations.room_id`
 * plus `reservations.room_rate`. That shape cannot express a booking of three
 * rooms, a rate that changes on night 3, or a mid-stay room change. The stay
 * plan is the replacement — one entry per room, each carrying its own nights.
 *
 * The command, the `reservation.created` event and the event handler all speak
 * this one shape, and {@link expandStayPlan} is the single place that decides
 * what an omitted field means. Callers that send nothing keep the old
 * behaviour: one room, every night of the stay window priced at an even split
 * of `total_amount`.
 */

import { z } from "zod";

/** Nightly rate rows are written to a DECIMAL(15,2) column. */
const CENTS = 100;

const RateCodeSchema = z
	.string()
	.min(2)
	.max(50)
	.regex(/^[A-Z0-9_-]+$/i, "Rate code must be alphanumeric with - or _");

/**
 * Occupancy class of a named occupant. Mirrors
 * `reservation_occupants.occupant_type`.
 */
export const StayOccupantTypeEnum = z.enum(["ADULT", "CHILD", "INFANT"]);

export type StayOccupantType = z.infer<typeof StayOccupantTypeEnum>;

/**
 * One priced night of one room, as supplied by a caller. Omit the array
 * entirely and every night of the stay window is derived instead.
 */
export const StayNightInputSchema = z.object({
	/** The night slept — never the departure date. */
	stay_date: z.coerce.date(),
	rate_amount: z.coerce.number().nonnegative(),
	rate_id: z.string().uuid().optional(),
	rate_code: RateCodeSchema.optional(),
	currency: z.string().length(3).optional(),
	adults: z.number().int().nonnegative().optional(),
	children: z.number().int().nonnegative().optional(),
	is_complimentary: z.boolean().optional(),
	is_rate_override: z.boolean().optional(),
	rate_override_reason: z.string().max(500).optional(),
});

export type StayNightInput = z.infer<typeof StayNightInputSchema>;

/** A named person sleeping in a room. */
export const StayOccupantInputSchema = z.object({
	guest_id: z.string().uuid().optional(),
	full_name: z.string().min(1).max(255),
	occupant_type: StayOccupantTypeEnum.optional(),
	age: z.number().int().nonnegative().max(129).optional(),
	email: z.string().email().max(255).optional(),
	phone: z.string().max(20).optional(),
	is_primary: z.boolean().optional(),
});

export type StayOccupantInput = z.infer<typeof StayOccupantInputSchema>;

/**
 * One room held by a reservation. Every field is optional: an entry of `{}` is
 * a valid request for "another room of the reservation's own type, for the
 * reservation's own dates and occupancy".
 */
export const StayRoomInputSchema = z.object({
	reservation_room_id: z.string().uuid().optional(),
	/** 1-based; assigned in array order when omitted. */
	room_sequence: z.number().int().positive().optional(),
	room_type_id: z.string().uuid().optional(),
	room_id: z.string().uuid().optional(),
	room_number: z.string().max(50).optional(),
	/** Primary occupant of this room; defaults to the booker. */
	guest_id: z.string().uuid().optional(),
	adults: z.number().int().nonnegative().optional(),
	children: z.number().int().nonnegative().optional(),
	infants: z.number().int().nonnegative().optional(),
	do_not_move: z.boolean().optional(),
	rate_code: RateCodeSchema.optional(),
	rate_id: z.string().uuid().optional(),
	/** Per-night prices. Omitted → derived across the whole stay window. */
	nights: z.array(StayNightInputSchema).optional(),
	occupants: z.array(StayOccupantInputSchema).optional(),
});

export type StayRoomInput = z.infer<typeof StayRoomInputSchema>;

/** The `rooms` array as it travels on a command or an event. */
export const StayPlanInputSchema = z.array(StayRoomInputSchema).min(1).max(50);

export type StayPlanInput = z.infer<typeof StayPlanInputSchema>;

/**
 * Refusal from {@link expandStayPlan}. `code` is the machine-readable reason a
 * caller (or the UI) can branch on; services map it onto their own command
 * error type rather than leaking this class outward.
 */
export class StayPlanError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "StayPlanError";
		this.code = code;
	}
}

/** Reservation-level values a room falls back to when it omits its own. */
export interface StayPlanDefaults {
	check_in_date: Date;
	check_out_date: Date;
	room_type_id: string;
	guest_id?: string;
	adults?: number;
	children?: number;
	infants?: number;
	currency: string;
	rate_id?: string;
	rate_code?: string;
	/** Split evenly across all room-nights that do not price themselves. */
	total_amount?: number;
}

/** A night after expansion — every field the insert needs is present. */
export interface ResolvedStayNight {
	stay_date: Date;
	rate_amount: number;
	rate_id?: string;
	rate_code?: string;
	currency: string;
	adults: number;
	children: number;
	is_complimentary: boolean;
	is_rate_override: boolean;
	rate_override_reason?: string;
}

/** A room after expansion. */
export interface ResolvedStayRoom {
	reservation_room_id?: string;
	room_sequence: number;
	room_type_id: string;
	room_id?: string;
	room_number?: string;
	guest_id?: string;
	adults: number;
	children: number;
	infants: number;
	do_not_move: boolean;
	check_in_date: Date;
	check_out_date: Date;
	total_amount: number;
	nights: ResolvedStayNight[];
	occupants: StayOccupantInput[];
}

/** The whole stay after expansion. */
export interface ResolvedStayPlan {
	rooms: ResolvedStayRoom[];
	check_in_date: Date;
	check_out_date: Date;
	total_amount: number;
}

/** UTC midnight of a date, so date arithmetic never crosses a DST edge. */
const toUtcDay = (value: Date): Date =>
	new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);

const addDays = (value: Date, days: number): Date =>
	new Date(value.getTime() + days * 86_400_000);

const dayKey = (value: Date): string =>
	toUtcDay(value).toISOString().slice(0, 10);

const nightCount = (start: Date, end: Date): number =>
	Math.round(
		(toUtcDay(end).getTime() - toUtcDay(start).getTime()) / 86_400_000,
	);

const round2 = (value: number): number => Math.round(value * CENTS) / CENTS;

/**
 * Split an amount across n slots in whole cents, so the parts always sum back
 * to the original. The remainder lands on the earliest nights — the same
 * convention the folio uses, so a stay's nightly rows add up to the quoted
 * total with no rounding drift.
 */
const splitEvenly = (total: number, slots: number): number[] => {
	if (slots <= 0) {
		return [];
	}
	const totalCents = Math.round(total * CENTS);
	const base = Math.floor(totalCents / slots);
	let remainder = totalCents - base * slots;
	return Array.from({ length: slots }, () => {
		const cents = base + (remainder > 0 ? 1 : 0);
		if (remainder > 0) {
			remainder -= 1;
		}
		return cents / CENTS;
	});
};

/**
 * Turn a caller's sparse `rooms` request into the exact rows the stay tables
 * need, filling every omitted field from the reservation-level defaults.
 *
 * With no `rooms` at all this yields the pre-multi-room behaviour: a single
 * room covering the whole window, priced at an even split of `total_amount`.
 *
 * @throws {StayPlanError} `INVALID_DATES` when the window is not at least one
 *   night, `INVALID_STAY_NIGHT` when a supplied night falls outside the
 *   window, `DUPLICATE_STAY_NIGHT` when two nights of one room share a date.
 */
export const expandStayPlan = (
	defaults: StayPlanDefaults,
	rooms?: StayRoomInput[],
): ResolvedStayPlan => {
	const stayStart = toUtcDay(defaults.check_in_date);
	const stayEnd = toUtcDay(defaults.check_out_date);
	const windowNights = nightCount(stayStart, stayEnd);

	if (windowNights < 1) {
		throw new StayPlanError(
			"INVALID_DATES",
			"check_out_date must be at least one night after check_in_date",
		);
	}

	const requested: StayRoomInput[] = rooms && rooms.length > 0 ? rooms : [{}];

	// Rooms that priced themselves keep their prices; total_amount is shared
	// out over the room-nights that did not, so a caller can price one room by
	// hand and let the rest fall out of the quoted total.
	const derivedNightSlots = requested.reduce(
		(sum, room) =>
			sum + (room.nights && room.nights.length > 0 ? 0 : windowNights),
		0,
	);
	const pricedTotal = requested.reduce(
		(sum, room) =>
			sum +
			(room.nights ?? []).reduce(
				(nightSum, night) => nightSum + night.rate_amount,
				0,
			),
		0,
	);
	const remainingTotal = Math.max(
		0,
		round2((defaults.total_amount ?? 0) - pricedTotal),
	);
	const derivedAmounts = splitEvenly(remainingTotal, derivedNightSlots);
	let derivedCursor = 0;

	const resolvedRooms = requested.map((room, index) => {
		const adults = room.adults ?? defaults.adults ?? 1;
		const children = room.children ?? defaults.children ?? 0;
		const infants = room.infants ?? defaults.infants ?? 0;
		const rateId = room.rate_id ?? defaults.rate_id;
		const rateCode = room.rate_code ?? defaults.rate_code;

		const nights: ResolvedStayNight[] =
			room.nights && room.nights.length > 0
				? room.nights.map((night) => {
						const stayDate = toUtcDay(night.stay_date);
						if (stayDate < stayStart || stayDate >= stayEnd) {
							throw new StayPlanError(
								"INVALID_STAY_NIGHT",
								`Night ${dayKey(stayDate)} falls outside the stay ${dayKey(stayStart)}..${dayKey(stayEnd)}`,
							);
						}
						return {
							stay_date: stayDate,
							rate_amount: round2(night.rate_amount),
							rate_id: night.rate_id ?? rateId,
							rate_code: night.rate_code ?? rateCode,
							currency: (night.currency ?? defaults.currency).toUpperCase(),
							adults: night.adults ?? adults,
							children: night.children ?? children,
							is_complimentary: night.is_complimentary ?? false,
							is_rate_override: night.is_rate_override ?? false,
							rate_override_reason: night.rate_override_reason,
						};
					})
				: Array.from({ length: windowNights }, (_, offset) => ({
						stay_date: addDays(stayStart, offset),
						rate_amount: derivedAmounts[derivedCursor++] ?? 0,
						rate_id: rateId,
						rate_code: rateCode,
						currency: defaults.currency.toUpperCase(),
						adults,
						children,
						is_complimentary: false,
						is_rate_override: false,
						rate_override_reason: undefined,
					}));

		const seen = new Set<string>();
		for (const night of nights) {
			const key = dayKey(night.stay_date);
			if (seen.has(key)) {
				throw new StayPlanError(
					"DUPLICATE_STAY_NIGHT",
					`Room ${index + 1} prices ${key} more than once`,
				);
			}
			seen.add(key);
		}
		nights.sort((a, b) => a.stay_date.getTime() - b.stay_date.getTime());

		const first = nights[0];
		const last = nights[nights.length - 1];
		if (!first || !last) {
			throw new StayPlanError(
				"EMPTY_STAY_ROOM",
				`Room ${index + 1} has no nights`,
			);
		}

		return {
			reservation_room_id: room.reservation_room_id,
			room_sequence: room.room_sequence ?? index + 1,
			room_type_id: room.room_type_id ?? defaults.room_type_id,
			room_id: room.room_id,
			room_number: room.room_number,
			guest_id: room.guest_id ?? defaults.guest_id,
			adults,
			children,
			infants,
			do_not_move: room.do_not_move ?? false,
			check_in_date: first.stay_date,
			check_out_date: addDays(last.stay_date, 1),
			total_amount: round2(
				nights.reduce((sum, night) => sum + night.rate_amount, 0),
			),
			nights,
			occupants: room.occupants ?? [],
		} satisfies ResolvedStayRoom;
	});

	const sequences = new Set<number>();
	for (const room of resolvedRooms) {
		if (sequences.has(room.room_sequence)) {
			throw new StayPlanError(
				"DUPLICATE_ROOM_SEQUENCE",
				`room_sequence ${room.room_sequence} appears more than once`,
			);
		}
		sequences.add(room.room_sequence);
	}

	return {
		rooms: resolvedRooms,
		check_in_date: stayStart,
		check_out_date: stayEnd,
		total_amount: round2(
			resolvedRooms.reduce((sum, room) => sum + room.total_amount, 0),
		),
	};
};

/** Total room revenue of an expanded plan, excluding comped nights. */
export const chargeableStayTotal = (plan: ResolvedStayPlan): number =>
	round2(
		plan.rooms.reduce(
			(sum, room) =>
				sum +
				room.nights.reduce(
					(nightSum, night) =>
						nightSum + (night.is_complimentary ? 0 : night.rate_amount),
					0,
				),
			0,
		),
	);
