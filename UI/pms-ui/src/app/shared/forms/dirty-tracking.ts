/**
 * The row a panel's Save/Cancel buttons live in. The discard prompt takes its
 * place so the panel keeps its height instead of growing a bar underneath.
 */
export const ACTION_ROW_SELECTOR =
	".form-actions, .confirm-actions, .form-group-actions, .step-actions";

/** Regions where buttons act on the form rather than filling it in. */
const ACTION_REGIONS = `${ACTION_ROW_SELECTOR}, .action-buttons, .close-form-row, .dialog-footer`;

/**
 * Flags a form as edited from DOM events alone, so no screen has to maintain
 * its own dirty flag.
 *
 * `input` and `change` bubble from every native control, and programmatic
 * prefill (edit forms populating ngModel) fires neither — so a form that was
 * only filled in by code does not count as dirty. Clicks on buttons are also
 * counted, because chips and toggles set values without emitting either event;
 * buttons in the action row are excluded so that clicking Cancel on an
 * untouched form doesn't make it dirty on the way out.
 *
 * Returns a teardown function.
 */
export function attachDirtyTracking(host: HTMLElement, onDirty: () => void): () => void {
	const mark = (): void => onDirty();

	const onClick = (event: Event): void => {
		const target = event.target as HTMLElement | null;
		const button = target?.closest("button");
		if (!button || !host.contains(button)) return;
		if (button.closest(ACTION_REGIONS) || button.hasAttribute("unsavedClose")) return;
		mark();
	};

	host.addEventListener("input", mark);
	host.addEventListener("change", mark);
	host.addEventListener("click", onClick);

	return () => {
		host.removeEventListener("input", mark);
		host.removeEventListener("change", mark);
		host.removeEventListener("click", onClick);
	};
}
