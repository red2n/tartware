import { HttpClient } from "@angular/common/http";
import { Injectable, inject, signal } from "@angular/core";

export const SUPPORTED_LANGUAGES = [
	{ code: "en", label: "English" },
	{ code: "es", label: "Español" },
	{ code: "fr", label: "Français" },
	{ code: "zh-TW", label: "中文（繁體）" },
] as const;

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

const STORAGE_KEY = "tartware-lang";

/** BCP-47 tag Angular's date/number/currency formatters want, per UI language. */
const ANGULAR_LOCALE: Record<LangCode, string> = {
	en: "en-US",
	es: "es",
	fr: "fr",
	"zh-TW": "zh-Hant",
};

/**
 * LOCALE_ID factory for `app.config.ts`, read straight from storage.
 *
 * Angular resolves LOCALE_ID once at bootstrap and `DatePipe` captures it, so
 * this cannot be a signal — switching language reloads instead (see `setLanguage`).
 */
/** The Angular locale for a UI language — used by `LocaleDatePipe`. */
export function angularLocaleFor(lang: LangCode): string {
	return ANGULAR_LOCALE[lang] ?? ANGULAR_LOCALE.en;
}

export function storedLocaleId(): string {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored && stored in ANGULAR_LOCALE) return ANGULAR_LOCALE[stored as LangCode];
	} catch {
		// private mode / storage disabled — fall through to the default
	}
	return ANGULAR_LOCALE.en;
}

/**
 * Lightweight i18n service for menu labels and page descriptions.
 *
 * English text is the fallback — translation files map English strings
 * to their localized equivalents. When the current language is English
 * (or a key is missing), the original English text is returned as-is.
 */
@Injectable({ providedIn: "root" })
export class I18nService {
	private readonly http = inject(HttpClient);

	readonly currentLang = signal<LangCode>(this.loadStoredLang());
	private readonly translations = signal<Record<string, string>>({});

	constructor() {
		if (this.currentLang() !== "en") {
			this.loadTranslations(this.currentLang());
		}
	}

	/**
	 * Translate an English string to the current language.
	 *
	 * Placeholders are written `{name}` in the key and substituted from
	 * `params`. Keeping the values out of the key is what lets a sentence
	 * whose word order differs per language still be translated as one
	 * unit — `"{count} rooms left"` becomes `"quedan {count} habitaciones"`
	 * rather than three fragments the caller has to reassemble.
	 */
	t(key: string, params?: Record<string, string | number | null | undefined>): string {
		if (!key) return key;
		const template = this.currentLang() === "en" ? key : (this.translations()[key] ?? key);
		if (!params) return template;
		return template.replace(/\{(\w+)\}/g, (whole, name) =>
			name in params ? (params[name] ?? "").toString() : whole,
		);
	}

	/** Switch UI language and persist the choice. Applies in place — no reload. */
	setLanguage(lang: LangCode): void {
		if (lang === this.currentLang()) return;
		this.currentLang.set(lang);
		localStorage.setItem(STORAGE_KEY, lang);
		this.loadTranslations(lang);
	}

	private loadStoredLang(): LangCode {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
			return stored as LangCode;
		}
		return "en";
	}

	private loadTranslations(lang: LangCode): void {
		if (lang === "en") {
			this.translations.set({});
			return;
		}
		this.http.get<Record<string, string>>(`/assets/i18n/${lang}.json`).subscribe({
			next: (data) => this.translations.set(data),
			error: () => this.translations.set({}),
		});
	}
}
