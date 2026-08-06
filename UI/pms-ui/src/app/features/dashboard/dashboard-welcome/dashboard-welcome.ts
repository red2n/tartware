import { Component, computed, input } from "@angular/core";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";

/** Greeting for the hour, in the same voice as the login headline. */
export function greetingFor(hour: number): string {
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

/**
 * The handshake between the login room and the working app.
 *
 * Login is a lit room — warm dark ground, brass rule grid, a Cormorant
 * headline with a brass italic. Reproducing that wholesale behind nine data
 * cards would hurt reading, so only this band speaks it, and everything below
 * stays on the Primer surface the rest of the app uses. It replaces
 * app-page-header on the dashboard alone: the one screen you land on.
 */
@Component({
	selector: "app-dashboard-welcome",
	standalone: true,
	imports: [TranslatePipe],
	template: `
    <header class="welcome-band">
      <div class="welcome-rules" aria-hidden="true"></div>
      <div class="welcome-glow" aria-hidden="true"></div>

      <div class="welcome-text">
        <p class="welcome-eyebrow">{{ 'Property Management Suite' | translate }}</p>
        <h1 class="welcome-headline">
          {{ greeting() | translate }},<em>{{ name() }}</em>
        </h1>
        <p class="welcome-meta">
          @if (property()) {
            <span>{{ property() }}</span>
            <span class="welcome-meta-dot" aria-hidden="true">·</span>
          }
          <span>{{ today() }}</span>
        </p>
      </div>

      <div class="welcome-actions">
        <ng-content />
      </div>
    </header>
  `,
	styleUrl: "./dashboard-welcome.scss",
})
export class DashboardWelcomeComponent {
	/** Who to greet — falls back to a neutral greeting when unknown. */
	readonly name = input("");
	readonly property = input("");
	/** Injectable for tests; defaults to now. */
	readonly now = input<Date>(new Date());

	readonly greeting = computed(() => greetingFor(this.now().getHours()));

	readonly today = computed(() =>
		this.now().toLocaleDateString(undefined, {
			weekday: "long",
			day: "numeric",
			month: "long",
		}),
	);
}
