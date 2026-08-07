import { Component, computed, input } from "@angular/core";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../icon/icon";

export type CalloutVariant = "info" | "warning" | "danger" | "success";

const DEFAULT_ICONS: Record<CalloutVariant, string> = {
	info: "info",
	warning: "info",
	danger: "error_outline",
	success: "check_circle",
};

/**
 * Tinted message panel: icon badge, headline, body copy, optional buttons.
 *
 * Exists because states the user has to *act* on — a feature that is switched
 * off, a load that failed — were being rendered as one grey sentence in an
 * empty state, which reads as "nothing here" rather than "here is what to do".
 *
 * Usage:
 * ```html
 * <!-- Inline banner above a form -->
 * <app-callout variant="warning" title="Rates are locked">
 *   <p>The night audit is running.</p>
 * </app-callout>
 *
 * <!-- Full panel replacing a screen's content, with an action -->
 * <app-callout variant="warning" icon="lock" [block]="true" [title]="err.title">
 *   <p>{{ err.detail }}</p>
 *   <button callout-actions class="btn btn-sm">Open settings</button>
 * </app-callout>
 * ```
 *
 * Content slots: default → body copy, `[callout-actions]` → button row.
 */
@Component({
	selector: "app-callout",
	standalone: true,
	imports: [IconComponent, TranslatePipe],
	template: `
    <div
      class="callout"
      [class]="'callout-' + variant()"
      [class.callout-block]="block()"
      [attr.role]="variant() === 'danger' ? 'alert' : 'status'">
      <span class="callout-badge"><app-icon [name]="iconName()" /></span>
      <div class="callout-content">
        @if (title(); as heading) {
          <p class="callout-title">{{ heading | translate }}</p>
        }
        <div class="callout-copy"><ng-content /></div>
        <div class="callout-actions"><ng-content select="[callout-actions]" /></div>
      </div>
    </div>
  `,
	// The .callout-* classes are global (styles/shared.scss) so screens can build
	// one in plain markup too; the host only has to stay out of the layout.
	styles: [":host { display: contents; }"],
})
export class CalloutComponent {
	readonly variant = input<CalloutVariant>("info");
	readonly title = input<string>("");
	/** Overrides the variant's default icon. */
	readonly icon = input<string>("");
	/** Renders as a centred panel that stands in for a screen's whole content. */
	readonly block = input(false);

	readonly iconName = computed(() => this.icon() || DEFAULT_ICONS[this.variant()]);
}
