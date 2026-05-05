import { Component, input } from "@angular/core";

/**
 * Thin wrapper around Google Material Icons (ligature font).
 * Replaces <mat-icon> throughout the app — zero external dependency.
 *
 * Usage:
 *   <app-icon name="home" />
 *   <app-icon [name]="dynamicName()" class="icon-sm" />
 *
 * Size helpers (from shared.scss): .icon-sm (16px)  .icon-md (20px)  .icon-lg (24px — default)
 */
@Component({
	selector: "app-icon",
	standalone: true,
	template: `<span class="material-icons" aria-hidden="true">{{ name() }}</span>`,
	styles: [
		`
    :host { display: contents; }
    .material-icons {
      font-size: inherit;
      line-height: 1;
      vertical-align: middle;
      user-select: none;
    }
  `,
	],
})
export class IconComponent {
	name = input.required<string>();
}
