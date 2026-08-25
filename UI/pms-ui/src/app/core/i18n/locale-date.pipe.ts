import { formatDate } from "@angular/common";
import { inject, Pipe, type PipeTransform } from "@angular/core";

import { angularLocaleFor, I18nService } from "./i18n.service";

/**
 * `date`, with the locale taken from the live UI language.
 *
 * Angular's own `DatePipe` reads `LOCALE_ID`, which is resolved once at
 * bootstrap and cannot change afterwards — so a date formatted through it
 * stays in the language the app started in until the page is reloaded.
 * Reloading to switch language is worse than the problem, so dates go through
 * this instead: impure, so it re-runs when the language signal changes, and
 * the format strings are the ones `DatePipe` already accepts.
 */
@Pipe({ name: "localeDate", standalone: true, pure: false })
export class LocaleDatePipe implements PipeTransform {
	private readonly i18n = inject(I18nService);

	transform(
		value: string | number | Date | null | undefined,
		format = "mediumDate",
		timezone?: string,
	): string | null {
		if (value === null || value === undefined || value === "") return null;
		try {
			return formatDate(value, format, angularLocaleFor(this.i18n.currentLang()), timezone);
		} catch {
			// Unparseable input — render nothing rather than throwing out of a template.
			return null;
		}
	}
}
