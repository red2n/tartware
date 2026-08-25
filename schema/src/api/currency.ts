/**
 * DEV DOC
 * Module: api/currency.ts
 * Purpose: ISO 4217 minor-unit (exponent) reference data and the money-rounding
 *          helpers that depend on it. Single source of truth for "how many
 *          decimal places does this currency actually have".
 * Ownership: Schema package
 *
 * Money cannot be rounded to a fixed 2 decimal places. ISO 4217 defines a
 * per-currency exponent: JPY and KRW have none, most currencies have 2, and the
 * Gulf currencies (KWD, BHD, OMR, JOD, TND) have 3. Rounding ¥14,925.37 to two
 * places invents a fraction of a yen that cannot be tendered, and truncating
 * 30.675 KWD to 30.68 loses a real, spendable unit.
 *
 * Anything that persists a monetary amount in a known currency must round
 * through `roundToCurrency` rather than a literal `* 100 / 100`.
 */

import { z } from "zod";

/**
 * Strict ISO 4217 alphabetic currency code — uppercase only, no normalisation.
 *
 * Deliberately stricter than the tolerant `currencyCode` in `shared/base-schemas`,
 * which upper-cases its input. Routes that expose this through OpenAPI validate
 * twice: Fastify checks the generated JSON Schema before any Zod transform runs,
 * so a schema that normalises would accept `"usd"` at one layer and reject it at
 * the other. Requiring uppercase keeps both layers in agreement.
 */
export const CurrencyCodeSchema = z
	.string()
	.length(3)
	.regex(/^[A-Z]{3}$/, "Currency must be a 3-letter uppercase ISO 4217 code");

/**
 * Currencies whose exponent is not the default 2.
 *
 * Kept as an exception list rather than a full ISO 4217 table: the default of 2
 * is correct for the overwhelming majority, so only the deviations need to be
 * maintained, and an unlisted currency degrades to the common case instead of
 * failing.
 */
const CURRENCY_EXPONENT_OVERRIDES: Readonly<Record<string, number>> =
	Object.freeze({
		// Zero-decimal currencies — the major unit is the smallest unit.
		BIF: 0,
		CLP: 0,
		DJF: 0,
		GNF: 0,
		ISK: 0,
		JPY: 0,
		KMF: 0,
		KRW: 0,
		PYG: 0,
		RWF: 0,
		UGX: 0,
		UYI: 0,
		VND: 0,
		VUV: 0,
		XAF: 0,
		XOF: 0,
		XPF: 0,
		// Three-decimal currencies — 1000 fils/millimes to the major unit.
		BHD: 3,
		IQD: 3,
		JOD: 3,
		KWD: 3,
		LYD: 3,
		OMR: 3,
		TND: 3,
		// Four-decimal currencies (funds/clearing rates).
		CLF: 4,
		UYW: 4,
	});

/** Exponent assumed for any currency not in the override table. */
export const DEFAULT_CURRENCY_EXPONENT = 2;

/**
 * The widest exponent this system stores. Monetary columns that may hold a
 * converted amount are provisioned to this scale so a 3-decimal currency is not
 * silently truncated on write.
 */
export const MAX_CURRENCY_EXPONENT = 4;

/**
 * Number of decimal places a currency is denominated in (ISO 4217 exponent).
 *
 * @param currency ISO 4217 alphabetic code; case-insensitive, whitespace tolerated
 *                 (the DB stores `CHAR(3)`, which pads).
 * @returns The exponent, or {@link DEFAULT_CURRENCY_EXPONENT} for unknown codes.
 */
export const getCurrencyExponent = (
	currency: string | null | undefined,
): number => {
	if (!currency) return DEFAULT_CURRENCY_EXPONENT;
	const code = currency.trim().toUpperCase();
	return CURRENCY_EXPONENT_OVERRIDES[code] ?? DEFAULT_CURRENCY_EXPONENT;
};

/**
 * A decimal number held exactly as an integer significand and a scale, so that
 * `value = digits / 10^scale`. Money never touches binary floating point here.
 */
type ExactDecimal = { digits: bigint; scale: number };

/** Accepted representations of a monetary quantity. */
export type MoneyInput = number | string;

/**
 * Parse a value into an exact decimal without going through binary floating
 * point arithmetic.
 *
 * `number` inputs are read via their shortest round-trip decimal form
 * (`String(n)`), which is exactly the decimal literal the value came from.
 * `string` inputs are the important case: PostgreSQL returns NUMERIC columns as
 * strings precisely so no precision is lost in transit, and passing them
 * straight through preserves that guarantee.
 *
 * Returns `null` for anything non-finite or unparseable, so callers can decide
 * on a fallback rather than silently receiving a wrong number.
 */
const toExactDecimal = (value: MoneyInput): ExactDecimal | null => {
	if (typeof value === "number" && !Number.isFinite(value)) return null;

	const text = typeof value === "string" ? value.trim() : String(value);
	if (text === "") return null;

	const match = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
	if (!match) return null;

	const [, sign, intPart = "", fracPart = "", expPart] = match;
	if (intPart === "" && fracPart === "") return null;

	let digits = BigInt(`${intPart}${fracPart}` || "0");
	let scale = fracPart.length;

	// Normalise exponent notation (1.5e-7) into the significand/scale form.
	const exponent = expPart ? Number.parseInt(expPart, 10) : 0;
	if (exponent > 0) {
		digits *= 10n ** BigInt(exponent);
	} else if (exponent < 0) {
		scale += -exponent;
	}

	if (sign === "-") digits = -digits;
	return { digits, scale };
};

/** Rescale an exact decimal to `targetScale`, rounding half away from zero. */
const rescale = (
	{ digits, scale }: ExactDecimal,
	targetScale: number,
): bigint => {
	if (scale === targetScale) return digits;

	if (scale < targetScale) {
		return digits * 10n ** BigInt(targetScale - scale);
	}

	const divisor = 10n ** BigInt(scale - targetScale);
	const negative = digits < 0n;
	const magnitude = negative ? -digits : digits;

	const quotient = magnitude / divisor;
	const remainder = magnitude % divisor;

	// Half away from zero: the tie goes to the larger magnitude in both
	// directions, so a refund of -2.005 rounds to -2.01 exactly as a charge of
	// 2.005 rounds to 2.01. Rounding half-up on the signed value instead would
	// bias every credit one minor unit toward zero.
	const rounded = remainder * 2n >= divisor ? quotient + 1n : quotient;
	return negative ? -rounded : rounded;
};

/** Render an integer significand at `scale` back to a JS number. */
const fromMinorUnits = (units: bigint, scale: number): number =>
	scale === 0
		? Number(units)
		: Number(`${units < 0n ? "-" : ""}${formatMagnitude(units, scale)}`);

const formatMagnitude = (units: bigint, scale: number): string => {
	const text = (units < 0n ? -units : units)
		.toString()
		.padStart(scale + 1, "0");
	return `${text.slice(0, text.length - scale)}.${text.slice(text.length - scale)}`;
};

/**
 * Round a monetary amount to its currency's smallest tenderable unit.
 *
 * Exact: the value is parsed to an integer significand and rounded with BigInt
 * arithmetic, so no intermediate binary float can shift a value across a
 * rounding boundary. `1.005` rounds to `1.01`, not `1.00`.
 *
 * @example
 * roundToCurrency(14925.3731, "JPY") // 14925
 * roundToCurrency(30.674846, "KWD")  // 30.675
 * roundToCurrency("1.005",    "USD") // 1.01
 * roundToCurrency(-2.005,     "USD") // -2.01
 */
export const roundToCurrency = (
	amount: MoneyInput,
	currency: string | null | undefined,
): number => {
	const parsed = toExactDecimal(amount);
	if (!parsed) return 0;

	const exponent = getCurrencyExponent(currency);
	return fromMinorUnits(rescale(parsed, exponent), exponent);
};

/**
 * Amount expressed in whole minor units (cents, fils, yen) as a bigint.
 *
 * This is the representation to use when summing a ledger: integer addition is
 * associative and exact, so a column of a million postings totals identically
 * regardless of the order it is accumulated in.
 */
export const toMinorUnits = (
	amount: MoneyInput,
	currency: string | null | undefined,
): bigint => {
	const parsed = toExactDecimal(amount);
	if (!parsed) return 0n;
	return rescale(parsed, getCurrencyExponent(currency));
};

/** Inverse of {@link toMinorUnits}. */
export const fromMinorUnitsToAmount = (
	units: bigint,
	currency: string | null | undefined,
): number => fromMinorUnits(units, getCurrencyExponent(currency));

/**
 * Convert an amount between currencies and round to the target's precision.
 *
 * The multiplication is exact — significands are multiplied as integers and the
 * scales added — so the result is rounded from the true product rather than
 * from a float approximation of it. At a 6-decimal rate this is the difference
 * between a correct minor unit and an off-by-one on values that sit on a
 * rounding boundary.
 *
 * @param amount     Amount in the source currency.
 * @param rate       Units of `toCurrency` per one unit of the source currency.
 * @param toCurrency Target ISO 4217 code — determines the rounding precision.
 */
export const convertCurrency = (
	amount: MoneyInput,
	rate: MoneyInput,
	toCurrency: string | null | undefined,
): number => {
	const a = toExactDecimal(amount);
	const r = toExactDecimal(rate);
	if (!a || !r) return 0;

	const product: ExactDecimal = {
		digits: a.digits * r.digits,
		scale: a.scale + r.scale,
	};

	const exponent = getCurrencyExponent(toCurrency);
	return fromMinorUnits(rescale(product, exponent), exponent);
};

/**
 * True when a value is expressible in the currency — i.e. it carries no digits
 * beyond the currency's exponent. Useful for validating inbound amounts before
 * they reach the ledger.
 */
export const isRepresentableInCurrency = (
	amount: MoneyInput,
	currency: string | null | undefined,
): boolean => {
	const parsed = toExactDecimal(amount);
	if (!parsed) return false;
	const exponent = getCurrencyExponent(currency);
	// Exact test: rescaling down and back up must be lossless, i.e. the value
	// carries no digits finer than the currency can express.
	const units = rescale(parsed, exponent);
	return (
		rescale({ digits: units, scale: exponent }, parsed.scale) === parsed.digits
	);
};
