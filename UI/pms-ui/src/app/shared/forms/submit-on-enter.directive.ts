import { DestroyRef, Directive, ElementRef, inject } from "@angular/core";

import { ACTION_ROW_SELECTOR } from "./dirty-tracking";

/** Where a form's primary action lives — panels, wizards and dialog footers. */
const SUBMIT_ROW_SELECTOR = `${ACTION_ROW_SELECTOR}, .dialog-footer`;

/** Fields where Enter means something else, or nothing. */
const NOT_A_SUBMIT_FIELD = 'textarea, button, a, [contenteditable="true"]';
const OPTED_OUT = 'input[type="search"], .field-input-search, [noEnterSubmit]';

/**
 * Presses the form's primary button when the user hits Enter in a field.
 *
 * The screens here are built from divs rather than <form> elements, so they get
 * none of the browser's implicit submission. This restores it without rewriting
 * every screen: the primary button in the action row is the submit.
 *
 * Enter is left alone in a textarea (it's a newline), inside a real <form>
 * (the browser already handles it), on a search field, on anything marked
 * `noEnterSubmit`, and while the discard prompt is showing.
 */
@Directive({
	selector: "[appSubmitOnEnter]",
	standalone: true,
})
export class SubmitOnEnterDirective {
	private readonly host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;

	constructor() {
		this.host.addEventListener("keydown", this.onKeydown);
		inject(DestroyRef).onDestroy(() => this.host.removeEventListener("keydown", this.onKeydown));
	}

	private readonly onKeydown = (event: KeyboardEvent): void => {
		if (event.key !== "Enter" || event.isComposing || event.shiftKey || event.altKey) return;

		const target = event.target as HTMLElement | null;
		if (!target || !this.isSubmittingField(target)) return;
		// The discard prompt is a question, not a form — don't answer it with Enter.
		if (this.host.querySelector("app-discard-confirm")) return;

		const submit = this.primaryAction();
		if (!submit || submit.disabled) return;
		event.preventDefault();
		submit.click();
	};

	private isSubmittingField(target: HTMLElement): boolean {
		if (target.closest(NOT_A_SUBMIT_FIELD) || target.matches(OPTED_OUT)) return false;
		// A real <form> submits on Enter by itself; firing here would double it.
		if (target.closest("form")) return false;
		return !!target.closest("input, select");
	}

	private primaryAction(): HTMLButtonElement | null {
		const row = this.host.querySelector<HTMLElement>(SUBMIT_ROW_SELECTOR) ?? this.host;
		return row.querySelector<HTMLButtonElement>("button.btn-primary");
	}
}
