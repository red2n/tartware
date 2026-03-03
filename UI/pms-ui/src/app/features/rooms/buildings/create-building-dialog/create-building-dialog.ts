import { Component, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import type { BuildingItem } from "@tartware/schemas";

import { ApiService, ApiValidationError } from "../../../../core/api/api.service";
import { AuthService } from "../../../../core/auth/auth.service";
import { TenantContextService } from "../../../../core/context/tenant-context.service";

type Property = { id: string; property_name: string };

const BUILDING_TYPES = [
	"MAIN",
	"WING",
	"TOWER",
	"ANNEX",
	"VILLA",
	"COTTAGE",
	"BUNGALOW",
	"CONFERENCE",
	"SPA",
	"RECREATION",
	"OTHER",
];

const BUILDING_STATUSES = ["OPERATIONAL", "RENOVATION", "CLOSED", "SEASONAL"];

@Component({
	selector: "app-create-building-dialog",
	standalone: true,
	imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
	templateUrl: "./create-building-dialog.html",
	styleUrl: "./create-building-dialog.scss",
})
export class CreateBuildingDialogComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialogRef = inject(MatDialogRef<CreateBuildingDialogComponent>);
	private readonly data = inject<BuildingItem | null>(MAT_DIALOG_DATA, { optional: true });

	readonly properties = signal<Property[]>([]);
	readonly saving = signal(false);
	readonly error = signal<string | null>(null);
	readonly buildingTypes = BUILDING_TYPES;
	readonly buildingStatuses = BUILDING_STATUSES;

	touched: Record<string, boolean> = {};

	get isEditMode(): boolean {
		return !!this.data;
	}

	// Form fields
	buildingCode = "";
	buildingName = "";
	buildingType = "MAIN";
	buildingStatus = "OPERATIONAL";
	propertyId = "";
	floorCount: number | null = null;
	basementFloors = 0;
	totalRooms = 0;
	wheelchairAccessible = true;
	elevatorCount = 0;
	hasLobby = false;
	hasPool = false;
	hasGym = false;
	hasSpa = false;
	hasRestaurant = false;
	hasParking = false;
	parkingSpaces = 0;
	yearBuilt: number | null = null;
	lastRenovationYear: number | null = null;
	guestDescription = "";
	internalNotes = "";
	isActive = true;

	ngOnInit(): void {
		this.loadProperties();

		if (this.data) {
			this.buildingCode = this.data.building_code;
			this.buildingName = this.data.building_name;
			this.buildingType = this.data.building_type ?? "MAIN";
			this.buildingStatus = this.data.building_status ?? "OPERATIONAL";
			this.propertyId = this.data.property_id;
			this.floorCount = this.data.floor_count ?? null;
			this.basementFloors = this.data.basement_floors ?? 0;
			this.totalRooms = this.data.total_rooms ?? 0;
			this.wheelchairAccessible = this.data.wheelchair_accessible ?? true;
			this.elevatorCount = this.data.elevator_count ?? 0;
			this.hasLobby = this.data.has_lobby ?? false;
			this.hasPool = this.data.has_pool ?? false;
			this.hasGym = this.data.has_gym ?? false;
			this.hasSpa = this.data.has_spa ?? false;
			this.hasRestaurant = this.data.has_restaurant ?? false;
			this.hasParking = this.data.has_parking ?? false;
			this.parkingSpaces = this.data.parking_spaces ?? 0;
			this.yearBuilt = this.data.year_built ?? null;
			this.lastRenovationYear = this.data.last_renovation_year ?? null;
			this.guestDescription = this.data.guest_description ?? "";
			this.internalNotes = this.data.internal_notes ?? "";
			this.isActive = this.data.is_active;
		}
	}

	async loadProperties(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		try {
			const properties = await this.api.get<Property[]>("/properties", {
				tenant_id: tenantId,
			});
			this.properties.set(properties);

			if (!this.isEditMode && properties.length === 1) {
				this.propertyId = properties[0].id;
			}
		} catch {
			this.error.set("Failed to load properties");
		}
	}

	get isValid(): boolean {
		return !!(this.buildingCode.trim() && this.buildingName.trim() && this.propertyId);
	}

	markTouched(field: string): void {
		this.touched = { ...this.touched, [field]: true };
	}

	async save(): Promise<void> {
		if (!this.isValid) return;
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.saving.set(true);
		this.error.set(null);

		const body = {
			tenant_id: tenantId,
			property_id: this.propertyId,
			building_code: this.buildingCode.trim(),
			building_name: this.buildingName.trim(),
			building_type: this.buildingType,
			building_status: this.buildingStatus,
			floor_count: this.floorCount ?? undefined,
			basement_floors: this.basementFloors,
			total_rooms: this.totalRooms,
			wheelchair_accessible: this.wheelchairAccessible,
			elevator_count: this.elevatorCount,
			has_lobby: this.hasLobby,
			has_pool: this.hasPool,
			has_gym: this.hasGym,
			has_spa: this.hasSpa,
			has_restaurant: this.hasRestaurant,
			has_parking: this.hasParking,
			parking_spaces: this.parkingSpaces,
			year_built: this.yearBuilt ?? undefined,
			last_renovation_year: this.lastRenovationYear ?? undefined,
			guest_description: this.guestDescription.trim() || undefined,
			internal_notes: this.internalNotes.trim() || undefined,
			is_active: this.isActive,
		};

		try {
			if (this.isEditMode && this.data) {
				await this.api.put(`/buildings/${this.data.building_id}`, body);
			} else {
				await this.api.post("/buildings", body);
			}
			this.dialogRef.close(true);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				this.error.set(e.fieldErrors.map((fe) => fe.message).join("; "));
			} else {
				this.error.set(
					e instanceof Error
						? e.message
						: `Failed to ${this.isEditMode ? "update" : "create"} building`,
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
