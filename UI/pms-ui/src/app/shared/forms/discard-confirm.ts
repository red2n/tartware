import { Component, output } from "@angular/core";

import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { IconComponent } from "../components/icon/icon";

/**
 * The "you have unsaved input" prompt. Shared by DialogShellComponent and the
 * appUnsavedGuard directive so dialogs and inline form panels ask the same
 * question in the same warning colours.
 */
@Component({
	selector: "app-discard-confirm",
	standalone: true,
	imports: [IconComponent, TranslatePipe],
	template: `
    <div class="discard-confirm">
      <span class="discard-confirm-message">
        <app-icon class="discard-confirm-icon" name="warning" />
        {{ 'Discard your changes?' | translate }}
      </span>
      <div class="discard-confirm-actions">
        <button class="btn btn-invisible btn-sm" (click)="keepEditing.emit()">
          {{ 'Keep editing' | translate }}
        </button>
        <button class="btn btn-warning btn-sm" (click)="discard.emit()">
          {{ 'Discard' | translate }}
        </button>
      </div>
    </div>
  `,
	styles: [
		`
    .discard-confirm {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--base-size-16);
      flex-wrap: wrap;
      padding: var(--base-size-12) var(--base-size-16);
      border: 1px solid var(--borderColor-attention-muted);
      border-radius: var(--borderRadius-medium);
      background: var(--bgColor-attention-muted);
    }

    .discard-confirm-message {
      display: inline-flex;
      align-items: center;
      gap: var(--base-size-8);
      font-size: var(--base-text-size-sm);
      font-weight: var(--base-text-weight-medium);
      color: var(--fgColor-attention);
    }

    .discard-confirm-icon {
      font-size: var(--base-text-size-lg);
    }

    .discard-confirm-actions {
      display: flex;
      align-items: center;
      gap: var(--base-size-8);
    }
  `,
	],
})
export class DiscardConfirmComponent {
	keepEditing = output<void>();
	discard = output<void>();
}
