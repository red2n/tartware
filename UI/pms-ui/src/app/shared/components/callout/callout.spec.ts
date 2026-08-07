import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { CalloutComponent } from "./callout";

@Component({
	standalone: true,
	imports: [CalloutComponent],
	template: `
    <app-callout variant="warning" icon="lock" [block]="true" title="Analytics & BI isn't switched on">
      <p id="detail">This screen needs Analytics &amp; BI.</p>
      <a id="fix" callout-actions href="/modules">Open Settings</a>
    </app-callout>

    <app-callout variant="danger" title="Could not load">
      <p>Something broke.</p>
    </app-callout>

    <app-callout>
      <p>Just so you know.</p>
    </app-callout>
  `,
})
class CalloutHostComponent {}

describe("CalloutComponent", () => {
	let fixture: ComponentFixture<CalloutHostComponent>;

	const callouts = (): HTMLElement[] =>
		Array.from(fixture.nativeElement.querySelectorAll("app-callout"));

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [CalloutHostComponent] }).compileComponents();

		fixture = TestBed.createComponent(CalloutHostComponent);
		fixture.detectChanges();
	});

	it("renders the headline, the body copy and the action together", () => {
		const first = callouts()[0];

		expect(first.querySelector(".callout-title")?.textContent?.trim()).toBe(
			"Analytics & BI isn't switched on",
		);
		expect(first.querySelector(".callout-copy #detail")).not.toBeNull();
		expect(first.querySelector(".callout-actions #fix")).not.toBeNull();
	});

	it("tints by variant so the colour carries the severity", () => {
		expect(callouts()[0].querySelector(".callout")?.classList).toContain("callout-warning");
		expect(callouts()[1].querySelector(".callout")?.classList).toContain("callout-danger");
		// No variant given — informational.
		expect(callouts()[2].querySelector(".callout")?.classList).toContain("callout-info");
	});

	it("uses the given icon, and the variant's own icon otherwise", () => {
		expect(callouts()[0].querySelector(".callout-badge")?.textContent?.trim()).toBe("lock");
		expect(callouts()[1].querySelector(".callout-badge")?.textContent?.trim()).toBe(
			"error_outline",
		);
		expect(callouts()[2].querySelector(".callout-badge")?.textContent?.trim()).toBe("info");
	});

	it("interrupts screen readers only for danger, announcing the rest politely", () => {
		expect(callouts()[1].querySelector(".callout")?.getAttribute("role")).toBe("alert");
		expect(callouts()[0].querySelector(".callout")?.getAttribute("role")).toBe("status");
		expect(callouts()[2].querySelector(".callout")?.getAttribute("role")).toBe("status");
	});

	it("only takes over the content area when asked to", () => {
		expect(callouts()[0].querySelector(".callout")?.classList).toContain("callout-block");
		expect(callouts()[1].querySelector(".callout")?.classList).not.toContain("callout-block");
	});

	it("omits the heading line when there is no title", () => {
		expect(callouts()[2].querySelector(".callout-title")).toBeNull();
	});
});
