import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import type { GroupBookingListItem } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { groupBlockStatusClass } from "../../shared/badge-utils";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { formatCurrency, formatShortDate } from "../../shared/format-utils";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../shared/sort-utils";

type StatusFilter = "ALL" | "TENTATIVE" | "DEFINITE" | "INQUIRY" | "CONFIRMED" | "CANCELED";

@Component({
	selector: "app-groups",
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
		TranslatePipe,
	],
	templateUrl: "./groups.html",
	styleUrl: "./groups.scss",
})
export class GroupsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);

	readonly groups = signal<GroupBookingListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly searchQuery = signal("");
	readonly activeFilter = signal<StatusFilter>("ALL");
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();

	readonly statusFilters: { key: StatusFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "TENTATIVE", label: "Tentative" },
		{ key: "DEFINITE", label: "Definite" },
		{ key: "CONFIRMED", label: "Confirmed" },
		{ key: "INQUIRY", label: "Inquiry" },
		{ key: "CANCELED", label: "Canceled" },
	];

	readonly groupTypeIcon: Record<string, { icon: string; tooltip: string }> = {
		CONFERENCE: { icon: "groups", tooltip: "Conference" },
		WEDDING: { icon: "favorite", tooltip: "Wedding" },
		CORPORATE: { icon: "business", tooltip: "Corporate" },
		TOUR_GROUP: { icon: "tour", tooltip: "Tour Group" },
		SPORTS_TEAM: { icon: "sports", tooltip: "Sports Team" },
		REUNION: { icon: "celebration", tooltip: "Reunion" },
		CONVENTION: { icon: "location_city", tooltip: "Convention" },
		GOVERNMENT: { icon: "account_balance", tooltip: "Government" },
		AIRLINE_CREW: { icon: "flight", tooltip: "Airline Crew" },
		EDUCATIONAL: { icon: "school", tooltip: "Educational" },
		OTHER: { icon: "more_horiz", tooltip: "Other" },
	};

	readonly filteredGroups = computed(() => {
		let list = this.groups();
		const filter = this.activeFilter();
		const query = this.searchQuery().toLowerCase().trim();

		if (filter !== "ALL") {
			list = list.filter((g) => g.block_status.toUpperCase() === filter);
		}

		if (query) {
			list = list.filter(
				(g) =>
					g.group_name.toLowerCase().includes(query) ||
					(g.group_code?.toLowerCase().includes(query) ?? false) ||
					g.contact_name.toLowerCase().includes(query) ||
					(g.contact_email?.toLowerCase().includes(query) ?? false) ||
					(g.organization_name?.toLowerCase().includes(query) ?? false),
			);
		}

		return list;
	});

	readonly paginatedGroups = computed(() => {
		const sorted = sortBy(
			this.filteredGroups(),
			this.sortState().column,
			this.sortState().direction,
		);
		const start = (this.currentPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly filterCounts = computed(() => {
		const all = this.groups();
		const countByStatus = (status: string) =>
			all.filter((g) => g.block_status.toUpperCase() === status).length;
		return {
			ALL: all.length,
			TENTATIVE: countByStatus("TENTATIVE"),
			DEFINITE: countByStatus("DEFINITE"),
			CONFIRMED: countByStatus("CONFIRMED"),
			INQUIRY: countByStatus("INQUIRY"),
			CANCELED: countByStatus("CANCELED"),
		};
	});

	readonly summary = computed(() => {
		const all = this.groups();
		const active = all.filter((g) => g.is_active);
		return {
			totalGroups: all.length,
			activeGroups: active.length,
			totalRoomsBlocked: active.reduce((sum, g) => sum + g.total_rooms_blocked, 0),
			avgPickup:
				active.length > 0
					? Math.round(active.reduce((sum, g) => sum + g.pickup_percentage, 0) / active.length)
					: 0,
		};
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadGroups();
		});

		effect(
			() => {
				const maxPage = Math.max(1, Math.ceil(this.filteredGroups().length / this.pageSize));
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

	viewGroup(id: string): void {
		this.router.navigate(["/groups", id]);
	}

	openCreateGroup(): void {
		this.router.navigate(["/groups/new"]);
	}

	statusClass = groupBlockStatusClass;
	formatDate = formatShortDate;
	formatCurrency = formatCurrency;

	pickupClass(percentage: number): string {
		if (percentage >= 80) return "badge-success";
		if (percentage >= 50) return "badge-warning";
		return "badge-danger";
	}

	async loadGroups(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				limit: "200",
			};
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<GroupBookingListItem[]>("/group-bookings", params);
			const list = Array.isArray(res) ? res : [];
			this.groups.set(list);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load group bookings");
		} finally {
			this.loading.set(false);
		}
	}
}
