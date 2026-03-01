import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import type { CreatePackageBody } from "@tartware/schemas";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";

@Component({
	selector: "app-create-package-dialog",
	standalone: true,
	imports: [FormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
	templateUrl: "./create-package-dialog.html",
	styleUrl: "./create-package-dialog.scss",
})
export class CreatePackageDialogComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialogRef = inject(MatDialogRef<CreatePackageDialogComponent>);

	readonly saving = signal(false);
	readonly error = signal<string | null>(null);

	private readonly dateSuffix = new Date().toISOString().slice(0, 10).replace(/-/g, "");

	packageName = "";
	packageCode = "";
	packageType = "room_only";
	shortDescription = "";
	pricingModel = "per_night";
	basePrice: number | null = null;
	validFrom = new Date().toISOString().slice(0, 10);
	validTo = "";
	minNights = 1;
	maxNights: number | null = null;
	minGuests = 1;
	maxGuests: number | null = null;
	refundable = true;
	freeCancellationDays: number | null = null;
	totalInventory: number | null = null;

	// Inclusions
	includesBreakfast = false;
	includesLunch = false;
	includesDinner = false;
	includesParking = false;
	includesWifi = false;
	includesAirportTransfer = false;

	readonly packageTypes = [
		{ key: "room_only", label: "Room Only" },
		{ key: "bed_and_breakfast", label: "Bed & Breakfast" },
		{ key: "half_board", label: "Half Board" },
		{ key: "full_board", label: "Full Board" },
		{ key: "all_inclusive", label: "All Inclusive" },
		{ key: "romance", label: "Romance" },
		{ key: "spa", label: "Spa" },
		{ key: "golf", label: "Golf" },
		{ key: "ski", label: "Ski" },
		{ key: "family", label: "Family" },
		{ key: "business", label: "Business" },
		{ key: "weekend_getaway", label: "Weekend Getaway" },
		{ key: "extended_stay", label: "Extended Stay" },
		{ key: "seasonal", label: "Seasonal" },
		{ key: "custom", label: "Custom" },
	];

	readonly pricingModels = [
		{ key: "per_night", label: "Per Night" },
		{ key: "per_stay", label: "Per Stay" },
		{ key: "per_person", label: "Per Person" },
		{ key: "per_person_per_night", label: "Per Person / Night" },
	];

	onCodeInput(value: string): void {
		this.packageCode = value.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
	}

	get validationErrors(): Record<string, string> {
		const errors: Record<string, string> = {};

		if (!this.packageName.trim()) {
			errors["packageName"] = "Package name is required";
		}

		const code = this.packageCode.trim();
		if (code.length < 2) {
			errors["packageCode"] = "Code must be at least 2 characters";
		} else if (!/^[A-Za-z0-9_-]+$/.test(code)) {
			errors["packageCode"] = "Only letters, numbers, hyphens, and underscores";
		}

		if (this.basePrice == null || this.basePrice < 0) {
			errors["basePrice"] = "Base price is required";
		}

		if (!this.validFrom) {
			errors["validFrom"] = "Valid from date is required";
		}

		if (!this.validTo) {
			errors["validTo"] = "Valid to date is required";
		}

		if (this.validFrom && this.validTo && this.validTo <= this.validFrom) {
			errors["validTo"] = "End date must be after start date";
		}

		if (this.maxNights != null && this.maxNights < this.minNights) {
			errors["maxNights"] = "Cannot be less than min nights";
		}

		if (this.maxGuests != null && this.maxGuests < this.minGuests) {
			errors["maxGuests"] = "Cannot be less than min guests";
		}

		return errors;
	}

	get canSave(): boolean {
		return Object.keys(this.validationErrors).length === 0;
	}

	async save(): Promise<void> {
		if (!this.canSave) return;

		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId) return;

		this.saving.set(true);
		this.error.set(null);

		try {
			const body: Omit<CreatePackageBody, 'tenant_id'> & { tenant_id: string } = {
				tenant_id: tenantId,
				property_id: propertyId ?? undefined,
				package_name: this.packageName.trim(),
				package_code: this.packageCode.trim().toUpperCase(),
				package_type: this.packageType,
				short_description: this.shortDescription.trim() || undefined,
				pricing_model: this.pricingModel,
				base_price: this.basePrice as number,
				valid_from: this.validFrom,
				valid_to: this.validTo,
				min_nights: this.minNights,
				max_nights: this.maxNights ?? undefined,
				min_guests: this.minGuests,
				max_guests: this.maxGuests ?? undefined,
				refundable: this.refundable,
				free_cancellation_days: this.freeCancellationDays ?? undefined,
				total_inventory: this.totalInventory ?? undefined,
				includes_breakfast: this.includesBreakfast,
				includes_lunch: this.includesLunch,
				includes_dinner: this.includesDinner,
				includes_parking: this.includesParking,
				includes_wifi: this.includesWifi,
				includes_airport_transfer: this.includesAirportTransfer,
			};

			await this.api.post("/packages", body);
			this.dialogRef.close(true);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				this.error.set(e.message);
			} else {
				this.error.set(e instanceof Error ? e.message : "Failed to create package");
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
