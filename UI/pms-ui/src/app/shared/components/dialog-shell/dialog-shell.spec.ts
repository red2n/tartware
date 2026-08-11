import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { DynamicDialogRef } from "primeng/dynamicdialog";

import { DialogShellComponent } from "./dialog-shell";

@Component({
	standalone: true,
	imports: [DialogShellComponent],
	// Mirrors the DOM PrimeNG builds around the shell, so the Esc and
	// aria-labelledby wiring is exercised the way it runs in the app.
	template: `
    <div class="p-dialog">
      <div class="p-dialog-content">
        <app-dialog-shell icon="person_add" heading="New Guest Profile">
          <input id="first-name" />
          <div class="dialog-actions" dialogFooter>
            <button id="cancel" class="btn btn-outline" unsavedClose (click)="cancelled.set(true)">
              Cancel
            </button>
            <button id="save" class="btn btn-primary" (click)="saved.set(true)">Create guest</button>
          </div>
        </app-dialog-shell>
      </div>
    </div>
  `,
})
class DialogHostComponent {
	readonly cancelled = signal(false);
	readonly saved = signal(false);
}

describe("DialogShellComponent", () => {
	let fixture: ComponentFixture<DialogHostComponent>;
	let host: DialogHostComponent;
	let closeSpy: ReturnType<typeof vi.fn>;

	const el = <T extends HTMLElement>(selector: string): T | null =>
		fixture.nativeElement.querySelector(selector);

	const click = async (selector: string): Promise<void> => {
		el<HTMLButtonElement>(selector)?.click();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	const type = async (): Promise<void> => {
		el<HTMLInputElement>("#first-name")?.dispatchEvent(new Event("input", { bubbles: true }));
		await fixture.whenStable();
	};

	const pressEscape = async (): Promise<void> => {
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await fixture.whenStable();
		fixture.detectChanges();
	};

	beforeEach(async () => {
		closeSpy = vi.fn();
		await TestBed.configureTestingModule({
			imports: [DialogHostComponent],
			providers: [{ provide: DynamicDialogRef, useValue: { close: closeSpy } }],
		}).compileComponents();
		fixture = TestBed.createComponent(DialogHostComponent);
		host = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it("names the dialog for assistive tech", () => {
		const labelledBy = el<HTMLElement>(".p-dialog")?.getAttribute("aria-labelledby");
		expect(labelledBy).toBeTruthy();
		expect(el<HTMLElement>(".dialog-title")?.id).toBe(labelledBy);
	});

	it("lets Cancel through on an untouched form", async () => {
		await click("#cancel");
		expect(host.cancelled()).toBe(true);
		expect(el("app-discard-confirm")).toBeNull();
	});

	it("prompts instead of cancelling once the user types", async () => {
		await type();
		await click("#cancel");
		expect(host.cancelled()).toBe(false);
		expect(el("app-discard-confirm")).not.toBeNull();
	});

	it("hides the action row while the prompt is up", async () => {
		await type();
		await click("#cancel");
		expect(el<HTMLElement>(".dialog-footer-actions")?.className).toContain("is-hidden");
	});

	it("closes the dialog on Discard", async () => {
		await type();
		await click("#cancel");
		await click("app-discard-confirm .btn-warning");
		expect(closeSpy).toHaveBeenCalled();
	});

	it("keeps the dialog open on Keep editing", async () => {
		await type();
		await click("#cancel");
		await click("app-discard-confirm .btn-invisible");
		expect(closeSpy).not.toHaveBeenCalled();
		expect(el("app-discard-confirm")).toBeNull();
	});

	it("closes on Escape when the form is untouched", async () => {
		await pressEscape();
		expect(closeSpy).toHaveBeenCalledTimes(1);
		expect(el("app-discard-confirm")).toBeNull();
	});

	it("prompts on Escape once the user types", async () => {
		await type();
		await pressEscape();
		expect(closeSpy).not.toHaveBeenCalled();
		expect(el("app-discard-confirm")).not.toBeNull();
	});

	it("Escape dismisses the prompt rather than the data", async () => {
		await type();
		await click("#cancel");
		await pressEscape();
		expect(el("app-discard-confirm")).toBeNull();
		expect(closeSpy).not.toHaveBeenCalled();
	});

	it("submits on Enter from a field", async () => {
		el<HTMLInputElement>("#first-name")?.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
		);
		await fixture.whenStable();
		expect(host.saved()).toBe(true);
	});

	it("leaves the save button alone", async () => {
		await type();
		await click("#save");
		expect(host.saved()).toBe(true);
		expect(el("app-discard-confirm")).toBeNull();
	});
});
