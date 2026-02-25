import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router } from "@angular/router";

import type { ReservationListItem, ReservationListResponse } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { reservationStatusClass } from "../../shared/badge-utils";
import { formatCurrency, formatShortDate } from "../../shared/format-utils";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../shared/sort-utils";

type StatusFilter = "ALL" | "CONFIRMED" | "CHECKED_IN" | "PENDING" | "CANCELLED" | "CHECKED_OUT";

@Component({
	selector: "app-reservations",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PaginationComponent,
	],
	templateUrl: "./reservations.html",
	styleUrl: "./reservations.scss",
})
export class ReservationsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly router = inject(Router);

	readonly reservations = signal<ReservationListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly searchQuery = signal("");
	readonly activeFilter = signal<StatusFilter>("ALL");
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();

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
		const query = this.searchQuery().toLowerCase().trim();

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
		const sorted = sortBy(this.filteredReservations(), this.sortState().column, this.sortState().direction);
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

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadReservations();
		});

		// Clamp currentPage when filtered list shrinks
		effect(() => {
			const maxPage = Math.max(1, Math.ceil(this.filteredReservations().length / this.pageSize));
			if (this.currentPage() > maxPage) {
				this.currentPage.set(maxPage);
			}
		}, { allowSignalWrites: true });
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

	viewReservation(id: string): void {
		this.router.navigate(["/reservations", id]);
	}

	statusClass = reservationStatusClass;
	formatDate = formatShortDate;
	formatCurrency = formatCurrency;

	async loadReservations(): Promise<void> {
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
			const res = await this.api.get<ReservationListResponse>("/reservations", params);
			const list = Array.isArray(res) ? res : (res.data ?? []);
			this.reservations.set(list);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load reservations");
		} finally {
			this.loading.set(false);
		}
	}

	openCreateReservation(): void {
		this.router.navigate(["/reservations/new"]);
	}
}
