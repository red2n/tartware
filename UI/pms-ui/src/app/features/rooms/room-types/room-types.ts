import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { RoomTypeItem } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../../shared/sort-utils";
import { ToastService } from "../../../shared/toast/toast.service";

@Component({
	selector: "app-room-types",
	standalone: true,
	imports: [
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PaginationComponent,
	],
	templateUrl: "./room-types.html",
	styleUrl: "./room-types.scss",
})
export class RoomTypesComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialog = inject(MatDialog);
	private readonly toast = inject(ToastService);

	readonly roomTypes = signal<RoomTypeItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly searchQuery = signal("");
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();

	readonly filteredRoomTypes = computed(() => {
		let list = this.roomTypes();
		const query = this.searchQuery().toLowerCase().trim();

		if (query) {
			list = list.filter(
				(rt) =>
					rt.type_name.toLowerCase().includes(query) ||
					rt.type_code.toLowerCase().includes(query) ||
					(rt.description?.toLowerCase().includes(query) ?? false) ||
					(rt.category?.toLowerCase().includes(query) ?? false),
			);
		}

		return list;
	});

	readonly paginatedRoomTypes = computed(() => {
		const sorted = sortBy(
			this.filteredRoomTypes(),
			this.sortState().column,
			this.sortState().direction,
		);
		const start = (this.currentPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadRoomTypes();
		});

		effect(
			() => {
				const maxPage = Math.max(
					1,
					Math.ceil(this.filteredRoomTypes().length / this.pageSize),
				);
				if (this.currentPage() > maxPage) {
					this.currentPage.set(maxPage);
				}
			},
			{ allowSignalWrites: true },
		);
	}

	onSearch(value: string): void {
		this.searchQuery.set(value);
		this.currentPage.set(1);
	}

	onSort(column: string): void {
		this.sortState.set(toggleSort(this.sortState(), column));
		this.currentPage.set(1);
	}

	sortIcon(column: string): string {
		const s = this.sortState();
		if (s.column !== column) return "unfold_more";
		return s.direction === "asc" ? "arrow_upward" : "arrow_downward";
	}

	ariaSort(column: string): string | null {
		const s = this.sortState();
		if (s.column !== column) return null;
		return s.direction === "asc" ? "ascending" : "descending";
	}

	async loadRoomTypes(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const roomTypes = await this.api.get<RoomTypeItem[]>("/room-types", params);
			this.roomTypes.set(roomTypes);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load room types");
		} finally {
			this.loading.set(false);
		}
	}

	openCreateDialog(): void {
		import("./create-room-type-dialog/create-room-type-dialog").then(
			({ CreateRoomTypeDialogComponent }) => {
				const ref = this.dialog.open(CreateRoomTypeDialogComponent, {
					width: "580px",
					disableClose: true,
				});
				ref.afterClosed().subscribe((created: boolean) => {
					if (created) {
						this.toast.success("Room type created successfully.");
						this.loadRoomTypes();
					}
				});
			},
		);
	}

	openEditDialog(roomType: RoomTypeItem): void {
		import("./create-room-type-dialog/create-room-type-dialog").then(
			({ CreateRoomTypeDialogComponent }) => {
				const ref = this.dialog.open(CreateRoomTypeDialogComponent, {
					width: "580px",
					disableClose: true,
					data: roomType,
				});
				ref.afterClosed().subscribe((saved: boolean) => {
					if (saved) {
						this.toast.success("Room type updated successfully.");
						this.loadRoomTypes();
					}
				});
			},
		);
	}

	async deleteRoomType(rt: RoomTypeItem, event: Event): Promise<void> {
		event.stopPropagation();
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		if (!confirm(`Delete room type "${rt.type_name}"?`)) return;

		try {
			await this.api.delete(`/room-types/${rt.room_type_id}`, {
				tenant_id: tenantId,
			});
			this.toast.success("Room type deleted.");
			this.loadRoomTypes();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to delete room type");
		}
	}

	currencyLabel(amount: number, currency?: string): string {
		return `${currency ?? "USD"} ${amount.toFixed(2)}`;
	}
}
