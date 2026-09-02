/**
 * DEV DOC
 * Module: api/restrictions.ts
 * Purpose: The one place that decides whether a stay is sellable — booking
 *          restrictions and the sellable ceiling, as a pure function.
 * Ownership: Schema package
 *
 * `rate_calendar` has carried `closed_to_arrival`, `closed_to_departure`,
 * `min_length_of_stay`, `max_length_of_stay`, `min_advance_days`,
 * `max_advance_days` and `rooms_to_sell` since the table was created, and
 * `rate_restrictions` has carried scoped overrides beside it. Nothing read
 * either of them at booking time, so every restriction in the product was
 * decorative.
 *
 * {@link evaluateRestrictions} is that missing evaluator. It takes no database
 * handle: callers load the rules for the stay window and pass them in, which
 * is what lets `createReservation`, `modifyReservation` and the availability
 * search all reach the same verdict instead of three near-identical ones.
 *
 * It returns typed refusals rather than a boolean, because "you cannot book
 * this" is not a useful thing to show a guest — "this rate needs a minimum of
 * 3 nights and you asked for 2" is.
 */

import { z } from "zod";

/**
 * What a restriction applies to.
 *
 * Ordered least to most specific; {@link evaluateRestrictions} resolves a
 * conflict by taking the most specific scope that has a rule for that date and
 * type. A property-wide minimum must not override a rate that deliberately
 * relaxes it.
 */
export const RestrictionScopeEnum = z.enum([
	"PROPERTY",
	"ROOM_TYPE",
	"RATE",
	"CHANNEL",
]);

export type RestrictionScope = z.infer<typeof RestrictionScopeEnum>;

/** Precedence of each scope. Higher wins. */
const SCOPE_PRECEDENCE: Record<RestrictionScope, number> = {
	PROPERTY: 0,
	ROOM_TYPE: 1,
	RATE: 2,
	CHANNEL: 3,
};

/**
 * The kinds of restriction that can be stored. Mirrors the
 * `rate_restrictions.restriction_type` check constraint.
 */
export const RestrictionTypeEnum = z.enum([
	"CTA",
	"CTD",
	"MIN_LOS",
	"MAX_LOS",
	"MIN_ADVANCE",
	"MAX_ADVANCE",
	"CLOSED",
	"SELL_LIMIT",
]);

export type RestrictionType = z.infer<typeof RestrictionTypeEnum>;

/**
 * Machine-readable refusal reasons. A UI branches on these; they are also the
 * `code` a command error carries, so a channel partner sees the same value the
 * front desk does.
 */
export const RestrictionRefusalCodeEnum = z.enum([
	"RESTRICTION_CTA",
	"RESTRICTION_CTD",
	"RESTRICTION_CLOSED",
	"RESTRICTION_MIN_LOS",
	"RESTRICTION_MAX_LOS",
	"RESTRICTION_ADVANCE",
	"RESTRICTION_SELL_LIMIT",
]);

export type RestrictionRefusalCode = z.infer<typeof RestrictionRefusalCodeEnum>;

const REFUSAL_BY_TYPE: Record<RestrictionType, RestrictionRefusalCode> = {
	CTA: "RESTRICTION_CTA",
	CTD: "RESTRICTION_CTD",
	CLOSED: "RESTRICTION_CLOSED",
	MIN_LOS: "RESTRICTION_MIN_LOS",
	MAX_LOS: "RESTRICTION_MAX_LOS",
	MIN_ADVANCE: "RESTRICTION_ADVANCE",
	MAX_ADVANCE: "RESTRICTION_ADVANCE",
	SELL_LIMIT: "RESTRICTION_SELL_LIMIT",
};

/**
 * One restriction row, normalised out of whichever table it came from —
 * `rate_calendar`'s columns and `rate_restrictions`' rows both land here.
 */
export const RestrictionRuleSchema = z.object({
	scope: RestrictionScopeEnum,
	restriction_type: RestrictionTypeEnum,
	/** The night the rule governs. */
	stay_date: z.coerce.date(),
	/**
	 * The threshold, for the types that have one (LOS, advance, sell limit).
	 * CTA, CTD and CLOSED are flags and ignore it.
	 */
	value: z.number().int().nonnegative().optional(),
	/** Where the rule came from, carried through to the refusal for support. */
	source: z.string().optional(),
});

export type RestrictionRule = z.infer<typeof RestrictionRuleSchema>;

/** Sellable inventory for one night, from `rate_calendar`. */
export const NightInventorySchema = z.object({
	stay_date: z.coerce.date(),
	/** NULL = no ceiling published for this night; physical inventory applies. */
	rooms_to_sell: z.number().int().nonnegative().nullable(),
	rooms_sold: z.number().int().nonnegative(),
});

export type NightInventory = z.infer<typeof NightInventorySchema>;

/** The stay being tested. */
export const StayRestrictionQuerySchema = z.object({
	arrival: z.coerce.date(),
	departure: z.coerce.date(),
	/**
	 * The property's business date, which is what advance windows are measured
	 * from. Not `new Date()`: a booking taken at 01:00 on a property whose
	 * business date has not rolled is still "today" for restriction purposes.
	 */
	booking_date: z.coerce.date(),
	/** Rooms wanted, for the sell-limit check. A 3-room booking needs 3. */
	rooms_requested: z.number().int().positive().default(1),
});

export type StayRestrictionQuery = z.infer<typeof StayRestrictionQuerySchema>;

/** A single reason the stay was refused. */
export const RestrictionRefusalSchema = z.object({
	code: RestrictionRefusalCodeEnum,
	restriction_type: RestrictionTypeEnum,
	scope: RestrictionScopeEnum,
	/** The night that failed, `YYYY-MM-DD`. */
	stay_date: z.string(),
	/** The threshold the rule set, where it has one. */
	required: z.number().optional(),
	/** What the request actually asked for, against that threshold. */
	actual: z.number().optional(),
	source: z.string().optional(),
	/** Human-readable, safe to show a guest. */
	message: z.string(),
});

export type RestrictionRefusal = z.infer<typeof RestrictionRefusalSchema>;

/** The verdict. `refusals` is empty exactly when `allowed` is true. */
export interface RestrictionEvaluation {
	allowed: boolean;
	refusals: RestrictionRefusal[];
}

const DAY_MS = 86_400_000;

/** UTC midnight, so date arithmetic never crosses a DST edge. */
const toUtcDay = (value: Date): Date =>
	new Date(
		Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
	);

const dayKey = (value: Date): string =>
	toUtcDay(value).toISOString().slice(0, 10);

const daysBetween = (from: Date, to: Date): number =>
	Math.round((toUtcDay(to).getTime() - toUtcDay(from).getTime()) / DAY_MS);

/**
 * Nights of a stay: arrival through the night before departure. A 3-night stay
 * arriving on the 10th occupies the 10th, 11th and 12th.
 */
const stayNights = (arrival: Date, departure: Date): Date[] => {
	const start = toUtcDay(arrival);
	const count = daysBetween(arrival, departure);
	return Array.from(
		{ length: Math.max(0, count) },
		(_, offset) => new Date(start.getTime() + offset * DAY_MS),
	);
};

/**
 * The rule that actually applies for a given date and type: the most specific
 * scope present. Ties are impossible — one rule per scope per date per type.
 */
const winningRule = (
	rules: readonly RestrictionRule[],
	stayDate: Date,
	type: RestrictionType,
): RestrictionRule | undefined => {
	const key = dayKey(stayDate);
	let winner: RestrictionRule | undefined;
	for (const rule of rules) {
		if (rule.restriction_type !== type) continue;
		if (dayKey(rule.stay_date) !== key) continue;
		if (
			!winner ||
			SCOPE_PRECEDENCE[rule.scope] > SCOPE_PRECEDENCE[winner.scope]
		) {
			winner = rule;
		}
	}
	return winner;
};

const refuse = (
	rule: RestrictionRule,
	stayDate: Date,
	message: string,
	actual?: number,
): RestrictionRefusal => ({
	code: REFUSAL_BY_TYPE[rule.restriction_type],
	restriction_type: rule.restriction_type,
	scope: rule.scope,
	stay_date: dayKey(stayDate),
	...(rule.value !== undefined ? { required: rule.value } : {}),
	...(actual !== undefined ? { actual } : {}),
	...(rule.source ? { source: rule.source } : {}),
	message,
});

/**
 * Decide whether a stay may be sold.
 *
 * Semantics follow the industry convention rather than anything invented here:
 *
 * - **CTA** blocks arrival on that date; it says nothing about staying through
 *   it, so it is only ever tested against the arrival night.
 * - **CTD** blocks departure on that date, so it is tested against the
 *   departure date — which is *not* one of the stay's nights.
 * - **CLOSED** blocks any night of the stay.
 * - **MIN_LOS / MAX_LOS** are evaluated at the arrival night. A rule on a later
 *   night does not retroactively lengthen a stay that has already started.
 * - **MIN_ADVANCE / MAX_ADVANCE** compare the arrival against the booking date.
 * - **SELL_LIMIT**, and `rooms_to_sell` from the rate calendar, cap how many
 *   rooms may be held for each night — `rooms_sold + rooms_requested` must fit.
 *   A night with no published ceiling is unconstrained here; physical
 *   inventory is the availability guard's job, not this function's.
 *
 * Every applicable rule is tested, so the caller gets the full list rather than
 * the first failure — a two-night booking that breaks min-LOS *and* is closed
 * to arrival should say both.
 *
 * @param query the stay being tested
 * @param rules every restriction covering the stay window, any scope
 * @param inventory published sellable inventory per night; may be empty
 */
export const evaluateRestrictions = (
	query: StayRestrictionQuery,
	rules: readonly RestrictionRule[],
	inventory: readonly NightInventory[] = [],
): RestrictionEvaluation => {
	const refusals: RestrictionRefusal[] = [];
	const arrival = toUtcDay(query.arrival);
	const departure = toUtcDay(query.departure);
	const nights = stayNights(arrival, departure);
	const lengthOfStay = nights.length;
	const roomsRequested = query.rooms_requested ?? 1;

	if (lengthOfStay < 1) {
		return { allowed: true, refusals: [] };
	}

	// ─── Arrival-night rules ────────────────────────────────────────────────
	const cta = winningRule(rules, arrival, "CTA");
	if (cta) {
		refusals.push(
			refuse(cta, arrival, `Arrival on ${dayKey(arrival)} is not permitted.`),
		);
	}

	const minLos = winningRule(rules, arrival, "MIN_LOS");
	if (minLos?.value !== undefined && lengthOfStay < minLos.value) {
		refusals.push(
			refuse(
				minLos,
				arrival,
				`A minimum stay of ${minLos.value} night${minLos.value === 1 ? "" : "s"} applies from ${dayKey(arrival)}; ${lengthOfStay} requested.`,
				lengthOfStay,
			),
		);
	}

	const maxLos = winningRule(rules, arrival, "MAX_LOS");
	if (maxLos?.value !== undefined && lengthOfStay > maxLos.value) {
		refusals.push(
			refuse(
				maxLos,
				arrival,
				`A maximum stay of ${maxLos.value} night${maxLos.value === 1 ? "" : "s"} applies from ${dayKey(arrival)}; ${lengthOfStay} requested.`,
				lengthOfStay,
			),
		);
	}

	const daysAhead = daysBetween(query.booking_date, arrival);

	const minAdvance = winningRule(rules, arrival, "MIN_ADVANCE");
	if (minAdvance?.value !== undefined && daysAhead < minAdvance.value) {
		refusals.push(
			refuse(
				minAdvance,
				arrival,
				`This stay must be booked at least ${minAdvance.value} day${minAdvance.value === 1 ? "" : "s"} ahead; ${daysAhead} given.`,
				daysAhead,
			),
		);
	}

	const maxAdvance = winningRule(rules, arrival, "MAX_ADVANCE");
	if (maxAdvance?.value !== undefined && daysAhead > maxAdvance.value) {
		refusals.push(
			refuse(
				maxAdvance,
				arrival,
				`This stay cannot be booked more than ${maxAdvance.value} day${maxAdvance.value === 1 ? "" : "s"} ahead; ${daysAhead} given.`,
				daysAhead,
			),
		);
	}

	// ─── Departure-date rule ────────────────────────────────────────────────
	const ctd = winningRule(rules, departure, "CTD");
	if (ctd) {
		refusals.push(
			refuse(
				ctd,
				departure,
				`Departure on ${dayKey(departure)} is not permitted.`,
			),
		);
	}

	// ─── Per-night rules ────────────────────────────────────────────────────
	const inventoryByDate = new Map(
		inventory.map((night) => [dayKey(night.stay_date), night]),
	);

	for (const night of nights) {
		const closed = winningRule(rules, night, "CLOSED");
		if (closed) {
			refusals.push(
				refuse(closed, night, `${dayKey(night)} is closed for sale.`),
			);
		}

		const sellLimit = winningRule(rules, night, "SELL_LIMIT");
		const published = inventoryByDate.get(dayKey(night));
		const sold = published?.rooms_sold ?? 0;

		if (
			sellLimit?.value !== undefined &&
			sold + roomsRequested > sellLimit.value
		) {
			refusals.push(
				refuse(
					sellLimit,
					night,
					`Only ${Math.max(0, sellLimit.value - sold)} room${sellLimit.value - sold === 1 ? "" : "s"} may still be sold for ${dayKey(night)}; ${roomsRequested} requested.`,
					sold + roomsRequested,
				),
			);
			continue;
		}

		// The rate calendar's own ceiling, when no scoped sell limit overrode it.
		if (
			published &&
			published.rooms_to_sell !== null &&
			sold + roomsRequested > published.rooms_to_sell
		) {
			refusals.push({
				code: "RESTRICTION_SELL_LIMIT",
				restriction_type: "SELL_LIMIT",
				scope: "ROOM_TYPE",
				stay_date: dayKey(night),
				required: published.rooms_to_sell,
				actual: sold + roomsRequested,
				source: "rate_calendar",
				message: `Only ${Math.max(0, published.rooms_to_sell - sold)} room${published.rooms_to_sell - sold === 1 ? "" : "s"} remain sellable for ${dayKey(night)}; ${roomsRequested} requested.`,
			});
		}
	}

	return { allowed: refusals.length === 0, refusals };
};

/**
 * One line summarising a refusal set, for a log or an error message. The
 * structured `refusals` array is what a UI should render.
 */
export const describeRefusals = (
	refusals: readonly RestrictionRefusal[],
): string => refusals.map((refusal) => refusal.message).join(" ");

// =====================================================
// ROW NORMALISATION
// =====================================================

/**
 * A `rate_restrictions` row as every caller selects it.
 *
 * The SQL differs by caller — the booking path asks about one room type, the
 * availability search asks about all of them in one round trip — but the
 * columns and their meaning do not, so the mapping into a rule lives here
 * rather than being written out once per service.
 */
export interface RestrictionRowLike {
	scope: string;
	restriction_type: string;
	restriction_date: Date | string;
	restriction_value: number | string | null;
	source?: string | null;
}

/** A `rate_calendar` row, aggregated per stay date. */
export interface RateCalendarRowLike {
	stay_date: Date | string;
	status?: string | null;
	closed_to_arrival?: boolean | null;
	closed_to_departure?: boolean | null;
	min_length_of_stay?: number | string | null;
	max_length_of_stay?: number | string | null;
	min_advance_days?: number | string | null;
	max_advance_days?: number | string | null;
	rooms_to_sell?: number | string | null;
	rooms_sold?: number | string | null;
}

const asScope = (value: string): RestrictionScope => {
	const parsed = RestrictionScopeEnum.safeParse(value);
	return parsed.success ? parsed.data : "PROPERTY";
};

const asType = (value: string): RestrictionType | null => {
	const parsed = RestrictionTypeEnum.safeParse(value);
	return parsed.success ? parsed.data : null;
};

const asNumber = (
	value: number | string | null | undefined,
): number | undefined =>
	value === null || value === undefined ? undefined : Number(value);

/** Turn `rate_restrictions` rows into rules. Unknown types are dropped. */
export const restrictionRowsToRules = (
	rows: readonly RestrictionRowLike[],
): RestrictionRule[] => {
	const rules: RestrictionRule[] = [];
	for (const row of rows) {
		const restrictionType = asType(row.restriction_type);
		if (!restrictionType) continue;
		rules.push({
			scope: asScope(row.scope),
			restriction_type: restrictionType,
			stay_date: new Date(row.restriction_date),
			value: asNumber(row.restriction_value),
			source: row.source ?? "rate_restrictions",
		});
	}
	return rules;
};

/**
 * Turn a `rate_calendar` row's columns into rules.
 *
 * These are rate-scoped by the table's own key, so they are only meaningful
 * once a rate has been resolved — pass `includeRateControls: false` when the
 * caller has no rate, or one rate plan's stop-sell would block a booking made
 * on another. Inventory is returned either way, since `rooms_sold` describes
 * the room type's night rather than the rate it was sold at.
 */
export const calendarRowsToRules = (
	rows: readonly RateCalendarRowLike[],
	includeRateControls: boolean,
): { rules: RestrictionRule[]; inventory: NightInventory[] } => {
	const rules: RestrictionRule[] = [];
	const inventory: NightInventory[] = [];
	const scope: RestrictionScope = "RATE";
	const source = "rate_calendar";

	for (const row of rows) {
		const stayDate = new Date(row.stay_date);
		const roomsToSell = asNumber(row.rooms_to_sell);

		inventory.push({
			stay_date: stayDate,
			rooms_to_sell: roomsToSell === undefined ? null : roomsToSell,
			rooms_sold: asNumber(row.rooms_sold) ?? 0,
		});

		if (!includeRateControls) continue;

		if (row.status && row.status !== "OPEN") {
			rules.push({
				scope,
				restriction_type: "CLOSED",
				stay_date: stayDate,
				source,
			});
		}
		if (row.closed_to_arrival) {
			rules.push({
				scope,
				restriction_type: "CTA",
				stay_date: stayDate,
				source,
			});
		}
		if (row.closed_to_departure) {
			rules.push({
				scope,
				restriction_type: "CTD",
				stay_date: stayDate,
				source,
			});
		}

		const thresholds: [RestrictionType, number | undefined][] = [
			["MIN_LOS", asNumber(row.min_length_of_stay)],
			["MAX_LOS", asNumber(row.max_length_of_stay)],
			["MIN_ADVANCE", asNumber(row.min_advance_days)],
			["MAX_ADVANCE", asNumber(row.max_advance_days)],
		];
		for (const [restrictionType, value] of thresholds) {
			if (value === undefined) continue;
			rules.push({
				scope,
				restriction_type: restrictionType,
				stay_date: stayDate,
				value,
				source,
			});
		}
	}

	return { rules, inventory };
};
