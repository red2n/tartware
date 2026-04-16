import { Component, input, output } from "@angular/core";
import { MatDialogActions } from "@angular/material/dialog";
import { MatProgressSpinner } from "@angular/material/progress-spinner";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";

@Component({
	selector: "app-dialog-actions",
	standalone: true,
	imports: [MatDialogActions, MatProgressSpinner, TranslatePipe],
	template: `
    <mat-dialog-actions align="end">
      <button class="btn btn-outline" (click)="cancel.emit()" [disabled]="saving()">{{ 'Cancel' | translate }}</button>
      <button
        class="btn btn-primary"
        [disabled]="!valid() || saving()"
        (click)="save.emit()">
        @if (saving()) {
          <mat-spinner diameter="16" />
          {{ savingLabel() | translate }}
        } @else {
          {{ saveLabel() | translate }}
        }
      </button>
    </mat-dialog-actions>
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
