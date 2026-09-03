import { describe, expect, it } from "vitest";

import {
	applyChannelRateAdjustment,
	CHANNEL_SYNC_DIRECTION_PUSH,
	CHANNEL_SYNC_STATUS_COLUMN,
	ChannelTransportKindEnum,
	formatChannelMoney,
} from "../src/api/channel-transport.js";

/**
 * The two vocabularies this contract exists to reconcile are enforced by CHECK
 * constraints in `scripts/tables/06-integrations/44_ota_inventory_sync.sql`. A
 * value that is not in them is not a typo, it is a 23514 at runtime — which is
 * exactly what `'outbound'` was, on every outbound OTA command, for as long as
 * the handlers existed.
 */
describe("column vocabularies", () => {
	it("uses a sync_direction the CHECK constraint accepts", () => {
		expect(["push", "pull", "bidirectional"]).toContain(
			CHANNEL_SYNC_DIRECTION_PUSH,
		);
	});

	it("maps every outcome onto an accepted sync_status", () => {
		const accepted = [
			"pending",
			"in_progress",
			"completed",
			"failed",
			"partial",
			"cancelled",
		];
		for (const status of Object.values(CHANNEL_SYNC_STATUS_COLUMN)) {
			expect(accepted).toContain(status);
		}
	});

	it("maps every outcome, so no push can be recorded with no status", () => {
		expect(Object.keys(CHANNEL_SYNC_STATUS_COLUMN).sort()).toEqual([
			"COMPLETED",
			"FAILED",
			"PARTIAL",
		]);
	});

	it("keeps NONE in the transport vocabulary as the default that refuses", () => {
		expect(ChannelTransportKindEnum.options).toContain("NONE");
	});
});

describe("applyChannelRateAdjustment", () => {
	it("returns the base rate untouched when neither adjustment is set", () => {
		expect(applyChannelRateAdjustment("189.00", null, null, "USD")).toBe(
			"189.00",
		);
		expect(applyChannelRateAdjustment("189.00", 0, 0, "USD")).toBe("189.00");
	});

	it("applies a markup", () => {
		expect(applyChannelRateAdjustment("100.00", "15", null, "USD")).toBe(
			"115.00",
		);
	});

	it("applies a markdown", () => {
		expect(applyChannelRateAdjustment("100.00", null, "10", "USD")).toBe(
			"90.00",
		);
	});

	it("applies both, in the order the handler always used", () => {
		// 200 * 1.10 * 0.95 = 209
		expect(applyChannelRateAdjustment("200.00", "10", "5", "USD")).toBe(
			"209.00",
		);
	});

	it("takes fractional percentages at the two decimals the column stores", () => {
		// 189.00 * 1.1250 = 212.625 -> 212.63 half-up
		expect(applyChannelRateAdjustment("189.00", "12.50", null, "USD")).toBe(
			"212.63",
		);
	});

	/**
	 * The regression this function exists for. The old handler computed
	 * `base * (1 + markup / 100) * (1 - markdown / 100)` in binary floating
	 * point and rounded with `Math.round(x * 100) / 100`. On this input the
	 * float product lands a hair below the true .005 boundary, so it rounds
	 * down and the channel advertises a cent less than the property agreed to.
	 */
	it("rounds a boundary value up, where float arithmetic rounds it down", () => {
		// 51.30 + 15% is exactly 58.995. Half-up gives 59.00; the double nearest
		// the product sits a hair below the boundary, so the old expression
		// rounded to 58.99 and the channel advertised a cent under the rate the
		// property had agreed with it.
		expect(Math.round(51.3 * (1 + 15 / 100) * 100) / 100).toBe(58.99);
		expect(applyChannelRateAdjustment("51.30", "15", null, "USD")).toBe(
			"59.00",
		);

		// 1.005 is the canonical case: exactly representable as a decimal,
		// below .005 as a double.
		expect(Math.round(1.005 * 100) / 100).toBe(1);
		expect(applyChannelRateAdjustment("1.005", null, null, "USD")).toBe("1.01");
	});

	it("honours the currency's own precision rather than assuming cents", () => {
		expect(applyChannelRateAdjustment("14925.37", null, null, "JPY")).toBe(
			"14925",
		);
		expect(applyChannelRateAdjustment("30.6748", null, null, "KWD")).toBe(
			"30.675",
		);
	});

	it("never emits a float artefact", () => {
		for (const base of ["189.99", "0.10", "1234.56", "77.77"]) {
			for (const markup of ["3.33", "12.50", "7.77"]) {
				const pushed = applyChannelRateAdjustment(base, markup, null, "USD");
				expect(pushed).toMatch(/^\d+\.\d{2}$/);
			}
		}
	});
});

describe("formatChannelMoney", () => {
	it("normalises a base rate to the currency's precision", () => {
		expect(formatChannelMoney("189", "USD")).toBe("189.00");
		expect(formatChannelMoney(189.5, "USD")).toBe("189.50");
		expect(formatChannelMoney("189.994", "USD")).toBe("189.99");
		expect(formatChannelMoney("1000", "JPY")).toBe("1000");
	});
});
