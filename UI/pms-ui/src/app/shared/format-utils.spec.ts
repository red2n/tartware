import { relativeTime } from "./format-utils";

describe("relativeTime", () => {
	const at = (offsetMs: number): Date => new Date(Date.now() + offsetMs);
	const MIN = 60_000;
	const HOUR = 60 * MIN;
	const DAY = 24 * HOUR;

	it("collapses anything under a minute to 'just now'", () => {
		expect(relativeTime(at(-30_000))).toBe("just now");
		expect(relativeTime(at(30_000))).toBe("just now");
	});

	it("reads past events as elapsed and future ones as remaining", () => {
		expect(relativeTime(at(-5 * MIN))).toBe("5m ago");
		expect(relativeTime(at(5 * MIN))).toBe("in 5m");
		expect(relativeTime(at(-3 * HOUR))).toBe("3h ago");
		expect(relativeTime(at(3 * HOUR))).toBe("in 3h");
	});

	it("names the adjacent days instead of counting them", () => {
		expect(relativeTime(at(-1 * DAY))).toBe("yesterday");
		expect(relativeTime(at(1.1 * DAY))).toBe("tomorrow");
	});

	it("counts days up to a week", () => {
		expect(relativeTime(at(-3 * DAY))).toBe("3d ago");
		expect(relativeTime(at(3 * DAY))).toBe("in 3d");
	});

	it("falls back to an absolute date past a week", () => {
		const far = at(-30 * DAY);
		expect(relativeTime(far)).toBe(
			far.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
		);
	});

	it("accepts ISO strings as well as Date objects", () => {
		expect(relativeTime(at(-2 * HOUR).toISOString())).toBe("2h ago");
	});
});
