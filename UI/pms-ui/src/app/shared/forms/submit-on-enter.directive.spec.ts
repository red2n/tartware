import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { SubmitOnEnterDirective } from "./submit-on-enter.directive";

@Component({
	standalone: true,
	imports: [SubmitOnEnterDirective],
	template: `
    <div class="action-form" appSubmitOnEnter>
      <input id="reference" />
      <input id="search" type="search" />
      <textarea id="notes"></textarea>
      <div class="form-actions">
        <button id="cancel" class="btn btn-outline">Cancel</button>
        <button id="submit" class="btn btn-primary" [disabled]="blocked()" (click)="submits.set(submits() + 1)">
          Capture Payment
        </button>
      </div>
    </div>
  `,
})
class EnterHostComponent {
	readonly submits = signal(0);
	readonly blocked = signal(false);
}

describe("appSubmitOnEnter", () => {
	let fixture: ComponentFixture<EnterHostComponent>;
	let host: EnterHostComponent;

	const enterOn = async (selector: string, init: KeyboardEventInit = {}): Promise<void> => {
		fixture.nativeElement
			.querySelector(selector)
			?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, ...init }));
		await fixture.whenStable();
		fixture.detectChanges();
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [EnterHostComponent] }).compileComponents();
		fixture = TestBed.createComponent(EnterHostComponent);
		host = fixture.componentInstance;
		fixture.detectChanges();
	});

	it("submits from a text field", async () => {
		await enterOn("#reference");
		expect(host.submits()).toBe(1);
	});

	it("leaves Enter alone in a textarea", async () => {
		await enterOn("#notes");
		expect(host.submits()).toBe(0);
	});

	it("leaves Enter alone in a search field", async () => {
		await enterOn("#search");
		expect(host.submits()).toBe(0);
	});

	it("does nothing while the primary action is disabled", async () => {
		host.blocked.set(true);
		fixture.detectChanges();
		await enterOn("#reference");
		expect(host.submits()).toBe(0);
	});

	it("ignores Shift+Enter", async () => {
		await enterOn("#reference", { shiftKey: true });
		expect(host.submits()).toBe(0);
	});

	it("ignores Enter mid-composition (IME)", async () => {
		await enterOn("#reference", { isComposing: true });
		expect(host.submits()).toBe(0);
	});

	it("does not answer the discard prompt", async () => {
		const bar = document.createElement("app-discard-confirm");
		fixture.nativeElement.querySelector(".action-form")?.appendChild(bar);
		await enterOn("#reference");
		expect(host.submits()).toBe(0);
	});

	it("submits once, not once per keypress handler", async () => {
		await enterOn("#reference");
		await enterOn("#reference");
		expect(host.submits()).toBe(2);
	});
});

@Component({
	standalone: true,
	imports: [SubmitOnEnterDirective],
	template: `
    <div appSubmitOnEnter>
      <form (ngSubmit)="native.set(native() + 1)">
        <input id="in-form" />
        <div class="form-actions">
          <button class="btn btn-primary" (click)="clicked.set(clicked() + 1)">Save</button>
        </div>
      </form>
    </div>
  `,
})
class NativeFormHostComponent {
	readonly native = signal(0);
	readonly clicked = signal(0);
}

describe("appSubmitOnEnter with a real form", () => {
	it("defers to the browser so the form isn't submitted twice", async () => {
		await TestBed.configureTestingModule({
			imports: [NativeFormHostComponent],
		}).compileComponents();
		const fixture = TestBed.createComponent(NativeFormHostComponent);
		fixture.detectChanges();

		fixture.nativeElement
			.querySelector("#in-form")
			?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		await fixture.whenStable();

		expect(fixture.componentInstance.clicked()).toBe(0);
	});
});
