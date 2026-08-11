import { Component, input } from "@angular/core";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../icon/icon";

/**
 * Watermark-weight line describing the selected tab, shown above its content.
 *
 * Exists because tabbed screens name a section but never say what it is for —
 * "Preferences", "Documents" and "Communications" all read as "a list about
 * this record", and a night-audit "Bucket check" means nothing to someone who
 * has not run one. The strap states the purpose and, where it matters, what
 * can be done there.
 *
 * Deliberately low contrast and non-interactive: it orients someone landing on
 * an unfamiliar tab without competing with the data underneath. Screens supply
 * the copy from a `Record<YourTab, string>` so the compiler catches a tab added
 * without a description.
 *
 * Usage:
 * ```html
 * @if (tabOverview(); as overview) {
 *   <app-tab-strap [text]="overview" />
 * }
 * ```
 */
@Component({
	selector: "app-tab-strap",
	standalone: true,
	imports: [IconComponent, TranslatePipe],
	template: `
    <p class="tab-strap">
      <app-icon class="tab-strap-icon" name="info_outline" />
      {{ text() | translate }}
    </p>
  `,
	// .tab-strap lives in styles/shared.scss so the look stays identical across
	// screens; the host only has to stay out of the layout.
	styles: [":host { display: contents; }"],
})
export class TabStrapComponent {
	readonly text = input.required<string>();
}
