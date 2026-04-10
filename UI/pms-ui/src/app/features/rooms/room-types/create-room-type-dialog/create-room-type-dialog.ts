import { Component, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import type { RoomTypeGridItem } from "@tartware/schemas";

import { ApiService, ApiValidationError } from "../../../../core/api/api.service";
import { AuthService } from "../../../../core/auth/auth.service";
import { TenantContextService } from "../../../../core/context/tenant-context.service";
import { DialogActionsComponent } from "../../../../shared/components/dialog-actions/dialog-actions";
import { ToastService } from "../../../../shared/toast/toast.service";

const ROOM_CATEGORIES = [
	"STANDARD",
	"DELUXE",
	"SUPERIOR",
	"SUITE",
	"JUNIOR_SUITE",
	"PRESIDENTIAL",
	"VILLA",
	"APARTMENT",
	"STUDIO",
	"PENTHOUSE",
	"BUNGALOW",
	"COTTAGE",
	"CABIN",
	"ACCESSIBLE",
	"CONNECTING",
	"FAMILY",
	"DORMITORY",
	"CAPSULE",
	"OTHER",
];

@Component({
	selector: "app-create-room-type-dialog",
	standalone: true,
	imports: [
		FormsModule,
		MatButtonModule,
		MatDialogModule,
		MatIconModule,
		MatProgressSpinnerModule,
		DialogActionsComponent,
	],
	templateUrl: "./create-room-type-dialog.html",
	styleUrl: "./create-room-type-dialog.scss",
})
export class CreateRoomTypeDialogComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialogRef = inject(MatDialogRef<CreateRoomTypeDialogComponent>);
	private readonly toast = inject(ToastService);
	private readonly data = inject<RoomTypeGridItem | null>(MAT_DIALOG_DATA, { optional: true });

	readonly saving = signal(false);
	readonly categories = ROOM_CATEGORIES;

	touched: Record<string, boolean> = {};

	get isEditMode(): boolean {
		return !!this.data;
	}

	// Form fields
	typeName = "";
	typeCode = "";
	description = "";
	shortDescription = "";
	category = "STANDARD";
	baseOccupancy = 2;
	maxOccupancy = 2;
	maxAdults = 2;
	maxChildren = 0;
	extraBedCapacity = 0;
	sizeSqm: number | null = null;
	bedType = "";
	numberOfBeds = 1;
	basePrice = 0;
	currency = "USD";
	displayOrder = 0;
	isActive = true;

	ngOnInit(): void {
		if (this.data) {
			this.typeName = this.data.type_name;
			this.typeCode = this.data.type_code;
			this.description = this.data.description ?? "";
			this.shortDescription = this.data.short_description ?? "";
			this.category = this.data.category ?? "STANDARD";
			this.baseOccupancy = this.data.base_occupancy;
			this.maxOccupancy = this.data.max_occupancy;
			this.maxAdults = this.data.max_adults;
			this.maxChildren = this.data.max_children ?? 0;
			this.extraBedCapacity = this.data.extra_bed_capacity ?? 0;
			this.sizeSqm = this.data.size_sqm ?? null;
			this.bedType = this.data.bed_type ?? "";
			this.numberOfBeds = this.data.number_of_beds ?? 1;
			this.basePrice = this.data.base_price;
			this.currency = this.data.currency ?? "USD";
			this.displayOrder = this.data.display_order ?? 0;
			this.isActive = this.data.is_active;
		}
	}

	get isValid(): boolean {
		const hasRequiredFields = !!(
			this.typeName.trim() &&
			this.typeCode.trim() &&
			this.basePrice >= 0
		);

		if (this.isEditMode) {
			return hasRequiredFields;
		}

		return hasRequiredFields && !!this.ctx.propertyId();
	}

	markTouched(field: string): void {
		this.touched = { ...this.touched, [field]: true };
	}

	async save(): Promise<void> {
		if (!this.isValid) return;
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.saving.set(true);

		const body = {
			tenant_id: tenantId,
			property_id: this.isEditMode && this.data ? this.data.property_id : this.ctx.propertyId(),
			type_name: this.typeName.trim(),
			type_code: this.typeCode.trim(),
			description: this.description.trim() || undefined,
			short_description: this.shortDescription.trim() || undefined,
			category: this.category || undefined,
			base_occupancy: this.baseOccupancy,
			max_occupancy: this.maxOccupancy,
			max_adults: this.maxAdults,
			max_children: this.maxChildren,
			extra_bed_capacity: this.extraBedCapacity,
			size_sqm: this.sizeSqm ?? undefined,
			bed_type: this.bedType.trim() || undefined,
			number_of_beds: this.numberOfBeds,
			base_price: this.basePrice,
			currency: this.currency || undefined,
			display_order: this.displayOrder,
			is_active: this.isActive,
		};

		try {
			if (this.isEditMode && this.data) {
				await this.api.put(`/room-types/${this.data.room_type_id}`, body);
			} else {
				await this.api.post("/room-types", body);
			}
			this.dialogRef.close(true);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				this.toast.error(e.fieldErrors.map((fe) => fe.message).join("; "));
			} else {
				this.toast.error(
					e instanceof Error
						? e.message
						: `Failed to ${this.isEditMode ? "update" : "create"} room type`,
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
