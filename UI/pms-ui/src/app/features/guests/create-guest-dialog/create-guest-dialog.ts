import { Component, inject, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { DialogActionsComponent } from "../../../shared/components/dialog-actions/dialog-actions";
import { ToastService } from "../../../shared/toast/toast.service";
import { GuestFormFieldsComponent } from "../guest-form-fields/guest-form-fields";
import {
	isGuestFormValid,
	markFieldTouched,
	validateEmail,
	validatePhone,
} from "../guest-form-utils";

import { TranslatePipe } from "../../../core/i18n/translate.pipe";
@Component({
	selector: "app-create-guest-dialog",
	standalone: true,
	imports: [
		MatButtonModule,
		MatDialogModule,
		MatIconModule,
		MatProgressSpinnerModule,
		DialogActionsComponent,
		GuestFormFieldsComponent,
		TranslatePipe,
	],
	templateUrl: "./create-guest-dialog.html",
	styleUrl: "./create-guest-dialog.scss",
})
export class CreateGuestDialogComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly dialogRef = inject(MatDialogRef<CreateGuestDialogComponent>);
	private readonly toast = inject(ToastService);

	readonly saving = signal(false);
	readonly fieldErrors = signal<Record<string, string>>({});

	touched: Record<string, boolean> = {};

	// Form fields — required
	firstName = "";
	lastName = "";
	email = "";

	// Form fields — optional personal
	title = "";
	phone = "";
	nationality = "";
	gender = "";
	dateOfBirth = "";

	// Form fields — optional company
	companyName = "";

	// Form fields — optional preferences
	vipStatus = "";
	loyaltyTier = "";

	markTouched(field: string): void {
		this.touched = markFieldTouched(this.touched, field);
	}

	get emailError(): string | null {
		return validateEmail(this.email);
	}

	get phoneError(): string | null {
		return validatePhone(this.phone);
	}

	get isValid(): boolean {
		return isGuestFormValid(this);
	}

	async save(): Promise<void> {
		if (!this.isValid) return;
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.saving.set(true);
		this.fieldErrors.set({});

		try {
			// Build preferences (part of GuestRegisterCommandSchema)
			const preferences: Record<string, unknown> = {};
			if (this.vipStatus) preferences["vip_status"] = this.vipStatus;
			if (this.loyaltyTier) preferences["loyalty_tier"] = this.loyaltyTier;

			await this.api.post("/guests", {
				tenant_id: tenantId,
				first_name: this.firstName.trim(),
				last_name: this.lastName.trim(),
				email: this.email.trim(),
				phone: this.phone.trim() || undefined,
				title: this.title || undefined,
				nationality: this.nationality.trim() || undefined,
				gender: this.gender || undefined,
				date_of_birth: this.dateOfBirth || undefined,
				loyalty_tier: this.loyaltyTier || undefined,
				...(Object.keys(preferences).length > 0 ? { preferences } : {}),
			});
			this.dialogRef.close(true);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				const errors: Record<string, string> = {};
				for (const fe of e.fieldErrors) {
					errors[fe.path] =
						fe.path === "date_of_birth" ? "Please enter a valid date (DD/MM/YYYY)" : fe.message;
				}
				this.fieldErrors.set(errors);
				this.toast.error(e.message);
			} else {
				this.toast.error(e instanceof Error ? e.message : "Failed to create guest");
				this.dialogRef.close(false);
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
