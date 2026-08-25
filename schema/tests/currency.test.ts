import { describe, expect, it } from "vitest";

import {
	convertCurrency,
	fromMinorUnitsToAmount,
	getCurrencyExponent,
	isRepresentableInCurrency,
	roundToCurrency,
	toMinorUnits,
} from "../src/api/currency.js";

describe("ISO 4217 exponents", () => {
	it.each([
		["USD", 2],
		["EUR", 2],
		["INR", 2],
		["CNY", 2],
		["JPY", 0],
		["KRW", 0],
		["VND", 0],
		["KWD", 3],
		["BHD", 3],
		["OMR", 3],
		["CLF", 4],
	])("%s has exponent %i", (code, exponent) => {
		expect(getCurrencyExponent(code)).toBe(exponent);
	});

	it.each(["usd", " USD ", "Usd"])("normalises casing and padding for %s", (code) => {
		expect(getCurrencyExponent(code)).toBe(2);
	});

	it("falls back to 2 for unknown or missing codes", () => {
		// An unrecognised code must degrade to the common case rather than throw:
		// a posting is not worth losing over an unmapped currency.
		expect(getCurrencyExponent("ZZZ")).toBe(2);
		expect(getCurrencyExponent("")).toBe(2);
		expect(getCurrencyExponent(null)).toBe(2);
		expect(getCurrencyExponent(undefined)).toBe(2);
	});
});

describe("roundToCurrency — exactness", () => {
	it("rounds decimal halves away from zero, not as binary floats do", () => {
		// The canonical trap: 2.675 is stored as 2.67499999... in float64, so
		// Math.round(2.675 * 100) / 100 yields 2.67 and quietly loses a cent.
		expect(roundToCurrency(2.675, "USD")).toBe(2.68);
		expect(roundToCurrency(1.005, "USD")).toBe(1.01);
		expect(roundToCurrency(8.575, "USD")).toBe(8.58);
	});

	it("keeps credits and debits symmetric", () => {
		// Half-up on a signed value would round -2.005 to -2.00, biasing every
		// refund one minor unit toward zero relative to the charge it reverses.
		expect(roundToCurrency(2.005, "USD")).toBe(2.01);
		expect(roundToCurrency(-2.005, "USD")).toBe(-2.01);
		expect(roundToCurrency(14925.5, "JPY")).toBe(14926);
		expect(roundToCurrency(-14925.5, "JPY")).toBe(-14926);
	});

	it("respects each currency's own precision", () => {
		expect(roundToCurrency(14925.3731, "JPY")).toBe(14925);
		expect(roundToCurrency(30.674846, "KWD")).toBe(30.675);
		expect(roundToCurrency(8333.3333, "INR")).toBe(8333.33);
	});

	it("accepts the decimal strings PostgreSQL returns for NUMERIC", () => {
		// pg hands back NUMERIC as a string precisely to avoid precision loss;
		// parsing it as a float first would defeat that.
		expect(roundToCurrency("16500.000000", "INR")).toBe(16500);
		expect(roundToCurrency("0.1", "USD")).toBe(0.1);
		expect(roundToCurrency("-2.005", "USD")).toBe(-2.01);
	});

	it("handles exponent notation", () => {
		expect(roundToCurrency(1.5e-7, "USD")).toBe(0);
		expect(roundToCurrency("1.5e2", "USD")).toBe(150);
	});

	it("returns 0 for values that are not numbers", () => {
		expect(roundToCurrency(Number.NaN, "USD")).toBe(0);
		expect(roundToCurrency(Number.POSITIVE_INFINITY, "USD")).toBe(0);
		expect(roundToCurrency("abc", "USD")).toBe(0);
		expect(roundToCurrency("", "USD")).toBe(0);
	});
});

describe("convertCurrency", () => {
	it("rounds to the target currency, not the source", () => {
		expect(convertCurrency(100, "149.253731", "JPY")).toBe(14925);
		expect(convertCurrency(100, "0.306748", "KWD")).toBe(30.675);
		expect(convertCurrency(100, "83.333333", "INR")).toBe(8333.33);
	});

	it("converts foreign tender into a base currency", () => {
		expect(convertCurrency(16500, "0.012000", "USD")).toBe(198);
		expect(convertCurrency(29000, "0.006700", "USD")).toBe(194.3);
		expect(convertCurrency("61.500", "3.260000", "USD")).toBe(200.49);
	});

	it("multiplies exactly rather than through a float product", () => {
		// 0.615 * 3.26 is 2.0049 exactly, which must round down to 2.00. A float
		// product lands on 2.0049000000000004 — harmless here, but the same drift
		// flips a minor unit once a value sits precisely on the boundary.
		expect(convertCurrency("0.615", "3.260000", "USD")).toBe(2);
		expect(convertCurrency("1.005", "1.000000", "USD")).toBe(1.01);
	});

	it("returns 0 when either operand is unparseable", () => {
		expect(convertCurrency("abc", "1.0", "USD")).toBe(0);
		expect(convertCurrency(100, "xyz", "USD")).toBe(0);
	});
});

describe("minor units", () => {
	it("expresses amounts as exact integers", () => {
		expect(toMinorUnits(30.675, "KWD")).toBe(30675n);
		expect(toMinorUnits(14925, "JPY")).toBe(14925n);
		expect(toMinorUnits("198.00", "USD")).toBe(19800n);
		expect(toMinorUnits(-2.01, "USD")).toBe(-201n);
	});

	it("round-trips back to the amount", () => {
		expect(fromMinorUnitsToAmount(30675n, "KWD")).toBe(30.675);
		expect(fromMinorUnitsToAmount(14925n, "JPY")).toBe(14925);
		expect(fromMinorUnitsToAmount(-201n, "USD")).toBe(-2.01);
	});

	it("sums a ledger without accumulating drift", () => {
		// Ten 0.10 postings total 1.00. Adding them as floats gives
		// 0.9999999999999999, which is how a trial balance ends up off by a cent.
		let units = 0n;
		for (let i = 0; i < 10; i++) units += toMinorUnits("0.10", "USD");
		expect(fromMinorUnitsToAmount(units, "USD")).toBe(1);
	});
});

describe("isRepresentableInCurrency", () => {
	it("rejects amounts finer than the currency can express", () => {
		expect(isRepresentableInCurrency(14925.37, "JPY")).toBe(false);
		expect(isRepresentableInCurrency(30.6754, "KWD")).toBe(false);
		expect(isRepresentableInCurrency(1.005, "USD")).toBe(false);
	});

	it("accepts tenderable amounts", () => {
		expect(isRepresentableInCurrency(14925, "JPY")).toBe(true);
		expect(isRepresentableInCurrency(30.675, "KWD")).toBe(true);
		expect(isRepresentableInCurrency(1.5, "USD")).toBe(true);
		expect(isRepresentableInCurrency("198.00", "USD")).toBe(true);
	});
});
