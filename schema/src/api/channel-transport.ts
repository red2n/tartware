/**
 * DEV DOC
 * Module: api/channel-transport.ts
 * Purpose: Cross-service Channel Transport provider contract — the seam
 *          between "Tartware computed an ARI or content update" and "a
 *          channel manager was actually told about it".
 * Ownership: Schema package
 *
 * Why this lives in `schema/`:
 *   - Provider contracts are required to live in `@tartware/schemas` per
 *     AGENTS.md. `PaymentGateway`, `FiscalDevice` and `AccessControl` are the
 *     siblings.
 *   - reservations-command-service pushes; core-service reads the resulting
 *     `ota_inventory_sync` rows for channel production reporting. A shape
 *     defined in the pusher would be re-derived by the reader.
 *
 * What this file deliberately does NOT declare:
 *   `fetchReservations()` and `ack()`. The inbound path is a separate change,
 *   and `schema/src/api/payment-gateway.ts` is the argument for the omission —
 *   a 245-line provider contract that has sat with zero implementers since it
 *   was written, because it was declared ahead of the code that would use it.
 *   Methods land here when an adapter implements them.
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

import {
	getCurrencyExponent,
	type MoneyInput,
	toMinorUnits,
} from "./currency.js";

// ---------------------------------------------------------------------------
// Which transport a channel is wired to
// ---------------------------------------------------------------------------

/**
 * Closed vocabulary for `ota_configurations.transport`.
 *
 * `NONE` is the default and it refuses a push. That is the point of the column:
 * before it existed, every push recorded `sync_status = 'completed'` with
 * `failed_items = 0` against a transport that did not exist, so an operator
 * reading the sync log could not distinguish a channel that had accepted the
 * rates from one that had never been contacted.
 *
 * `SIMULATED` is still a stub — but a *declared* one. A property has to choose
 * it, and every row it writes is stamped `simulated` in `sync_notes`, so the
 * log says which of the two happened.
 */
export const ChannelTransportKindEnum = z.enum([
	"NONE", // not wired to anything — a push is refused
	"SIMULATED", // explicitly declared stub, for demo and local runs
	"HTTP_JSON", // generic JSON over HTTPS to `ota_configurations.api_endpoint`
]);
export type ChannelTransportKind = z.infer<typeof ChannelTransportKindEnum>;

/** What kind of update is being pushed. Adapters may map each to its own endpoint. */
export const ChannelPushKindEnum = z.enum(["INVENTORY", "RATES", "CONTENT"]);
export type ChannelPushKind = z.infer<typeof ChannelPushKindEnum>;

// ---------------------------------------------------------------------------
// Outcome
// ---------------------------------------------------------------------------

/**
 * What the channel did with the push.
 *
 * `PARTIAL` is a real outcome, not a rounding of failure: channel managers
 * routinely accept 300 of 310 ARI rows and reject the rest on mapping errors,
 * and collapsing that into COMPLETED or FAILED is how a property loses ten
 * days of inventory without a signal.
 */
export const ChannelSyncOutcomeEnum = z.enum([
	"COMPLETED",
	"PARTIAL",
	"FAILED",
]);
export type ChannelSyncOutcome = z.infer<typeof ChannelSyncOutcomeEnum>;

/**
 * `ota_inventory_sync.sync_status` is lowercase and behind a CHECK constraint;
 * this contract is uppercase like every other enum in `schema/`. The mapping
 * lives here so the two vocabularies meet in one place rather than at each
 * INSERT — the divergence that already cost this table three dead partial
 * indexes on `ota_reservations_queue`.
 */
export const CHANNEL_SYNC_STATUS_COLUMN: Record<ChannelSyncOutcome, string> = {
	COMPLETED: "completed",
	PARTIAL: "partial",
	FAILED: "failed",
};

/**
 * `ota_inventory_sync.sync_direction` accepts only 'push' | 'pull' |
 * 'bidirectional'. Every handler wrote the literal `'outbound'`, which the
 * CHECK constraint rejects with 23514 — so all three outbound OTA commands
 * threw on every invocation, and did so retryably, burning the full backoff
 * ladder before the DLQ. Named here so no fourth caller invents a fourth word.
 */
export const CHANNEL_SYNC_DIRECTION_PUSH = "push";

// ---------------------------------------------------------------------------
// Push payloads
// ---------------------------------------------------------------------------

/** One room-type/date cell of availability. */
export const ChannelInventoryItemSchema = z.object({
	room_type_id: uuid,
	/** The channel's own code for this room type, from `channel_mappings`. */
	room_type_code: z.string().min(1).max(100),
	stay_date: z.coerce.date(),
	available: z.number().int(),
	sold: z.number().int().nonnegative(),
	total_rooms: z.number().int().nonnegative(),
});
export type ChannelInventoryItem = z.infer<typeof ChannelInventoryItemSchema>;

/**
 * One rate-plan price to publish.
 *
 * Money is a string for the same reason as `PaymentAmountSchema`: these values
 * are ferried between a REST API and Postgres NUMERIC, and float arithmetic on
 * a rate is how a channel comes to advertise 189.99999999.
 */
export const ChannelRateItemSchema = z.object({
	rate_plan_id: uuid,
	/** The channel's own rate-plan code, from `ota_rate_plans`. */
	ota_rate_code: z.string().min(1).max(100),
	base_rate: z.string(),
	pushed_rate: z.string(),
	currency: z.string().length(3),
});
export type ChannelRateItem = z.infer<typeof ChannelRateItemSchema>;

/** One content element to publish (photos, descriptions, amenities, policies). */
export const ChannelContentItemSchema = z.object({
	content_type: z.string().min(1).max(50),
	reference_id: uuid.optional(),
	language: z.string().min(2).max(10).optional(),
});
export type ChannelContentItem = z.infer<typeof ChannelContentItemSchema>;

/** What every adapter is told about the channel it is pushing to. */
export const ChannelTargetSchema = z.object({
	tenant_id: uuid,
	property_id: uuid,
	ota_config_id: uuid,
	ota_code: z.string().min(1).max(50),
	ota_name: z.string().min(1).max(100),
	/** The property's identifier in the channel's own system. */
	hotel_id: z.string().max(100).nullable(),
	api_endpoint: z.string().max(500).nullable(),
	api_key: z.string().max(500).nullable(),
	api_secret: z.string().max(500).nullable(),
});
export type ChannelTarget = z.infer<typeof ChannelTargetSchema>;

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

/**
 * What an adapter returns. Every field here has a column waiting for it in
 * `ota_inventory_sync` — a 51-column table of which the handlers wrote 14,
 * hardcoding the three that carried the meaning.
 */
export const ChannelTransportResultSchema = z.object({
	outcome: ChannelSyncOutcomeEnum,
	accepted_items: z.number().int().nonnegative(),
	rejected_items: z.number().int().nonnegative(),
	/** The channel's own reference for this batch, when it issues one. */
	channel_reference: z.string().max(150).nullable().default(null),
	http_status: z.number().int().nullable().default(null),
	response_time_ms: z.number().int().nonnegative().nullable().default(null),
	error_code: z.string().max(100).nullable().default(null),
	error_message: z.string().nullable().default(null),
	response_payload: z.record(z.unknown()).nullable().default(null),
	/**
	 * True when no channel was contacted. Recorded in `sync_notes`, so a sync
	 * log can never again read as a successful push that never left the box.
	 */
	simulated: z.boolean(),
});
export type ChannelTransportResult = z.infer<
	typeof ChannelTransportResultSchema
>;

// ---------------------------------------------------------------------------
// Provider interface — the contract every adapter must implement
// ---------------------------------------------------------------------------

/**
 * `ChannelTransport` is the abstraction the OTA command handlers depend on.
 * Concrete adapters live in
 * `Apps/reservations-command-service/src/channels/<kind>.ts` and are selected
 * by `ota_configurations.transport` at runtime.
 *
 * Adapter implementation rules:
 *   1. NEVER throw because the *channel* rejected the push — return
 *      `outcome: "FAILED"` (or `"PARTIAL"`) with `error_code` set. A rejection
 *      is a business outcome and must be recorded, not retried.
 *   2. Throw ONLY on transport failure — timeout, DNS, socket, a response that
 *      is not parseable. Those are the ones a retry can fix, and the consumer's
 *      ladder is what fixes them.
 *   3. Every outbound call carries a deadline. `fetch` with no
 *      `AbortSignal.timeout(...)` fails the `fetch-timeout` guardrail, and a
 *      channel manager that hangs must not hold a Kafka partition open.
 *   4. NEVER perform float arithmetic on a rate. Strings in, strings out.
 */
export interface ChannelTransport {
	readonly kind: ChannelTransportKind;

	/** Publish availability for a date window. */
	pushInventory(
		target: ChannelTarget,
		items: ChannelInventoryItem[],
	): Promise<ChannelTransportResult>;

	/** Publish rate-plan prices. */
	pushRates(
		target: ChannelTarget,
		items: ChannelRateItem[],
	): Promise<ChannelTransportResult>;

	/** Publish property and room-type content. */
	pushContent(
		target: ChannelTarget,
		items: ChannelContentItem[],
	): Promise<ChannelTransportResult>;
}

// ---------------------------------------------------------------------------
// Rate arithmetic
// ---------------------------------------------------------------------------

/**
 * Apply a channel's markup and markdown to a base rate — exactly.
 *
 * The arithmetic is integer throughout: the rate becomes minor units, the two
 * percentages become hundredths of a percent, and the product is divided back
 * down with a half-up round at the end. The code this replaces computed
 * `base * (1 + markup / 100) * (1 - markdown / 100)` in binary floating point
 * and then `Math.round(x * 100) / 100`, which is how a channel comes to
 * advertise 189.99999999 — and, on a boundary value, how it comes to advertise
 * a penny less than the property agreed to.
 *
 * Percentages are read at two decimal places because that is what
 * `ota_rate_plans.markup_percentage` is: `DECIMAL(5,2)`. Passing them through
 * `toMinorUnits` with no currency uses the default exponent of 2, which is the
 * same scale.
 */
export const applyChannelRateAdjustment = (
	baseRate: MoneyInput,
	markupPercent: MoneyInput | null | undefined,
	markdownPercent: MoneyInput | null | undefined,
	currency: string | null | undefined,
): string => {
	const exponent = getCurrencyExponent(currency);
	const base = toMinorUnits(baseRate, currency);

	// One percent = 100 of these, so 100% = 10 000.
	const up = toMinorUnits(markupPercent ?? 0, null);
	const down = toMinorUnits(markdownPercent ?? 0, null);

	const numerator = base * (10_000n + up) * (10_000n - down);
	const denominator = 100_000_000n;

	// Half-up, on the absolute value so a negative adjustment rounds
	// symmetrically rather than toward positive infinity.
	const negative = numerator < 0n;
	const magnitude = negative ? -numerator : numerator;
	const rounded = (magnitude + denominator / 2n) / denominator;

	return formatMinorUnits(negative ? -rounded : rounded, exponent);
};

/** A base rate as the contract's money string, without adjusting it. */
export const formatChannelMoney = (
	amount: MoneyInput,
	currency: string | null | undefined,
): string =>
	formatMinorUnits(toMinorUnits(amount, currency), getCurrencyExponent(currency));

/**
 * Render whole minor units as a fixed-point decimal string.
 *
 * String construction, not `toFixed`: the point of carrying money as minor
 * units is that no binary float ever sees the value, and formatting through a
 * `number` would put one back in at the last step.
 */
const formatMinorUnits = (units: bigint, exponent: number): string => {
	if (exponent === 0) return units.toString();
	const negative = units < 0n;
	const digits = (negative ? -units : units).toString().padStart(exponent + 1, "0");
	const whole = digits.slice(0, digits.length - exponent);
	const fraction = digits.slice(digits.length - exponent);
	return `${negative ? "-" : ""}${whole}.${fraction}`;
};
