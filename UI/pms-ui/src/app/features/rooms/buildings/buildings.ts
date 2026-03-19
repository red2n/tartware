import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { BuildingItem } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { GlobalSearchService } from "../../../core/search/global-search.service";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../../shared/sort-utils";
import { ToastService } from "../../../shared/toast/toast.service";

@Component({
	selector: "app-buildings",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PaginationComponent,
		PageHeaderComponent,
	],
	templateUrl: "./buildings.html",
	styleUrl: "./buildings.scss",
})
export class BuildingsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialog = inject(MatDialog);
	private readonly toast = inject(ToastService);
	readonly globalSearch = inject(GlobalSearchService);

	readonly buildings = signal<BuildingItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();
	private readonly _resetPage = effect(() => {
		this.globalSearch.query();
		this.currentPage.set(1);
	});

	readonly filteredBuildings = computed(() => {
		let list = this.buildings();
		const query = this.globalSearch.query().toLowerCase().trim();

		if (query) {
			list = list.filter(
				(b) =>
					b.building_name.toLowerCase().includes(query) ||
					b.building_code.toLowerCase().includes(query) ||
					(b.building_type?.toLowerCase().includes(query) ?? false),
			);
		}

		return list;
	});

	readonly paginatedBuildings = computed(() => {
		const sorted = sortBy(
			this.filteredBuildings(),
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
			this.loadBuildings();
		});

		effect(
			() => {
				const maxPage = Math.max(1, Math.ceil(this.filteredBuildings().length / this.pageSize));
				if (this.currentPage() > maxPage) {
					this.currentPage.set(maxPage);
				}
			},
			{ allowSignalWrites: true },
		);
	}

	onSort(column: string): void {
		this.sortState.set(toggleSort(this.sortState(), column));
		this.currentPage.set(1);
	}

	sortIcon = (column: string) => getSortIcon(this.sortState(), column);
	ariaSort = (column: string) => getAriaSort(this.sortState(), column);

	async loadBuildings(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const buildings = await this.api.get<BuildingItem[]>("/buildings", params);
			this.buildings.set(buildings);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load buildings");
		} finally {
			this.loading.set(false);
		}
	}

	openCreateDialog(): void {
		import("./create-building-dialog/create-building-dialog").then(
			({ CreateBuildingDialogComponent }) => {
				const ref = this.dialog.open(CreateBuildingDialogComponent, {
					width: "580px",
					disableClose: true,
				});
				ref.afterClosed().subscribe((created: boolean) => {
					if (created) {
						this.toast.success("Building created successfully.");
						this.loadBuildings();
					}
				});
			},
		);
	}

	openEditDialog(building: BuildingItem): void {
		import("./create-building-dialog/create-building-dialog").then(
			({ CreateBuildingDialogComponent }) => {
				const ref = this.dialog.open(CreateBuildingDialogComponent, {
					width: "580px",
					disableClose: true,
					data: building,
				});
				ref.afterClosed().subscribe((saved: boolean) => {
					if (saved) {
						this.toast.success("Building updated successfully.");
						this.loadBuildings();
					}
				});
			},
		);
	}

	async deleteBuilding(building: BuildingItem, event: Event): Promise<void> {
		event.stopPropagation();
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		if (!confirm(`Delete building "${building.building_name}"?`)) return;

		try {
			await this.api.delete(`/buildings/${building.building_id}`, {
				tenant_id: tenantId,
			});
			this.toast.success("Building deleted.");
			this.loadBuildings();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to delete building");
		}
	}

	statusClass(status: string): string {
		switch (status) {
			case "OPERATIONAL":
				return "badge-success";
			case "RENOVATION":
				return "badge-warning";
			case "CLOSED":
				return "badge-danger";
			case "SEASONAL":
				return "badge-accent";
			default:
				return "";
		}
	}

	amenityIcons(building: BuildingItem): string[] {
		const icons: string[] = [];
		if (building.has_pool) icons.push("pool");
		if (building.has_gym) icons.push("fitness_center");
		if (building.has_spa) icons.push("spa");
		if (building.has_restaurant) icons.push("restaurant");
		if (building.has_parking) icons.push("local_parking");
		if (building.has_lobby) icons.push("meeting_room");
		return icons;
	}
}
