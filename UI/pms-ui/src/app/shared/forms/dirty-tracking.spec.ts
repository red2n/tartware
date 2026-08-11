import { attachDirtyTracking } from "./dirty-tracking";

describe("attachDirtyTracking", () => {
	let host: HTMLElement;
	let detach: () => void;
	let dirty: boolean;

	beforeEach(() => {
		host = document.createElement("div");
		host.innerHTML = `
      <input id="field" />
      <select id="choice"><option value="a">a</option></select>
      <button id="chip">Chip</button>
      <div class="form-actions">
        <button id="save">Save</button>
        <button id="cancel" unsavedClose>Cancel</button>
      </div>`;
		document.body.appendChild(host);
		dirty = false;
		detach = attachDirtyTracking(host, () => {
			dirty = true;
		});
	});

	afterEach(() => {
		detach();
		host.remove();
	});

	it("marks dirty when the user types", () => {
		host.querySelector("#field")?.dispatchEvent(new Event("input", { bubbles: true }));
		expect(dirty).toBe(true);
	});

	it("marks dirty when a control changes", () => {
		host.querySelector("#choice")?.dispatchEvent(new Event("change", { bubbles: true }));
		expect(dirty).toBe(true);
	});

	it("marks dirty for click-driven controls like chips", () => {
		host.querySelector<HTMLButtonElement>("#chip")?.click();
		expect(dirty).toBe(true);
	});

	it("ignores buttons in the action row, so Cancel doesn't dirty a clean form", () => {
		host.querySelector<HTMLButtonElement>("#cancel")?.click();
		host.querySelector<HTMLButtonElement>("#save")?.click();
		expect(dirty).toBe(false);
	});

	it("ignores values set programmatically, so edit forms don't open dirty", () => {
		const field = host.querySelector<HTMLInputElement>("#field");
		if (field) field.value = "prefilled";
		expect(dirty).toBe(false);
	});

	it("stops tracking once detached", () => {
		detach();
		host.querySelector("#field")?.dispatchEvent(new Event("input", { bubbles: true }));
		expect(dirty).toBe(false);
	});
});
