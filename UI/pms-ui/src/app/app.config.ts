import { provideHttpClient } from "@angular/common/http";
import {
	type ApplicationConfig,
	isDevMode,
	provideBrowserGlobalErrorListeners,
} from "@angular/core";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { PreloadAllModules, provideRouter, withPreloading } from "@angular/router";
import { provideServiceWorker } from "@angular/service-worker";
import Lara from "@primeng/themes/lara";
import { providePrimeNG } from "primeng/config";
import { DialogService } from "primeng/dynamicdialog";

import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
	providers: [
		provideHttpClient(),
		provideBrowserGlobalErrorListeners(),
		provideAnimationsAsync(),
		provideRouter(routes, withPreloading(PreloadAllModules)),
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
					cssLayer: { name: "primeng", order: "tailwind-base, primeng, app" },
				},
			},
		}),
		DialogService,
	],
};
