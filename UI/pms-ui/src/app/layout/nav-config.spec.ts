import { listScreens, searchScreens } from "./nav-config";

const ALL = new Set<string>();
const labels = (query: string, limit?: number): string[] =>
	searchScreens(query, ALL, false, limit).map((s) => s.label);

describe("searchScreens", () => {
	it("finds a screen by name", () => {
		expect(labels("reservation")).toContain("Reservations");
	});

	it("puts the closest name match first", () => {
		expect(labels("reservation")[0]).toBe("Reservations");
	});

	it("finds child screens through their parent section", () => {
		const results = searchScreens("reservation", ALL, false, 20);
		const child = results.find((s) => s.section === "Reservations");
		expect(child).toBeDefined();
		expect(child?.route).toMatch(/^\//);
	});

	it("matches on description when the name doesn't contain the term", () => {
		const results = searchScreens("check-in", ALL, false, 20);
		expect(results.length).toBeGreaterThan(0);
	});

	it("is case insensitive and ignores surrounding space", () => {
		expect(labels("  RESERVATION  ")).toEqual(labels("reservation"));
	});

	it("returns nothing for a blank query", () => {
		expect(searchScreens("   ", ALL, false)).toEqual([]);
	});

	it("returns nothing when the app has no such screen", () => {
		expect(searchScreens("zzzzz-not-a-screen", ALL, false)).toEqual([]);
	});

	it("caps the number of results", () => {
		expect(searchScreens("a", ALL, false, 3).length).toBeLessThanOrEqual(3);
	});

	it("every result can be navigated to", () => {
		for (const screen of searchScreens("r", ALL, false, 20)) {
			expect(screen.route).toBeTruthy();
			expect(screen.icon).toBeTruthy();
		}
	});
});

describe("listScreens", () => {
	it("lists parent and child screens that have routes", () => {
		const screens = listScreens(ALL, false);
		expect(screens.length).toBeGreaterThan(20);
		expect(screens.every((s) => !!s.route)).toBe(true);
	});

	it("hides screens the user's role can't open", () => {
		const onlyDashboard = listScreens(new Set(["dashboard"]), true);
		expect(onlyDashboard.some((s) => s.label === "Dashboard")).toBe(true);
		expect(onlyDashboard.some((s) => s.section === "Reservations")).toBe(false);
	});

	it("falls open when permissions haven't loaded yet", () => {
		expect(listScreens(new Set(), false).length).toBe(listScreens(new Set(), true).length);
	});
});
