import { Component, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";

type Property = { id: string; property_name: string };

@Component({
	selector: "app-create-guest-dialog",
	standalone: true,
	imports: [
		FormsModule,
		MatButtonModule,
		MatDialogModule,
		MatIconModule,
		MatProgressSpinnerModule,
	],
	templateUrl: "./create-guest-dialog.html",
	styleUrl: "./create-guest-dialog.scss",
})
export class CreateGuestDialogComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialogRef = inject(MatDialogRef<CreateGuestDialogComponent>);

	readonly properties = signal<Property[]>([]);
	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
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
	vipStatus = false;
	loyaltyTier = "";

	readonly titles = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."];
	readonly loyaltyTiers = ["BASE", "SILVER", "GOLD", "PLATINUM", "ELITE"];

	ngOnInit(): void {
		this.loadReferenceData();
	}

	async loadReferenceData(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		try {
			const properties = await this.api.get<Property[]>("/properties", {
				tenant_id: tenantId,
			});
			this.properties.set(properties);
		} catch {
			this.error.set("Failed to load reference data");
		}
	}

	markTouched(field: string): void {
		this.touched = { ...this.touched, [field]: true };
	}

	get emailError(): string | null {
		const val = this.email.trim();
		if (!val) return "Email is required";
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))
			return "Enter a valid email address";
		return null;
	}

	get phoneError(): string | null {
		const val = this.phone.trim();
		if (!val) return null; // phone is optional
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
			// Build preferences (part of GuestRegisterCommandSchema)
			const preferences: Record<string, unknown> = {};
			if (this.vipStatus) preferences["vip_status"] = true;
			if (this.loyaltyTier) preferences["loyalty_tier"] = this.loyaltyTier;

			// Extra fields go into metadata for downstream processing
			const metadata: Record<string, unknown> = {};
			if (this.title) metadata["title"] = this.title;
			if (this.nationality.trim())
				metadata["nationality"] = this.nationality.trim();
			if (this.gender) metadata["gender"] = this.gender;
			if (this.dateOfBirth) metadata["date_of_birth"] = this.dateOfBirth;
			if (this.companyName.trim())
				metadata["company_name"] = this.companyName.trim();

			await this.api.post("/guests", {
				tenant_id: tenantId,
				first_name: this.firstName.trim(),
				last_name: this.lastName.trim(),
				email: this.email.trim(),
				phone: this.phone.trim() || undefined,
				...(Object.keys(preferences).length > 0 ? { preferences } : {}),
				...(Object.keys(metadata).length > 0 ? { metadata } : {}),
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
				this.error.set(
					e instanceof Error ? e.message : "Failed to create guest",
				);
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
