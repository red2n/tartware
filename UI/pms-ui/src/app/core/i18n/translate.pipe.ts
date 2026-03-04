import { inject, Pipe, type PipeTransform } from "@angular/core";

import { I18nService } from "./i18n.service";

/**
 * Translates an English string to the active UI language.
 *
 * Usage: `{{ 'Dashboard' | translate }}`
 *
 * Marked impure so it re-evaluates when the language signal changes.
 * The pipe is used on a small number of menu labels and page headers,
 * so the performance impact is negligible.
 */
@Pipe({ name: "translate", standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
	private readonly i18n = inject(I18nService);

	transform(value: string): string {
		return this.i18n.t(value);
	}
}
