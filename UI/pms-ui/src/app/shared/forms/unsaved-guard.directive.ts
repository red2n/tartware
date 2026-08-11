import {
	type ComponentRef,
	DestroyRef,
	Directive,
	ElementRef,
	inject,
	ViewContainerRef,
} from "@angular/core";
import { ACTION_ROW_SELECTOR, attachDirtyTracking } from "./dirty-tracking";
import { DiscardConfirmComponent } from "./discard-confirm";
import { type GuardedForm, UnsavedChangesService } from "./unsaved-changes.service";

/**
 * Stops an inline form panel from throwing away typed input.
 *
 * Put it on the panel container and mark every control that closes the panel —
 * the Cancel button inside it and the toggle button in the page header — with a
 * bare `unsavedClose` attribute:
 *
 *   <div class="action-form" appUnsavedGuard>
 *     …fields…
 *     <button class="btn btn-outline" unsavedClose (click)="toggleForm()">Cancel</button>
 *   </div>
 *
 * Once the user edits something, clicking one of those controls (or pressing
 * Esc) shows the discard prompt instead of closing. Choosing Discard replays
 * the original click, so the screen's own close handler runs unchanged — no
 * screen needs to know this directive exists beyond the two attributes.
 */
@Directive({
	selector: "[appUnsavedGuard]",
	standalone: true,
})
export class UnsavedGuardDirective implements GuardedForm {
	readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

	private readonly vcr = inject(ViewContainerRef);
	private readonly service = inject(UnsavedChangesService);

	private dirty = false;
	private confirmRef: ComponentRef<DiscardConfirmComponent> | null = null;
	/** The close control the user clicked, replayed if they discard. */
	private pendingClose: HTMLElement | null = null;
	/** Set while replaying, so the replayed click isn't intercepted again. */
	private replaying = false;
	/** The action row the prompt is standing in for, restored afterwards. */
	private hiddenRow: HTMLElement | null = null;
	private hiddenRowDisplay = "";
	private resolvePrompt: ((discarded: boolean) => void) | null = null;

	constructor() {
		const detachTracking = attachDirtyTracking(this.host, () => this.markDirty());
		// Capture phase: a dirty panel has to stop the click before the screen's
		// own (click)="toggleForm()" handler runs and tears the panel down.
		document.addEventListener("click", this.onClickCapture, true);
		document.addEventListener("keydown", this.onEscape);
		this.service.register(this);

		inject(DestroyRef).onDestroy(() => {
			detachTracking();
			document.removeEventListener("click", this.onClickCapture, true);
			document.removeEventListener("keydown", this.onEscape);
			this.service.unregister(this);
		});
	}

	isDirty(): boolean {
		return this.dirty;
	}

	/** Used by the route guard, which has no click to intercept. */
	promptDiscard(): Promise<boolean> {
		if (!this.dirty) return Promise.resolve(true);
		this.showConfirm();
		return new Promise<boolean>((resolve) => {
			this.resolvePrompt = resolve;
		});
	}

	private markDirty(): void {
		this.dirty = true;
		this.service.syncDirtyCount();
	}

	private readonly onClickCapture = (event: Event): void => {
		if (this.replaying || !this.dirty) return;
		const control = (event.target as HTMLElement | null)?.closest<HTMLElement>("[unsavedClose]");
		if (!control || this.service.ownerOf(control) !== this) return;
		event.preventDefault();
		event.stopPropagation();
		this.pendingClose = control;
		this.showConfirm();
	};

	private readonly onEscape = (event: KeyboardEvent): void => {
		if (event.key !== "Escape") return;
		// A modal owns Esc while it is open — DialogShellComponent handles that.
		if (document.querySelector(".p-dialog")) return;
		if (!this.isFocusedPanel()) return;

		if (this.confirmRef) {
			event.preventDefault();
			this.keepEditing();
			return;
		}
		const control = this.host.querySelector<HTMLElement>("[unsavedClose]");
		if (!control) return;
		event.preventDefault();
		if (this.dirty) {
			this.pendingClose = control;
			this.showConfirm();
		} else {
			control.click();
		}
	};

	/**
	 * Esc acts on the panel the user is in. With focus elsewhere it only acts
	 * when this is the sole panel on screen, so Esc can't close several at once.
	 */
	private isFocusedPanel(): boolean {
		const active = document.activeElement;
		if (active && this.host.contains(active)) return true;
		return this.service.size === 1;
	}

	private showConfirm(): void {
		if (this.confirmRef) return;
		this.confirmRef = this.vcr.createComponent(DiscardConfirmComponent);
		this.confirmRef.instance.keepEditing.subscribe(() => this.keepEditing());
		this.confirmRef.instance.discard.subscribe(() => this.discard());

		const bar = this.confirmRef.location.nativeElement as HTMLElement;
		// Stand in for the action row rather than appending below it: the panel
		// keeps its height, and the buttons being replaced can't be clicked.
		const row = this.findActionRow();
		if (row?.parentElement) {
			// Invoices puts its buttons in a grid cell — span the row so the prompt
			// isn't squeezed into one column. Ignored outside a grid.
			bar.style.gridColumn = "1 / -1";
			row.parentElement.insertBefore(bar, row);
			this.hiddenRow = row;
			this.hiddenRowDisplay = row.style.display;
			row.style.display = "none";
		} else {
			this.host.appendChild(bar);
		}
		bar.scrollIntoView?.({ block: "nearest" });
	}

	private findActionRow(): HTMLElement | null {
		const own = this.pendingClose?.closest<HTMLElement>(ACTION_ROW_SELECTOR);
		if (own && this.host.contains(own)) return own;
		// Closed from outside the panel (a page-header toggle) — use its own row.
		return this.host.querySelector<HTMLElement>(ACTION_ROW_SELECTOR);
	}

	private hideConfirm(): void {
		if (this.hiddenRow) {
			this.hiddenRow.style.display = this.hiddenRowDisplay;
			this.hiddenRow = null;
		}
		this.confirmRef?.destroy();
		this.confirmRef = null;
	}

	private keepEditing(): void {
		this.hideConfirm();
		this.pendingClose = null;
		this.resolvePrompt?.(false);
		this.resolvePrompt = null;
	}

	private discard(): void {
		this.hideConfirm();
		this.dirty = false;
		this.service.syncDirtyCount();
		this.resolvePrompt?.(true);
		this.resolvePrompt = null;

		const control = this.pendingClose;
		this.pendingClose = null;
		if (!control) return;
		this.replaying = true;
		control.click();
		this.replaying = false;
	}
}
