import { Component, input, output } from "@angular/core";
import { MatDialogActions } from "@angular/material/dialog";
import { MatProgressSpinner } from "@angular/material/progress-spinner";

@Component({
  selector: "app-dialog-actions",
  standalone: true,
  imports: [MatDialogActions, MatProgressSpinner],
  template: `
    <mat-dialog-actions align="end">
      <button class="btn btn-outline" (click)="cancel.emit()" [disabled]="saving()">Cancel</button>
      <button
        class="btn btn-primary"
        [disabled]="!valid() || saving()"
        (click)="save.emit()">
        @if (saving()) {
          <mat-spinner diameter="16" />
          {{ savingLabel() }}
        } @else {
          {{ saveLabel() }}
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
