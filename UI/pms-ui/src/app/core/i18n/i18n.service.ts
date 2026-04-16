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

	/** Translate an English string to the current language. */
	t(key: string): string {
		if (!key || this.currentLang() === "en") return key;
		return this.translations()[key] ?? key;
	}

	/** Switch UI language and persist the choice. */
	setLanguage(lang: LangCode): void {
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
