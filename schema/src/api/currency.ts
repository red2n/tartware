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

/**
 * Currencies whose exponent is not the default 2.
 *
 * Kept as an exception list rather than a full ISO 4217 table: the default of 2
 * is correct for the overwhelming majority, so only the deviations need to be
 * maintained, and an unlisted currency degrades to the common case instead of
 * failing.
 */
const CURRENCY_EXPONENT_OVERRIDES: Readonly<Record<string, number>> = Object.freeze({
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
export const getCurrencyExponent = (currency: string | null | undefined): number => {
	if (!currency) return DEFAULT_CURRENCY_EXPONENT;
	const code = currency.trim().toUpperCase();
	return CURRENCY_EXPONENT_OVERRIDES[code] ?? DEFAULT_CURRENCY_EXPONENT;
};

/**
 * Round a monetary amount to its currency's smallest tenderable unit.
 *
 * Uses half-away-from-zero, matching how cash rounding is specified in
 * accounting practice — `Math.round` alone is half-up, which biases negative
 * amounts (refunds, credits) by one minor unit in the wrong direction.
 *
 * @example
 * roundToCurrency(14925.3731, "JPY") // 14925
 * roundToCurrency(30.674846, "KWD")  // 30.675
 * roundToCurrency(198.004,   "USD")  // 198
 * roundToCurrency(-2.005,    "USD")  // -2.01
 */
export const roundToCurrency = (amount: number, currency: string | null | undefined): number => {
	if (!Number.isFinite(amount)) return 0;

	const factor = 10 ** getCurrencyExponent(currency);
	const scaled = amount * factor;

	// Nudge by one ULP-ish epsilon before rounding: binary floating point stores
	// 1.005 as 1.00499999…, which would otherwise round down and lose a cent on
	// values that are exact in decimal.
	const epsilon = Math.abs(scaled) * Number.EPSILON;
	const rounded =
		scaled >= 0 ? Math.round(scaled + epsilon) : -Math.round(Math.abs(scaled) + epsilon);

	return rounded / factor;
};

/**
 * Convert an amount between currencies and round to the target's precision.
 *
 * @param amount   Amount in `fromCurrency`.
 * @param rate     Units of `toCurrency` per one unit of `fromCurrency`.
 * @param toCurrency Target ISO 4217 code — determines the rounding precision.
 */
export const convertCurrency = (
	amount: number,
	rate: number,
	toCurrency: string | null | undefined,
): number => roundToCurrency(amount * rate, toCurrency);

/**
 * True when a value is expressible in the currency — i.e. it carries no digits
 * beyond the currency's exponent. Useful for validating inbound amounts before
 * they reach the ledger.
 */
export const isRepresentableInCurrency = (
	amount: number,
	currency: string | null | undefined,
): boolean => Number.isFinite(amount) && roundToCurrency(amount, currency) === amount;
