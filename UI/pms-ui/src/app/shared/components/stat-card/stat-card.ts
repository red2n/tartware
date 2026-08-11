import { Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../icon/icon";

let nextHeadingId = 0;

/**
 * Shared dashboard-style card: icon + title header, projected body, optional
 * footer. Owns the two card behaviours features kept re-implementing —
 * navigating as a whole, and scrolling a feed inside a fixed-height panel.
 *
 * Usage:
 * ```html
 * <!-- Card that opens another screen: the title is a real link stretched over
 *      the card, and the header shows the open-in-new affordance. -->
 * <app-stat-card icon="meeting_room" title="Room Availability" link="/rooms">
 *   <div class="stat-row">…</div>
 * </app-stat-card>
 *
 * <!-- Feed panel: fixed height, only the body scrolls. -->
 * <app-stat-card icon="bolt" title="Recent Activity" [panel]="true">
 *   <button card-actions class="btn btn-invisible btn-sm">…</button>
 *   <ul class="tl-list">…</ul>
 *   <div card-footer class="tl-footer">…</div>
 * </app-stat-card>
 * ```
 *
 * Content slots: default → card body, `[card-actions]` → header trailing
 * cluster, `[card-footer]` → below the body, outside the scroll area.
 */
@Component({
	selector: "app-stat-card",
	standalone: true,
	imports: [IconComponent, RouterLink, TranslatePipe],
	template: `
    <section
      class="detail-card"
      [class.clickable]="!!link()"
      [class.stat-card-panel]="panel()"
      [attr.aria-labelledby]="headingId">
      <div class="card-header-flex stat-card-header">
        <h2 class="card-title" [id]="headingId">
          @if (icon(); as name) {
            <app-icon [name]="name" />
          }
          @if (link(); as target) {
            <a class="card-title-link" [routerLink]="target">{{ title() | translate }}</a>
          } @else {
            {{ title() | translate }}
          }
        </h2>
        <div class="stat-card-trailing">
          @if (link()) {
            <span class="card-link-icon"><app-icon name="open_in_new" /></span>
          }
          <ng-content select="[card-actions]" />
        </div>
      </div>
      <div class="card-body" [class.stat-card-body-scroll]="panel()">
        <ng-content />
      </div>
      <ng-content select="[card-footer]" />
    </section>
  `,
	styleUrl: "./stat-card.scss",
})
export class StatCardComponent {
	/** Material icon name shown before the title. Omit for a text-only header. */
	readonly icon = input("");
	/** Header text — translated by the component. */
	readonly title = input.required<string>();
	/** Router target. When set, the whole card becomes a link to that screen. */
	readonly link = input<string | unknown[] | null>(null);
	/** Fixed-height feed panel: the body scrolls, header and footer stay put. */
	readonly panel = input(false);

	/** Ties the section to its heading so screen readers announce the region. */
	protected readonly headingId = `stat-card-${nextHeadingId++}`;
}
