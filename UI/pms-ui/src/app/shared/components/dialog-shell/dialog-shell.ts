import { Component, input } from "@angular/core";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../icon/icon";

/**
 * The one dialog frame every modal uses: a pinned title row, a scrolling body,
 * and a pinned action row. Open dialogs through AppDialogService so the sizing
 * (60vw wide, up to 60vh tall) matches the layout this component assumes.
 *
 * Usage:
 *   <app-dialog-shell icon="person_add" heading="New Guest Profile">
 *     <div class="form-fields">…</div>
 *     <app-dialog-actions dialogFooter … />
 *   </app-dialog-shell>
 */
@Component({
	selector: "app-dialog-shell",
	standalone: true,
	imports: [IconComponent, TranslatePipe],
	template: `
    <h2 class="dialog-title">
      @if (icon(); as iconName) {
        <app-icon class="dialog-title-icon" [name]="iconName" />
      }
      {{ heading() | translate }}
    </h2>

    <div class="dialog-body">
      <ng-content />
    </div>

    <div class="dialog-footer">
      <ng-content select="[dialogFooter]" />
    </div>
  `,
	styleUrl: "./dialog-shell.scss",
})
export class DialogShellComponent {
	/** Material icon ligature shown before the heading. */
	icon = input<string>();
	/** Translation key for the dialog title. */
	heading = input.required<string>();
}
