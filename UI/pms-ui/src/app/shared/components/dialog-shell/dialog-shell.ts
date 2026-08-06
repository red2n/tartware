import {
	afterNextRender,
	Component,
	DestroyRef,
	ElementRef,
	inject,
	input,
	signal,
} from "@angular/core";
import { DynamicDialogRef } from "primeng/dynamicdialog";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { IconComponent } from "../icon/icon";

let nextTitleId = 0;

/**
 * The one dialog frame every modal uses: a pinned title row, a scrolling body,
 * and a pinned action row. Open dialogs through AppDialogService so the sizing
 * (60vw wide, up to 80vh tall) matches the layout this component assumes.
 *
 * Also guards against losing typed input: once the user edits anything, Esc and
 * Cancel ask before discarding. An untouched form closes straight away — the
 * trigger is unsaved input, not whether fields are required.
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
	host: {
		// input/change bubble from every control in the body. Programmatic
		// prefill (the edit dialogs) fires neither, so they don't start dirty.
		"(input)": "markDirty()",
		"(change)": "markDirty()",
	},
	template: `
    <h2 class="dialog-title" [id]="titleId">
      @if (icon(); as iconName) {
        <app-icon class="dialog-title-icon" [name]="iconName" />
      }
      {{ heading() | translate }}
    </h2>

    <div class="dialog-body">
      <ng-content />
    </div>

    <div class="dialog-footer" [class.is-confirming]="confirming()">
      @if (confirming()) {
        <div class="dialog-confirm">
          <span class="dialog-confirm-message">
            <app-icon class="dialog-confirm-icon" name="warning" />
            {{ 'Discard your changes?' | translate }}
          </span>
          <div class="dialog-actions">
            <button class="btn btn-invisible" (click)="keepEditing()">{{ 'Keep editing' | translate }}</button>
            <button class="btn btn-warning" (click)="discard()">{{ 'Discard' | translate }}</button>
          </div>
        </div>
      }
      <!-- Kept in the DOM rather than swapped out: re-projecting content would
           tear down the caller's action buttons and their state. -->
      <div class="dialog-footer-actions" [class.is-hidden]="confirming()">
        <ng-content select="[dialogFooter]" />
      </div>
    </div>
  `,
	styleUrl: "./dialog-shell.scss",
})
export class DialogShellComponent {
	/** Material icon ligature shown before the heading. */
	icon = input<string>();
	/** Translation key for the dialog title. */
	heading = input.required<string>();

	/** Names the dialog for assistive tech — see the constructor. */
	readonly titleId = `dialog-title-${nextTitleId++}`;
	readonly confirming = signal(false);

	private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
	private readonly dialogRef = inject(DynamicDialogRef, { optional: true });
	private dirty = false;

	constructor() {
		afterNextRender(() => {
			// PrimeNG derives aria-labelledby from its own header, which showHeader:
			// false never renders — the dialog is left pointing at a missing id and
			// has no accessible name. Repoint it at the title we render instead.
			this.host.closest(".p-dialog")?.setAttribute("aria-labelledby", this.titleId);
		});

		// Capture phase, so a dirty form can stop the click before the caller's own
		// (click)="cancel()" handler runs and closes the dialog behind our back.
		this.host.addEventListener("click", this.onClickCapture, true);
		document.addEventListener("keydown", this.onEscape);
		inject(DestroyRef).onDestroy(() => this.teardown());
	}

	markDirty(): void {
		this.dirty = true;
	}

	keepEditing(): void {
		this.confirming.set(false);
	}

	discard(): void {
		this.teardown();
		this.dialogRef?.close();
	}

	private readonly onClickCapture = (event: Event): void => {
		const target = event.target as HTMLElement | null;
		if (!target) return;
		// Chips and toggles set values on click without emitting input/change.
		if (target.closest(".dialog-body") && target.closest("button")) {
			this.markDirty();
		}
		if (!target.closest("[dialogCancel]")) return;
		if (!this.requestClose()) {
			event.preventDefault();
			event.stopPropagation();
		}
	};

	private readonly onEscape = (event: KeyboardEvent): void => {
		if (event.key !== "Escape") return;
		// Only the frontmost dialog reacts, so Esc doesn't close a stack at once.
		const dialogs = document.querySelectorAll(".p-dialog");
		if (dialogs[dialogs.length - 1] !== this.host.closest(".p-dialog")) return;
		event.preventDefault();
		if (this.confirming()) {
			// Esc dismisses the prompt, never the data behind it.
			this.keepEditing();
			return;
		}
		if (this.requestClose()) {
			this.teardown();
			this.dialogRef?.close();
		}
	};

	/** True when it is safe to close; otherwise raises the confirmation. */
	private requestClose(): boolean {
		if (!this.dirty) return true;
		this.confirming.set(true);
		return false;
	}

	private teardown(): void {
		this.host.removeEventListener("click", this.onClickCapture, true);
		document.removeEventListener("keydown", this.onEscape);
	}
}
