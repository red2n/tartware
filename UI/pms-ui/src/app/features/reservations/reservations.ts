import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import type { ReservationGridItem, ReservationGridResponse } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { SettingsService } from "../../core/settings/settings.service";
import { reservationStatusClass } from "../../shared/badge-utils";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../shared/pagination/pagination";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../shared/sort-utils";

type StatusFilter = "ALL" | "CONFIRMED" | "CHECKED_IN" | "PENDING" | "CANCELLED" | "CHECKED_OUT";

@Component({
	selector: "app-reservations",
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
	templateUrl: "./reservations.html",
	styleUrl: "./reservations.scss",
})
export class ReservationsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);
	readonly globalSearch = inject(GlobalSearchService);
	readonly settings = inject(SettingsService);

	readonly reservations = signal<ReservationGridItem[]>([]);
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

	readonly statusFilters: { key: StatusFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "CONFIRMED", label: "Confirmed" },
		{ key: "CHECKED_IN", label: "Checked In" },
		{ key: "PENDING", label: "Pending" },
		{ key: "CHECKED_OUT", label: "Checked Out" },
		{ key: "CANCELLED", label: "Cancelled" },
	];

	readonly filteredReservations = computed(() => {
		let list = this.reservations();
		const filter = this.activeFilter();
		const query = this.globalSearch.query().toLowerCase().trim();

		if (filter !== "ALL") {
			list = list.filter((r) => r.status.toUpperCase() === filter);
		}

		if (query) {
			list = list.filter(
				(r) =>
					r.guest_name.toLowerCase().includes(query) ||
					r.confirmation_number.toLowerCase().includes(query) ||
					(r.room_number?.toLowerCase().includes(query) ?? false) ||
					(r.guest_email?.toLowerCase().includes(query) ?? false) ||
					(r.room_type_name?.toLowerCase().includes(query) ?? false),
			);
		}

		return list;
	});

	readonly paginatedReservations = computed(() => {
		const sorted = sortBy(
			this.filteredReservations(),
			this.sortState().column,
			this.sortState().direction,
		);
		const start = (this.currentPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly filterCounts = computed(() => {
		const all = this.reservations();
		const countByStatus = (status: string) =>
			all.filter((r) => r.status.toUpperCase() === status).length;
		return {
			ALL: all.length,
			CONFIRMED: countByStatus("CONFIRMED"),
			CHECKED_IN: countByStatus("CHECKED_IN"),
			PENDING: countByStatus("PENDING"),
			CHECKED_OUT: countByStatus("CHECKED_OUT"),
			CANCELLED: countByStatus("CANCELLED"),
		};
	});

	readonly summary = computed(() => {
		const all = this.reservations();
		const today = new Date().toISOString().split("T")[0];
		const upper = (r: ReservationGridItem) => r.status.toUpperCase();
		return {
			arrivalsToday: all.filter(
				(r) => r.check_in_date === today && !["CANCELLED", "CHECKED_OUT"].includes(upper(r)),
			).length,
			inHouse: all.filter((r) => upper(r) === "CHECKED_IN").length,
			departuresToday: all.filter((r) => r.check_out_date === today && upper(r) === "CHECKED_IN")
				.length,
			pending: all.filter((r) => upper(r) === "PENDING").length,
			totalRevenue: all
				.filter((r) => upper(r) !== "CANCELLED")
				.reduce((sum, r) => sum + r.total_amount, 0),
			currency: all[0]?.currency ?? "USD",
		};
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadReservations();
		});

		// Clamp currentPage when filtered list shrinks
		effect(
			() => {
				const maxPage = Math.max(1, Math.ceil(this.filteredReservations().length / this.pageSize));
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

	viewReservation(id: string): void {
		this.router.navigate(["/reservations", id]);
	}

	statusClass = reservationStatusClass;
	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}
	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	readonly reservationTypeIcon: Record<string, { icon: string; tooltip: string }> = {
		TRANSIENT: { icon: "person", tooltip: "Transient" },
		CORPORATE: { icon: "business", tooltip: "Corporate" },
		GROUP: { icon: "groups", tooltip: "Group" },
		WHOLESALE: { icon: "inventory_2", tooltip: "Wholesale" },
		PACKAGE: { icon: "card_giftcard", tooltip: "Package" },
		COMPLIMENTARY: { icon: "redeem", tooltip: "Complimentary" },
		HOUSE_USE: { icon: "home_work", tooltip: "House Use" },
		DAY_USE: { icon: "wb_sunny", tooltip: "Day Use" },
		WAITLIST: { icon: "hourglass_empty", tooltip: "Waitlist" },
	};

	async loadReservations(): Promise<void> {
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
			const res = await this.api.get<ReservationGridResponse>("/reservations/grid", params);
			this.reservations.set(res.data ?? []);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load reservations");
		} finally {
			this.dataReady.set(true);
		}
	}

	openCreateReservation(): void {
		this.router.navigate(["/reservations/new"]);
	}
}
