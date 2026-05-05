import { Component, input, output } from "@angular/core";
import { ProgressSpinnerModule } from "primeng/progressspinner";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";

@Component({
	selector: "app-dialog-actions",
	standalone: true,
	imports: [ProgressSpinnerModule, TranslatePipe],
	template: `
    <div class="dialog-actions">
      <button class="btn btn-outline" (click)="cancel.emit()" [disabled]="saving()">{{ 'Cancel' | translate }}</button>
      <button
        class="btn btn-primary"
        [disabled]="!valid() || saving()"
        (click)="save.emit()">
        @if (saving()) {
          <p-progressSpinner [style]="{ width: '16px', height: '16px' }" />
          {{ savingLabel() | translate }}
        } @else {
          {{ saveLabel() | translate }}
        }
      </button>
    </div>
  `,
})
export class DialogActionsComponent {
	saving = input.required<boolean>();
	valid = input.required<boolean>();
	saveLabel = input("Save");
	savingLabel = input("Saving…");
	cancel = output<void>();
	save = output<void>();
}
