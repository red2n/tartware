import type { Type } from "@angular/core";
import { Injectable, inject } from "@angular/core";
import type { DynamicDialogConfig, DynamicDialogRef } from "primeng/dynamicdialog";
import { DialogService } from "primeng/dynamicdialog";

/**
 * Single entry point for modal dialogs. Every dialog gets the same frame:
 * PrimeNG's header is off (DialogShellComponent draws the title row instead),
 * 60% of the viewport wide, and up to 80% tall before the body scrolls.
 *
 * Pass only what differs — usually just `data`.
 */
@Injectable({ providedIn: "root" })
export class AppDialogService {
	private readonly dialog = inject(DialogService);

	/**
	 * Returns null when a dialog of the same component is already open — PrimeNG
	 * refuses the duplicate rather than stacking a second copy, so a double click
	 * on "New guest" opens one dialog. Callers should use `ref?.onClose`.
	 */
	open<T>(component: Type<T>, config: DynamicDialogConfig = {}): DynamicDialogRef<T> | null {
		return this.dialog.open(component, {
			showHeader: false,
			// PrimeNG's Esc closes the dialog outright and can't be vetoed, so
			// DialogShellComponent owns the key instead — it prompts first when the
			// form has unsaved input. (No ✕ renders while showHeader is false.)
			closeOnEscape: false,
			closable: true,
			width: "60vw",
			style: { "max-height": "80vh" },
			// Fixed 60vw gets unusable on small screens — widen as it shrinks.
			breakpoints: { "1200px": "75vw", "768px": "94vw" },
			...config,
		});
	}
}
