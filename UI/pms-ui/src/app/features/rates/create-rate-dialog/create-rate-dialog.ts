import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";

@Component({
	selector: "app-create-rate-dialog",
	standalone: true,
	imports: [
		FormsModule,
		MatDialogModule,
		MatIconModule,
		MatProgressSpinnerModule,
	],
	templateUrl: "./create-rate-dialog.html",
	styleUrl: "./create-rate-dialog.scss",
})
export class CreateRateDialogComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly dialogRef = inject(MatDialogRef<CreateRateDialogComponent>);

	readonly saving = signal(false);
	readonly error = signal<string | null>(null);

	private readonly dateSuffix = new Date()
		.toISOString()
		.slice(0, 10)
		.replace(/-/g, "");

	rateName = `New Rate Plan ${this.dateSuffix}`;
	rateCode = `NRP${this.dateSuffix}`;
	description = "";
	rateType = "BAR";
	strategy = "FIXED";
	baseRate: number | null = 0.01;
	currency = "USD";
	singleOccupancyRate: number | null = 0.01;
	doubleOccupancyRate: number | null = 0.01;
	extraPersonRate: number | null = null;
	validFrom = new Date().toISOString().slice(0, 10);
	validUntil = "";
	mealPlan = "RO";
	status = "INACTIVE";
	priority = 100;

	readonly rateTypes = [
		{ key: "BAR", label: "Best Available Rate" },
		{ key: "RACK", label: "Rack Rate" },
		{ key: "CORPORATE", label: "Corporate" },
		{ key: "PROMO", label: "Promotional" },
		{ key: "NON_REFUNDABLE", label: "Non-refundable" },
		{ key: "FLEXIBLE", label: "Flexible" },
		{ key: "EARLYBIRD", label: "Early Bird" },
		{ key: "LASTMINUTE", label: "Last Minute" },
		{ key: "GOVERNMENT", label: "Government" },
		{ key: "TRAVEL_AGENT", label: "Travel Agent" },
		{ key: "LOS", label: "Length of Stay" },
		{ key: "COMP", label: "Complimentary" },
		{ key: "HOUSE", label: "House Use" },
	];

	readonly strategies = [
		{ key: "FIXED", label: "Fixed" },
		{ key: "DYNAMIC", label: "Dynamic" },
		{ key: "SEASONAL", label: "Seasonal" },
	];

	readonly mealPlans = [
		{ key: "RO", label: "Room Only" },
		{ key: "BB", label: "Bed & Breakfast" },
		{ key: "HB", label: "Half Board" },
		{ key: "FB", label: "Full Board" },
		{ key: "AI", label: "All Inclusive" },
	];

	onRateCodeInput(value: string): void {
		this.rateCode = value.toUpperCase();
	}

	/** Whether this rate type allows a zero base rate (complimentary / house use). */
	private get isZeroRateAllowed(): boolean {
		return this.rateType === "COMP" || this.rateType === "HOUSE";
	}

	get validationErrors(): Record<string, string> {
		const errors: Record<string, string> = {};

		if (!this.rateName.trim()) {
			errors["rateName"] = "Rate name is required";
		}

		const code = this.rateCode.trim();
		if (code.length < 2) {
			errors["rateCode"] = "Rate code must be at least 2 characters";
		} else if (!/^[A-Za-z0-9_-]+$/.test(code)) {
			errors["rateCode"] = "Only letters, numbers, hyphens, and underscores";
		}

		if (this.baseRate == null || this.baseRate < 0) {
			errors["baseRate"] = "Base rate is required";
		} else if (this.baseRate === 0 && !this.isZeroRateAllowed) {
			errors["baseRate"] =
				"Base rate must be greater than 0 (except COMP/HOUSE)";
		}

		if (
			this.singleOccupancyRate != null &&
			this.baseRate != null &&
			this.singleOccupancyRate > this.baseRate
		) {
			errors["sglRate"] = "Single occupancy cannot exceed base rate";
		}

		if (
			this.doubleOccupancyRate != null &&
			this.baseRate != null &&
			this.doubleOccupancyRate > this.baseRate * 2
		) {
			errors["dblRate"] = "Double occupancy cannot exceed 2× base rate";
		}

		if (!this.validFrom) {
			errors["validFrom"] = "Valid from date is required";
		}

		if (
			this.validUntil &&
			this.validFrom &&
			this.validUntil <= this.validFrom
		) {
			errors["validUntil"] = "End date must be after start date";
		}

		if (this.priority < 0 || this.priority > 999) {
			errors["priority"] = "Priority must be 0–999";
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
			// We need property_id and room_type_id — for now use defaults from tenant context
			// These should ideally be selectable in a more comprehensive form
			const body: Record<string, unknown> = {
				tenant_id: tenantId,
				property_id: "22222222-2222-2222-2222-222222222222",
				room_type_id: "44444444-4444-4444-4444-444444444444",
				rate_name: this.rateName.trim(),
				rate_code: this.rateCode.trim().toUpperCase(),
				description: this.description.trim() || undefined,
				rate_type: this.rateType,
				strategy: this.strategy,
				priority: this.priority,
				base_rate: this.baseRate,
				currency: this.currency,
				single_occupancy_rate: this.singleOccupancyRate ?? undefined,
				double_occupancy_rate: this.doubleOccupancyRate ?? undefined,
				extra_person_rate: this.extraPersonRate ?? undefined,
				valid_from: this.validFrom,
				valid_until: this.validUntil || undefined,
				meal_plan: this.mealPlan,
				status: this.status,
			};

			await this.api.post("/rates", body);
			this.dialogRef.close(true);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to create rate");
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
