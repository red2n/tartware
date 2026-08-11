import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { UnsavedGuardDirective } from "./unsaved-guard.directive";

@Component({
	standalone: true,
	imports: [UnsavedGuardDirective],
	template: `
    <button id="toggle" unsavedClose (click)="close()">Capture Payment</button>
    @if (open()) {
      <div class="action-form" appUnsavedGuard>
        <input id="amount" />
        <div class="form-actions">
          <button id="submit" (click)="submitted.set(true)">Capture</button>
          <button id="cancel" unsavedClose (click)="close()">Cancel</button>
        </div>
      </div>
    }
  `,
})
class PanelHostComponent {
	readonly open = signal(true);
	readonly submitted = signal(false);
	close(): void {
		this.open.set(false);
	}
}

/** Shape of the New Reservation page: guarded via hostDirectives, wizard footer. */
@Component({
	standalone: true,
	hostDirectives: [UnsavedGuardDirective],
	template: `
    <div class="wizard-step">
      <input id="arrival" />
      <div class="step-actions">
        <button id="back">Cancel</button>
        <button id="next">See rates</button>
      </div>
    </div>
    <div id="page-tail">unrelated content below the wizard</div>
  `,
})
class WizardPageComponent {}

describe("appUnsavedGuard on a route page", () => {
	it("puts the prompt in the wizard footer, not at the foot of the page", async () => {
		await TestBed.configureTestingModule({ imports: [WizardPageComponent] }).compileComponents();
		const fixture = TestBed.createComponent(WizardPageComponent);
		fixture.detectChanges();

		const root: HTMLElement = fixture.nativeElement;
		root.querySelector("#arrival")?.dispatchEvent(new Event("input", { bubbles: true }));
		await fixture.whenStable();

		// The route guard raises the prompt; the promise settles on the user's
		// choice, so it is deliberately not awaited here.
		const guard = fixture.debugElement.injector.get(UnsavedGuardDirective);
		void guard.promptDiscard();
		await fixture.whenStable();
		fixture.detectChanges();

		const bar = root.querySelector("app-discard-confirm");
		const row = root.querySelector<HTMLElement>(".step-actions");
		expect(bar).not.toBeNull();
		expect(bar?.nextElementSibling).toBe(row);
		expect(row?.style.display).toBe("none");
		expect(root.lastElementChild?.id).toBe("page-tail");
	});
});

describe("appUnsavedGuard", () => {
	let fixture: ComponentFixture<PanelHostComponent>;
	let host: PanelHostComponent;

	const el = <T extends HTMLElement>(selector: string): T | null =>
		fixture.nativeElement.querySelector(selector);

	const click = async (selector: string): Promise<void> => {
		el<HTMLButtonElement>(selector)?.click();
		await fixture.whenStable();
		fixture.detectChanges();
	};

	const type = async (): Promise<void> => {
		el<HTMLInputElement>("#amount")?.dispatchEvent(new Event("input", { bubbles: true }));
		await fixture.whenStable();
	};

	const pressEscape = async (): Promise<void> => {
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await fixture.whenStable();
		fixture.detectChanges();
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [PanelHostComponent] }).compileComponents();
		fixture = TestBed.createComponent(PanelHostComponent);
		host = fixture.componentInstance;
		fixture.detectChanges();
	});

	it("closes straight away when nothing was typed", async () => {
		await click("#cancel");
		expect(host.open()).toBe(false);
		expect(el("app-discard-confirm")).toBeNull();
	});

	it("prompts instead of closing once the user types", async () => {
		await type();
		await click("#cancel");
		expect(host.open()).toBe(true);
		expect(el("app-discard-confirm")).not.toBeNull();
	});

	it("stands in for the action row rather than growing the panel", async () => {
		await type();
		await click("#cancel");
		const bar = el<HTMLElement>("app-discard-confirm");
		const row = el<HTMLElement>(".form-actions");
		expect(bar?.nextElementSibling).toBe(row);
		expect(row?.style.display).toBe("none");
	});

	it("closes on Discard", async () => {
		await type();
		await click("#cancel");
		await click("app-discard-confirm .btn-warning");
		expect(host.open()).toBe(false);
	});

	it("restores the action row on Keep editing", async () => {
		await type();
		await click("#cancel");
		await click("app-discard-confirm .btn-invisible");
		expect(host.open()).toBe(true);
		expect(el("app-discard-confirm")).toBeNull();
		expect(el<HTMLElement>(".form-actions")?.style.display).not.toBe("none");
	});

	it("guards a close control outside the panel too", async () => {
		await type();
		await click("#toggle");
		expect(host.open()).toBe(true);
		expect(el("app-discard-confirm")).not.toBeNull();
	});

	it("spans the row when the buttons sit in a grid cell", async () => {
		await type();
		await click("#cancel");
		expect(el<HTMLElement>("app-discard-confirm")?.style.gridColumn).toBe("1 / -1");
	});

	it("leaves other buttons in the panel alone", async () => {
		await type();
		await click("#submit");
		expect(host.submitted()).toBe(true);
		expect(el("app-discard-confirm")).toBeNull();
	});

	it("prompts on Escape when dirty and closes when clean", async () => {
		await type();
		await pressEscape();
		expect(host.open()).toBe(true);
		expect(el("app-discard-confirm")).not.toBeNull();

		await click("app-discard-confirm .btn-warning");
		expect(host.open()).toBe(false);
	});

	it("Escape dismisses the prompt rather than the data", async () => {
		await type();
		await click("#cancel");
		await pressEscape();
		expect(el("app-discard-confirm")).toBeNull();
		expect(host.open()).toBe(true);
	});
});
