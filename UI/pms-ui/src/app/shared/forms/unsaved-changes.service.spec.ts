import { type GuardedForm, UnsavedChangesService } from "./unsaved-changes.service";

const stubForm = (dirty: boolean, discards = true): GuardedForm => ({
	host: document.createElement("div"),
	isDirty: () => dirty,
	promptDiscard: () => Promise.resolve(discards),
});

describe("UnsavedChangesService", () => {
	let service: UnsavedChangesService;

	beforeEach(() => {
		service = new UnsavedChangesService();
	});

	it("lets a navigation through when nothing is dirty", async () => {
		service.register(stubForm(false));
		await expect(service.confirmLeave()).resolves.toBe(true);
	});

	it("blocks the navigation when the user keeps editing", async () => {
		service.register(stubForm(true, false));
		await expect(service.confirmLeave()).resolves.toBe(false);
	});

	it("allows the navigation once the user discards", async () => {
		service.register(stubForm(true, true));
		await expect(service.confirmLeave()).resolves.toBe(true);
	});

	it("attributes a close control inside a panel to that panel", () => {
		const outer = stubForm(true);
		const button = document.createElement("button");
		outer.host.appendChild(button);
		service.register(outer);
		service.register(stubForm(false));
		expect(service.ownerOf(button)).toBe(outer);
	});

	it("attributes a control outside any panel to the only dirty one", () => {
		const dirty = stubForm(true);
		service.register(dirty);
		service.register(stubForm(false));
		expect(service.ownerOf(document.createElement("button"))).toBe(dirty);
	});

	it("claims nothing when several panels are dirty", () => {
		service.register(stubForm(true));
		service.register(stubForm(true));
		expect(service.ownerOf(document.createElement("button"))).toBeNull();
	});

	it("forgets a panel once it is torn down", async () => {
		const form = stubForm(true, false);
		service.register(form);
		service.unregister(form);
		await expect(service.confirmLeave()).resolves.toBe(true);
	});
});
