import { Component, inject, type OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import { ApiService, ApiValidationError } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";

type RoomType = { room_type_id: string; type_name: string };
type Building = { building_id: string; building_code: string; building_name: string };

@Component({
	selector: "app-create-room-dialog",
	standalone: true,
	imports: [FormsModule, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
	templateUrl: "./create-room-dialog.html",
	styleUrl: "./create-room-dialog.scss",
})
export class CreateRoomDialogComponent implements OnInit {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialogRef = inject(MatDialogRef<CreateRoomDialogComponent>);

	readonly roomTypes = signal<RoomType[]>([]);
	readonly buildings = signal<Building[]>([]);
	readonly saving = signal(false);
	readonly error = signal<string | null>(null);

	touched: Record<string, boolean> = {};

	// Form fields
	roomNumber = "";
	roomName = "";
	roomTypeId = "";
	floor = "";
	buildingId = "";
	wing = "";

	ngOnInit(): void {
		this.loadReferenceData();
	}

	async loadReferenceData(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		try {
			const [roomTypes, buildings] = await Promise.all([
				this.api.get<RoomType[]>("/room-types", { tenant_id: tenantId }),
				this.api.get<Building[]>("/buildings", { tenant_id: tenantId }),
			]);
			this.roomTypes.set(roomTypes);
			this.buildings.set(buildings);
		} catch {
			this.error.set("Failed to load reference data");
		}
	}

	get isValid(): boolean {
		return !!(this.roomNumber.trim() && this.roomTypeId && this.ctx.propertyId());
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

		try {
			const selectedBuilding = this.buildings().find((b) => b.building_id === this.buildingId);
			await this.api.post("/rooms", {
				tenant_id: tenantId,
				property_id: this.ctx.propertyId(),
				room_type_id: this.roomTypeId,
				room_number: this.roomNumber.trim(),
				room_name: this.roomName.trim() || undefined,
				floor: this.floor.trim() || undefined,
				building: selectedBuilding?.building_name || undefined,
				wing: this.wing.trim() || undefined,
			});
			this.dialogRef.close(true);
		} catch (e) {
			if (e instanceof ApiValidationError) {
				this.error.set(e.fieldErrors.map((fe) => fe.message).join("; "));
			} else {
				this.error.set(e instanceof Error ? e.message : "Failed to create room");
			}
		} finally {
			this.saving.set(false);
		}
	}

	cancel(): void {
		this.dialogRef.close(false);
	}
}
