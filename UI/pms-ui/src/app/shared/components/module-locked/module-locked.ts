import { Component, computed, inject, input, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";

import type { ModuleNotEnabledError } from "../../../core/api/api.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { I18nService } from "../../../core/i18n/i18n.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { ModuleRequestService } from "../../../core/modules/module-request.service";
import { ToastService } from "../../toast/toast.service";
import { CalloutComponent } from "../callout/callout";
import { IconComponent } from "../icon/icon";

/**
 * The single answer to "this screen's module is switched off".
 *
 * Every screen renders the same panel, and the panel — not the screen — decides
 * what the user can do about it:
 *
 *   reviewer (OWNER/ADMIN)  → "Open Settings → Modules", the screen they can act on
 *   everyone else           → "Request access", which raises a ticket for them
 *   request already open    → who they are waiting on, no button to press twice
 *
 * Screens pass the error and their own screen key; nothing else.
 *
 * Usage:
 * ```html
 * @if (moduleLocked(); as locked) {
 *   <app-module-locked [error]="locked" screen="reports" />
 * }
 * ```
 */
@Component({
	selector: "app-module-locked",
	standalone: true,
	imports: [CalloutComponent, FormsModule, IconComponent, RouterLink, TranslatePipe],
	templateUrl: "./module-locked.html",
	// Panel chrome comes from the global .callout-* classes; only the reason
	// form below it is specific to this component.
	styles: [
		`
    :host { display: contents; }

    /* Tracks .callout-block so the form lines up under the panel it belongs to. */
    .request-form {
      display: flex;
      flex-direction: column;
      gap: var(--base-size-8);
      max-width: 560px;
      margin: calc(var(--base-size-24) * -1) auto var(--base-size-48);
    }

    .request-form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--base-size-8);
    }

    .badge app-icon {
      font-size: var(--base-text-size-sm);
      margin-right: var(--base-size-4);
    }

    @media (max-width: 600px) {
      .request-form {
        margin: var(--base-size-8) 0 var(--base-size-24);
      }
    }
  `,
	],
})
export class ModuleLockedComponent implements OnInit {
	private readonly requests = inject(ModuleRequestService);
	private readonly i18n = inject(I18nService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);

	/** The error the API threw — carries the module names and the copy. */
	readonly error = input.required<ModuleNotEnabledError>();
	/** Screen key the user was blocked on, shown to the reviewing admin. */
	readonly screen = input<string>("");

	readonly canReview = this.requests.canReview;
	readonly reason = signal("");
	readonly composing = signal(false);
	readonly submitting = signal(false);

	/**
	 * Only the first module is requestable in one go: the error can name several,
	 * but a request is per-module and asking for a bundle would hide which one
	 * the admin is actually approving.
	 */
	readonly moduleId = computed(() => this.error().moduleIds[0] ?? null);

	/** An ask already in flight — theirs, or someone else's for the same module. */
	readonly openRequest = computed(() => {
		const id = this.moduleId();
		return id ? this.requests.pendingRequestFor(id) : null;
	});

	/** Nothing to request when the server did not name a module we recognise. */
	readonly canRequest = computed(() => !this.canReview() && this.moduleId() !== null);

	ngOnInit(): void {
		// Reviewers get the queue, everyone else their own asks; either way this
		// is what tells us whether a request is already open.
		void this.requests.load().catch(() => {
			// A failed lookup only costs the "already requested" hint — the panel
			// still explains the situation, so this is not worth a toast.
		});
	}

	async submit(): Promise<void> {
		const moduleId = this.moduleId();
		if (!moduleId || this.submitting()) return;

		this.submitting.set(true);
		try {
			await this.requests.request({
				moduleId,
				requestedScreen: this.screen() || undefined,
				propertyId: this.ctx.propertyId() ?? undefined,
				reason: this.reason(),
			});
			this.composing.set(false);
			this.reason.set("");
			this.toast.success(this.i18n.t("Your request has been sent to your administrator."));
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : this.i18n.t("Could not send the request."));
		} finally {
			this.submitting.set(false);
		}
	}
}
