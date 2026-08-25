import { registerLocaleData } from "@angular/common";
import { provideHttpClient } from "@angular/common/http";
import localeEs from "@angular/common/locales/es";
import localeFr from "@angular/common/locales/fr";
import localeZhHant from "@angular/common/locales/zh-Hant";
import {
	type ApplicationConfig,
	isDevMode,
	LOCALE_ID,
	provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { provideRouter, withPreloading } from "@angular/router";
import { provideServiceWorker } from "@angular/service-worker";
import Lara from "@primeng/themes/lara";
import { providePrimeNG } from "primeng/config";
import { DialogService } from "primeng/dynamicdialog";

import { routes } from "./app.routes";
import { PermissionPreloadStrategy } from "./core/auth/permission-preload.strategy";
import { storedLocaleId } from "./core/i18n/i18n.service";

// `date`, `number` and `currency` read LOCALE_ID, not the translation catalogue —
// without this every date renders en-US however the UI language is set.
registerLocaleData(localeEs);
registerLocaleData(localeFr);
registerLocaleData(localeZhHant);

export const appConfig: ApplicationConfig = {
	providers: [
		provideHttpClient(),
		provideBrowserGlobalErrorListeners(),
		provideAnimationsAsync(),
		provideRouter(routes, withPreloading(PermissionPreloadStrategy)),
		provideServiceWorker("ngsw-worker.js", {
			enabled: !isDevMode(),
			registrationStrategy: "registerWhenStable:30000",
		}),
		providePrimeNG({
			theme: {
				preset: Lara,
				options: {
					// Matches existing Primer dark-mode selector set by ThemeService
					darkModeSelector: '[data-theme="dark"]',
					cssLayer: { name: "primeng", order: "primeng, app" },
				},
			},
		}),
		DialogService,
		// Read once at bootstrap: Angular resolves LOCALE_ID for the lifetime of the
		// app, so `I18nService.setLanguage` reloads rather than trying to re-provide it.
		{ provide: LOCALE_ID, useFactory: storedLocaleId },
	],
};
