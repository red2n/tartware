import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import {
	type GroupBlockStatus,
	GroupBlockStatusDescriptions,
	type GroupBookingListItem,
} from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { SettingsService } from "../../core/settings/settings.service";
import { groupBlockStatusClass } from "../../shared/badge-utils";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../shared/pagination/pagination";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../shared/sort-utils";

type StatusFilter = "ALL" | GroupBlockStatus;

@Component({
	selector: "app-groups",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
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
	readonly globalSearch = inject(GlobalSearchService);
	readonly settings = inject(SettingsService);

	readonly groups = signal<GroupBookingListItem[]>([]);
	readonly dataReady = signal(false);
	readonly error = signal<string | null>(null);
	readonly activeFilter = signal<StatusFilter>("ALL");
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();
	private readonly _resetPage = effect(() => {
		this.globalSearch.query();
		this.currentPage.set(1);
	});

	readonly statusFilters: { key: StatusFilter; label: string; description: string }[] = [
		{ key: "ALL", label: "All", description: "All group bookings regardless of status" },
		{
			key: "INQUIRY",
			label: "Inquiry",
			description: "Initial contact — guest or planner is asking about availability",
		},
		{
			key: "PROSPECT",
			label: "Prospect",
			description: "Qualified lead — sales team is actively working the deal",
		},
		{
			key: "TENTATIVE",
			label: "Tentative",
			description: "Space held with a cutoff date, pending a signed contract",
		},
		{
			key: "DEFINITE",
			label: "Definite",
			description: "Contract signed — the group booking is confirmed",
		},
		{
			key: "CONFIRMED",
			label: "Confirmed",
			description: "Rooms have been picked and assigned to the group",
		},
		{
			key: "CANCELLED",
			label: "Cancelled",
			description: "Group booking was cancelled by the guest or planner",
		},
		{
			key: "TURNDOWN",
			label: "Turndown",
			description: "Hotel declined the business (capacity, rate, or fit)",
		},
		{
			key: "COMPLETED",
			label: "Completed",
			description: "Group stay is finished and all folios are closed",
		},
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
		const query = this.globalSearch.query().toLowerCase().trim();

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
			INQUIRY: countByStatus("INQUIRY"),
			PROSPECT: countByStatus("PROSPECT"),
			TENTATIVE: countByStatus("TENTATIVE"),
			DEFINITE: countByStatus("DEFINITE"),
			CONFIRMED: countByStatus("CONFIRMED"),
			CANCELLED: countByStatus("CANCELLED"),
			TURNDOWN: countByStatus("TURNDOWN"),
			COMPLETED: countByStatus("COMPLETED"),
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

	onSort(column: string): void {
		this.sortState.set(toggleSort(this.sortState(), column));
		this.currentPage.set(1);
	}

	sortIcon = (column: string) => getSortIcon(this.sortState(), column);
	ariaSort = (column: string) => getAriaSort(this.sortState(), column);

	viewGroup(id: string): void {
		this.router.navigate(["/groups", id]);
	}

	openCreateGroup(): void {
		this.router.navigate(["/groups/new"]);
	}

	statusClass = groupBlockStatusClass;
	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}
	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}
	statusDescription = (status: string) =>
		GroupBlockStatusDescriptions[status.toUpperCase() as GroupBlockStatus] ?? "";

	pickupClass(percentage: number): string {
		if (percentage >= 80) return "badge-success";
		if (percentage >= 50) return "badge-warning";
		return "badge-danger";
	}

	async loadGroups(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.dataReady.set(false);
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
			this.dataReady.set(true);
		}
	}
}
