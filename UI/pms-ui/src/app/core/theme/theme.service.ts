import { computed, effect, Injectable, signal } from "@angular/core";

import type { UserUiPreferences } from "@tartware/schemas";

import { ApiService } from "../api/api.service";
import { AuthService } from "../auth/auth.service";

export type ThemeMode = "LIGHT" | "DARK" | "SYSTEM";

const THEME_STORAGE_KEY = "theme_mode";

function isThemeMode(value: string | null): value is ThemeMode {
	return value === "LIGHT" || value === "DARK" || value === "SYSTEM";
}

function restoreTheme(): ThemeMode {
	const stored =
		typeof localStorage !== "undefined" ? localStorage.getItem(THEME_STORAGE_KEY) : null;
	if (isThemeMode(stored)) return stored;
	// Load-bearing: this fallback must stay SYSTEM to match the pre-bootstrap
	// script in index.html, which resolves an unset preference against the OS.
	// When the two disagree the page paints one theme and then snaps to the
	// other the moment Angular boots — the exact flash that script prevents.
	// The column default in 19_user_ui_preferences.sql is SYSTEM as well.
	return "SYSTEM";
}

@Injectable({ providedIn: "root" })
export class ThemeService {
	private readonly _themeMode = signal<ThemeMode>(restoreTheme());
	private readonly _osPrefersDark = signal(
		typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
	);

	readonly themeMode = this._themeMode.asReadonly();

	/** Resolved effective theme (never 'SYSTEM') */
	readonly effectiveTheme = computed<"LIGHT" | "DARK">(() => {
		const mode = this._themeMode();
		if (mode === "SYSTEM") {
			return this._osPrefersDark() ? "DARK" : "LIGHT";
		}
		return mode;
	});

	readonly isDark = computed(() => this.effectiveTheme() === "DARK");

	constructor(
		private readonly api: ApiService,
		private readonly auth: AuthService,
	) {
		// Listen for OS theme changes
		if (typeof window !== "undefined") {
			window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
				this._osPrefersDark.set(e.matches);
			});
		}

		// Apply theme to DOM whenever it changes
		effect(() => {
			const theme = this.effectiveTheme();
			if (typeof document !== "undefined") {
				const el = document.documentElement;
				// Single source of truth for the theme. Every layer keys off this one
				// attribute: primer-light, primer-dark, tokens.css, contrast.css, and
				// PrimeNG's darkModeSelector in app.config.ts. The pre-bootstrap script
				// in index.html sets the same one, and must keep agreeing with this.
				el.setAttribute("data-theme", theme === "DARK" ? "dark" : "light");
			}
		});
	}

	/** Load preferences from backend after login */
	async loadPreferences(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		try {
			const prefs = await this.api.get<UserUiPreferences>("/users/me/ui-preferences", {
				tenant_id: tenantId,
			});
			const raw = prefs.theme ?? null;
			const mode: ThemeMode = isThemeMode(raw) ? raw : "SYSTEM";
			this._themeMode.set(mode);
			localStorage.setItem(THEME_STORAGE_KEY, mode);
		} catch {
			// Backend unavailable — keep whatever was restored locally rather than
			// overwriting a deliberate choice with a default.
		}
	}

	/** Set theme and persist to backend */
	async setTheme(mode: ThemeMode): Promise<void> {
		this._themeMode.set(mode);
		localStorage.setItem(THEME_STORAGE_KEY, mode);

		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		try {
			await this.api.put("/users/me/ui-preferences", { theme: mode }, { tenant_id: tenantId });
		} catch {
			// Silently fail — local state is already updated
		}
	}

	/** Set to default light for login screen (before any user context) */
	setLoginDefault(): void {
		this._themeMode.set("LIGHT");
	}
}
