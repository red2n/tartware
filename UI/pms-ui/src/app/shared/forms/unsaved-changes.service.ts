import { Injectable, signal } from "@angular/core";

/** What the service needs from a guarded form — implemented by the directive. */
export interface GuardedForm {
	readonly host: HTMLElement;
	isDirty(): boolean;
	/** Raise the discard prompt; resolves true once the user discards. */
	promptDiscard(): Promise<boolean>;
}

/**
 * Registry of the form panels currently on screen that hold unsaved input.
 *
 * Two things consult it: the appUnsavedGuard directive, to work out whether a
 * close button clicked *outside* its own panel belongs to it, and the route
 * guard, to stop a navigation away from a half-filled page.
 */
@Injectable({ providedIn: "root" })
export class UnsavedChangesService {
	private readonly forms = new Set<GuardedForm>();

	/** Exposed so a screen can reflect unsaved state if it ever needs to. */
	readonly dirtyCount = signal(0);

	constructor() {
		if (typeof window === "undefined") return;
		// Closing the tab or hitting reload is the one exit the app can't render a
		// prompt for — hand it to the browser's own "leave site?" dialog.
		window.addEventListener("beforeunload", (event: BeforeUnloadEvent) => {
			if (this.dirtyForms().length === 0) return;
			event.preventDefault();
			event.returnValue = "";
		});
	}

	register(form: GuardedForm): void {
		this.forms.add(form);
	}

	unregister(form: GuardedForm): void {
		this.forms.delete(form);
		this.syncDirtyCount();
	}

	syncDirtyCount(): void {
		this.dirtyCount.set(this.dirtyForms().length);
	}

	/** How many guarded forms are on screen, dirty or not. */
	get size(): number {
		return this.forms.size;
	}

	dirtyForms(): GuardedForm[] {
		return [...this.forms].filter((f) => f.isDirty());
	}

	/**
	 * The form a close control belongs to: the one containing it, or — for a
	 * toggle button that sits outside its panel, like the page-header buttons —
	 * the only dirty form on screen.
	 */
	ownerOf(control: HTMLElement): GuardedForm | null {
		const inside = [...this.forms].find((f) => f.host.contains(control));
		if (inside) return inside;
		const dirty = this.dirtyForms();
		return dirty.length === 1 ? dirty[0] : null;
	}

	/** True when it is safe to leave — no unsaved input, or the user discarded. */
	async confirmLeave(): Promise<boolean> {
		const dirty = this.dirtyForms();
		if (dirty.length === 0) return true;
		return dirty[0].promptDiscard();
	}
}
