import { Component } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { StatCardComponent } from "./stat-card";

@Component({
	standalone: true,
	imports: [StatCardComponent],
	template: `
    <app-stat-card icon="meeting_room" title="Room Availability" link="/rooms">
      <div id="rooms-body" class="stat-row">42</div>
    </app-stat-card>

    <app-stat-card icon="bolt" title="Recent Activity" [panel]="true">
      <button id="refresh" card-actions type="button">refresh</button>
      <ul id="feed"></ul>
      <div id="foot" card-footer class="tl-footer">more</div>
    </app-stat-card>
  `,
})
class StatCardHostComponent {}

describe("StatCardComponent", () => {
	let fixture: ComponentFixture<StatCardHostComponent>;

	const cards = (): HTMLElement[] =>
		Array.from(fixture.nativeElement.querySelectorAll("app-stat-card"));

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [StatCardHostComponent],
			providers: [provideRouter([])],
		}).compileComponents();

		fixture = TestBed.createComponent(StatCardHostComponent);
		fixture.detectChanges();
	});

	it("renders a link card whose title is an anchor to the target screen", () => {
		const card = cards()[0];
		const anchor = card.querySelector<HTMLAnchorElement>("a.card-title-link");

		expect(card.querySelector(".detail-card")?.classList).toContain("clickable");
		expect(anchor?.textContent?.trim()).toBe("Room Availability");
		expect(anchor?.getAttribute("href")).toBe("/rooms");
	});

	it("shows the open-in-new affordance only on cards that navigate", () => {
		expect(cards()[0].querySelector(".card-link-icon")).not.toBeNull();
		expect(cards()[1].querySelector(".card-link-icon")).toBeNull();
	});

	it("ties the section to its heading for screen readers", () => {
		const section = cards()[0].querySelector("section");
		const heading = cards()[0].querySelector("h2");

		expect(heading?.id).toBeTruthy();
		expect(section?.getAttribute("aria-labelledby")).toBe(heading?.id);
	});

	it("gives each card a distinct heading id", () => {
		const [first, second] = cards().map((c) => c.querySelector("h2")?.id);
		expect(first).not.toBe(second);
	});

	it("projects actions into the header and footer below the body", () => {
		const card = cards()[1];

		expect(card.querySelector(".card-header-flex #refresh")).not.toBeNull();
		expect(card.querySelector(".card-body #feed")).not.toBeNull();
		// Footer sits outside the scrolling body so it stays pinned.
		expect(card.querySelector(".card-body #foot")).toBeNull();
		expect(card.querySelector("section > #foot")).not.toBeNull();
	});

	it("makes only the panel variant a fixed-height scrolling card", () => {
		expect(cards()[0].querySelector(".stat-card-panel")).toBeNull();
		expect(cards()[0].querySelector(".stat-card-body-scroll")).toBeNull();
		expect(cards()[1].querySelector(".stat-card-panel")).not.toBeNull();
		expect(cards()[1].querySelector(".stat-card-body-scroll")).not.toBeNull();
	});
});
