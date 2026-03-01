import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";

export interface AddComponentDialogData {
	packageId: string;
}

@Component({
	selector: "app-add-component-dialog",
	standalone: true,
	imports: [FormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
	templateUrl: "./add-component-dialog.html",
	styleUrl: "./add-component-dialog.scss",
})
export class AddComponentDialogComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly dialogRef = inject(MatDialogRef<AddComponentDialogComponent>);
	private readonly data: AddComponentDialogData = inject(MAT_DIALOG_DATA);

	readonly saving = signal(false);
	readonly error = signal<string | null>(null);

	componentName = "";
	componentType = "service";
	componentDescription = "";
	quantity = 1;
	pricingType = "included";
	unitPrice = 0;
	isIncluded = true;
	isOptional = false;
	isMandatory = true;
	deliveryTiming = "";
	deliveryLocation = "";
	displayOrder = 0;

	readonly componentTypes = [
		{ key: "service", label: "Service" },
		{ key: "amenity", label: "Amenity" },
		{ key: "meal", label: "Meal" },
		{ key: "activity", label: "Activity" },
		{ key: "transportation", label: "Transportation" },
		{ key: "upgrade", label: "Upgrade" },
		{ key: "credit", label: "Credit" },
		{ key: "voucher", label: "Voucher" },
		{ key: "other", label: "Other" },
	];

	readonly pricingTypes = [
		{ key: "included", label: "Included" },
		{ key: "per_night", label: "Per Night" },
		{ key: "per_stay", label: "Per Stay" },
		{ key: "per_person", label: "Per Person" },
		{ key: "per_person_per_night", label: "Per Person / Night" },
		{ key: "once", label: "Once" },
		{ key: "daily", label: "Daily" },
	];

	readonly deliveryTimings = [
		{ key: "", label: "— None —" },
		{ key: "on_arrival", label: "On Arrival" },
		{ key: "on_departure", label: "On Departure" },
		{ key: "daily", label: "Daily" },
		{ key: "specific_date", label: "Specific Date" },
		{ key: "on_request", label: "On Request" },
		{ key: "anytime", label: "Anytime" },
	];

	typeIcon(type: string): string {
		const map: Record<string, string> = {
			service: "room_service",
			amenity: "spa",
			meal: "restaurant",
			activity: "directions_run",
			transportation: "directions_car",
			upgrade: "upgrade",
			credit: "account_balance_wallet",
			voucher: "card_giftcard",
			other: "category",
		};
		return map[type] ?? "category";
	}

	get validationErrors(): Record<string, string> {
		const errors: Record<string, string> = {};
		if (!this.componentName.trim()) {
			errors["componentName"] = "Component name is required";
		}
		if (this.quantity < 1) {
			errors["quantity"] = "Quantity must be at least 1";
		}
		if (this.unitPrice < 0) {
			errors["unitPrice"] = "Price cannot be negative";
		}
		return errors;
	}

	get canSave(): boolean {
		return Object.keys(this.validationErrors).length === 0;
	}

	async save(): Promise<void> {
		if (!this.canSave) return;

		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.saving.set(true);
		this.error.set(null);

		try {
			await this.api.post(`/packages/${this.data.packageId}/components`, {
				tenant_id: tenantId,
				component_type: this.componentType,
				component_name: this.componentName.trim(),
				component_description: this.componentDescription.trim() || undefined,
				quantity: this.quantity,
				pricing_type: this.pricingType,
				unit_price: this.unitPrice,
				is_included: this.isIncluded,
				is_optional: this.isOptional,
				is_mandatory: this.isMandatory,
				delivery_timing: this.deliveryTiming || undefined,
				delivery_location: this.deliveryLocation.trim() || undefined,
				display_order: this.displayOrder,
			});
			this.dialogRef.close(true);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				this.error.set(e.message);
			} else {
				this.error.set(e instanceof Error ? e.message : "Failed to add component");
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
