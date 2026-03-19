import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { GUEST_TITLES, LOYALTY_TIERS, NATIONALITIES, VIP_STATUSES } from "../../../shared/guest-constants";
import { ToastService } from "../../../shared/toast/toast.service";

export interface EditGuestDialogData {
	id: string;
	first_name: string;
	last_name: string;
	email: string | null;
	phone: string | null;
	title: string | null;
	nationality: string | null;
	gender: string | null;
	date_of_birth: string | Date | null;
	company_name: string | null;
	vip_status: string | null;
	loyalty_tier: string | null;
}

@Component({
	selector: "app-edit-guest-dialog",
	standalone: true,
	imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
	templateUrl: "./edit-guest-dialog.html",
	styleUrl: "./edit-guest-dialog.scss",
})
export class EditGuestDialogComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly dialogRef = inject(MatDialogRef<EditGuestDialogComponent>);
	private readonly toast = inject(ToastService);
	private readonly data = inject<EditGuestDialogData>(MAT_DIALOG_DATA);

	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
	readonly fieldErrors = signal<Record<string, string>>({});

	touched: Record<string, boolean> = {};

	// Form fields — pre-populated from injected guest data
	firstName = this.data.first_name;
	lastName = this.data.last_name;
	email = this.data.email ?? "";

	// Optional personal
	title = this.data.title ?? "";
	phone = this.data.phone ?? "";
	nationality = this.data.nationality ?? "";
	gender = this.data.gender ?? "";
	dateOfBirth = this.formatDateForInput(this.data.date_of_birth);

	// Optional company
	companyName = this.data.company_name ?? "";

	// Optional preferences
	vipStatus = this.data.vip_status ?? "";
	loyaltyTier = this.data.loyalty_tier ?? "";

	readonly titles = GUEST_TITLES;
	readonly vipStatuses = VIP_STATUSES;
	readonly loyaltyTiers = LOYALTY_TIERS;
	readonly nationalities = NATIONALITIES;

	private formatDateForInput(value: string | Date | null | undefined): string {
		if (!value) return "";
		const d = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(d.getTime())) return "";
		return d.toISOString().slice(0, 10);
	}

	markTouched(field: string): void {
		this.touched = { ...this.touched, [field]: true };
	}

	get emailError(): string | null {
		const val = this.email.trim();
		if (!val) return "Email is required";
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "Enter a valid email address";
		return null;
	}

	get phoneError(): string | null {
		const val = this.phone.trim();
		if (!val) return null;
		if (!/^\+?[\d\s()\-.]+$/.test(val))
			return "Phone may only contain digits, spaces, +, -, (, ), and .";
		const digits = val.replace(/\D/g, "");
		if (digits.length < 10 || digits.length > 15)
			return "Phone must contain 10\u201315 digits (e.g. +1 415-555-1234)";
		return null;
	}

	get isValid(): boolean {
		return !!(
			this.firstName.trim() &&
			this.lastName.trim() &&
			this.email.trim() &&
			!this.emailError &&
			!this.phoneError
		);
	}

	hasFieldError(field: string): boolean {
		return !!this.fieldErrors()[field];
	}

	getFieldError(field: string): string {
		return this.fieldErrors()[field] ?? "";
	}

	async save(): Promise<void> {
		if (!this.isValid) return;
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.saving.set(true);
		this.error.set(null);
		this.fieldErrors.set({});

		try {
			const preferences: Record<string, unknown> = {};
			if (this.vipStatus) preferences["vip_status"] = this.vipStatus;
			if (this.loyaltyTier) preferences["loyalty_tier"] = this.loyaltyTier;

			await this.api.post(`/tenants/${tenantId}/guests/${this.data.id}/profile`, {
				first_name: this.firstName.trim(),
				last_name: this.lastName.trim(),
				email: this.email.trim(),
				phone: this.phone.trim() || undefined,
				title: this.title || undefined,
				nationality: this.nationality.trim() || undefined,
				gender: this.gender || undefined,
				date_of_birth: this.dateOfBirth || undefined,
				company_name: this.companyName.trim() || undefined,
				...(Object.keys(preferences).length > 0 ? { preferences } : {}),
			});
			this.dialogRef.close(true);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				const errors: Record<string, string> = {};
				for (const fe of e.fieldErrors) {
					errors[fe.path] = fe.message;
				}
				this.fieldErrors.set(errors);
				this.error.set(e.message);
			} else {
				this.toast.error(e instanceof Error ? e.message : "Failed to update guest");
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
