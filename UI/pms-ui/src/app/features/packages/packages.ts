import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog, MatDialogModule } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { RouterLink } from "@angular/router";

import type { PackageListItem } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { ToastService } from "../../shared/toast/toast.service";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../shared/sort-utils";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "FEATURED";
type TypeFilter = "ALL" | string;

@Component({
	selector: "app-packages",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatDialogModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		RouterLink,
		PaginationComponent,
	],
	templateUrl: "./packages.html",
	styleUrl: "./packages.scss",
})
export class PackagesComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialog = inject(MatDialog);
	private readonly toast = inject(ToastService);

	readonly packages = signal<PackageListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly searchQuery = signal("");
	readonly activeFilter = signal<StatusFilter>("ALL");
	readonly activeTypeFilter = signal<TypeFilter>("ALL");
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();

	readonly statusFilters: { key: StatusFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "ACTIVE", label: "Active" },
		{ key: "INACTIVE", label: "Inactive" },
		{ key: "FEATURED", label: "Featured" },
	];

	readonly packageTypes: { key: string; label: string }[] = [
		{ key: "ALL", label: "All types" },
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

	readonly filteredPackages = computed(() => {
		let list = this.packages();
		const status = this.activeFilter();
		const type = this.activeTypeFilter();
		const query = this.searchQuery().toLowerCase().trim();

		if (status === "ACTIVE") {
			list = list.filter((p) => p.is_active);
		} else if (status === "INACTIVE") {
			list = list.filter((p) => !p.is_active);
		} else if (status === "FEATURED") {
			list = list.filter((p) => p.is_featured);
		}

		if (type !== "ALL") {
			list = list.filter((p) => p.package_type === type);
		}

		if (query) {
			list = list.filter(
				(p) =>
					p.package_name.toLowerCase().includes(query) ||
					p.package_code.toLowerCase().includes(query) ||
					(p.short_description?.toLowerCase().includes(query) ?? false) ||
					p.package_type_display.toLowerCase().includes(query),
			);
		}

		return list;
	});

	readonly paginatedPackages = computed(() => {
		const sorted = sortBy(
			this.filteredPackages(),
			this.sortState().column,
			this.sortState().direction,
		);
		const start = (this.currentPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly filterCounts = computed(() => {
		const all = this.packages();
		return {
			ALL: all.length,
			ACTIVE: all.filter((p) => p.is_active).length,
			INACTIVE: all.filter((p) => !p.is_active).length,
			FEATURED: all.filter((p) => p.is_featured).length,
		};
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadPackages();
		});

		effect(
			() => {
				const maxPage = Math.max(
					1,
					Math.ceil(this.filteredPackages().length / this.pageSize),
				);
				if (this.currentPage() > maxPage) {
					this.currentPage.set(maxPage);
				}
			},
			{ allowSignalWrites: true },
		);
	}

	setFilter(filter: StatusFilter): void {
		this.activeFilter.set(filter);
		this.currentPage.set(1);
	}

	setTypeFilter(type: string): void {
		this.activeTypeFilter.set(type);
		this.currentPage.set(1);
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

	// ── Display helpers ──

	statusClass(pkg: PackageListItem): string {
		if (!pkg.is_active) return "badge-muted";
		if (!pkg.is_currently_valid) return "badge-warning";
		return "badge-success";
	}

	statusLabel(pkg: PackageListItem): string {
		if (!pkg.is_active) return "Inactive";
		if (!pkg.is_currently_valid) return "Expired";
		return "Active";
	}

	inclusionIcons(pkg: PackageListItem): { icon: string; label: string }[] {
		const icons: { icon: string; label: string }[] = [];
		if (pkg.includes_breakfast) icons.push({ icon: "free_breakfast", label: "Breakfast" });
		if (pkg.includes_lunch) icons.push({ icon: "lunch_dining", label: "Lunch" });
		if (pkg.includes_dinner) icons.push({ icon: "dinner_dining", label: "Dinner" });
		if (pkg.includes_parking) icons.push({ icon: "local_parking", label: "Parking" });
		if (pkg.includes_wifi) icons.push({ icon: "wifi", label: "WiFi" });
		if (pkg.includes_airport_transfer) icons.push({ icon: "airport_shuttle", label: "Airport transfer" });
		return icons;
	}

	formatCurrency(amount: number, currency?: string): string {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency ?? "USD",
			minimumFractionDigits: 2,
		}).format(amount);
	}

	formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return d.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	validityTooltip(pkg: PackageListItem): string {
		return `${this.formatDate(pkg.valid_from)} — ${this.formatDate(pkg.valid_to)}`;
	}

	inventoryLabel(pkg: PackageListItem): string {
		if (pkg.total_inventory == null) return "Unlimited";
		return `${pkg.available_inventory ?? 0} / ${pkg.total_inventory}`;
	}

	async openCreateDialog(): Promise<void> {
		const { CreatePackageDialogComponent } = await import(
			"./create-package-dialog/create-package-dialog"
		);
		const ref = this.dialog.open(CreatePackageDialogComponent, {
			width: "640px",
			disableClose: true,
		});
		ref.afterClosed().subscribe((created) => {
			if (created) {
				this.toast.success("Package created successfully");
				this.loadPackages();
			}
		});
	}

	async loadPackages(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<{ data: PackageListItem[] }>("/packages", params);
			this.packages.set(res.data);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load packages");
		} finally {
			this.loading.set(false);
		}
	}
}
