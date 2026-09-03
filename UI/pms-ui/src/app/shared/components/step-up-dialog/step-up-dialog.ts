import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import type { StepUpGrantResponse } from "@tartware/schemas";
import { DynamicDialogConfig, DynamicDialogRef } from "primeng/dynamicdialog";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { DialogActionsComponent } from "../dialog-actions/dialog-actions";
import { DialogShellComponent } from "../dialog-shell/dialog-shell";

/** What the caller must say to ask for an authorisation. */
export type StepUpDialogData = {
	/** The command being authorised. */
	commandName: string;
	/** The record it will act on, when there is one. */
	entityId?: string | null;
	propertyId?: string | null;
	/** What the operator is being stopped from doing, in their words. */
	action: string;
};

/**
 * A supervisor authorises one override, at the terminal.
 *
 * **The gap this closes.** The override audit ended with one sentence standing:
 * authority is checked, never re-proven. Every override point measured the
 * session that happened to be open, so a clerk with a guest in front of them
 * needing a manager's authority for thirty seconds had two options — a queued
 * approval, or a manager logging them out of their own terminal. This is the
 * third: the supervisor types their own credentials here, and what comes back
 * authorises one command on one record, once, for five minutes.
 *
 * **What the operator is not given.** Not a session, not a token, not the
 * supervisor's identity to keep using — a grant id. The password never reaches
 * the gateway; core-service owns verification, so account lockout, throttling
 * and MFA behave exactly as they do at login rather than being reimplemented on
 * a second path.
 *
 * **What this component does not decide.** Whether the supervisor's role is
 * actually high enough. That depends on the reason code the payload names, which
 * is resolved at apply time — so a grant can be issued and the command still
 * refused, with the gate saying so. Deciding it here would be a second copy of
 * an authority rule, which is how two ends of a control come to disagree.
 */
@Component({
	selector: "app-step-up-dialog",
	standalone: true,
	imports: [DialogActionsComponent, DialogShellComponent, FormsModule, TranslatePipe],
	template: `
    <app-dialog-shell icon="admin_panel_settings" heading="Supervisor authorisation">
      <div class="form-fields">
        <p class="text-subtle">
          {{ 'A supervisor must authorise this: {action}. They enter their own credentials — this does not sign you out.'
              | translate:{ action: data.action } }}
        </p>

        @if (error(); as message) {
          <p class="notice notice-error">{{ message }}</p>
        }

        <div class="form-group">
          <label class="field-label" for="su-user">{{ 'Supervisor username' | translate }} *</label>
          <input class="field-input" id="su-user" name="su-user" autocomplete="off"
                 [ngModel]="username()" (ngModelChange)="username.set($event ?? '')" />
        </div>

        <div class="form-group">
          <label class="field-label" for="su-pass">{{ 'Supervisor password' | translate }} *</label>
          <input class="field-input" id="su-pass" name="su-pass" type="password"
                 autocomplete="off"
                 [ngModel]="password()" (ngModelChange)="password.set($event ?? '')" />
        </div>

        <div class="form-group">
          <label class="field-label" for="su-mfa">{{ 'Authentication code' | translate }}</label>
          <input class="field-input" id="su-mfa" name="su-mfa" inputmode="numeric"
                 autocomplete="off"
                 [ngModel]="mfaCode()" (ngModelChange)="mfaCode.set($event ?? '')" />
          <p class="field-hint">{{ 'Only if the supervisor has two-factor enabled.' | translate }}</p>
        </div>

        <p class="field-hint field-hint-muted">
          {{ 'The authorisation covers this one action on this one record, expires in five minutes, and is recorded against the supervisor.' | translate }}
        </p>
      </div>

      <app-dialog-actions dialogFooter
                          [saving]="submitting()"
                          [valid]="canSubmit()"
                          saveLabel="Authorise"
                          savingLabel="Checking…"
                          (cancel)="close()"
                          (save)="submit()" />
    </app-dialog-shell>
  `,
})
export class StepUpDialogComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ref = inject(DynamicDialogRef);
	private readonly config = inject(DynamicDialogConfig);

	readonly data = this.config.data as StepUpDialogData;

	readonly username = signal("");
	readonly password = signal("");
	readonly mfaCode = signal("");
	readonly submitting = signal(false);
	readonly error = signal("");

	readonly canSubmit = computed(
		() => this.username().trim().length > 0 && this.password().length > 0,
	);

	close(): void {
		this.ref.close(null);
	}

	async submit(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId || !this.canSubmit() || this.submitting()) return;

		this.submitting.set(true);
		this.error.set("");
		try {
			const grant = await this.api.post<StepUpGrantResponse>(
				`/tenants/${tenantId}/commands/step-up`,
				{
					username: this.username().trim(),
					password: this.password(),
					...(this.mfaCode().trim() ? { mfa_code: this.mfaCode().trim() } : {}),
					command_name: this.data.commandName,
					entity_id: this.data.entityId ?? null,
					property_id: this.data.propertyId ?? null,
				},
			);
			this.ref.close(grant);
		} catch (e) {
			// Shown in the dialog rather than as a toast: the supervisor is standing
			// here and needs to try again in the field they just typed in.
			this.error.set(e instanceof Error ? e.message : "That was not accepted.");
			this.password.set("");
		} finally {
			this.submitting.set(false);
		}
	}
}
