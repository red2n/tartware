import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router, RouterLink } from "@angular/router";

import type { GuestWithStats } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { loyaltyTierClass, vipStatusClass } from "../../shared/badge-utils";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { type SortState, createSortState, sortBy, toggleSort } from "../../shared/sort-utils";

type GuestFilter = "ALL" | "VIP" | "LOYALTY" | "BLACKLISTED";

/** API returns version as string instead of bigint. */
type GuestListItem = Omit<GuestWithStats, "version"> & { version: string };

@Component({
	selector: "app-guests",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		RouterLink,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PaginationComponent,
	],
	templateUrl: "./guests.html",
	styleUrl: "./guests.scss",
})
export class GuestsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly router = inject(Router);
	private readonly dialog = inject(MatDialog);

	readonly guests = signal<GuestListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly successMessage = signal<string | null>(null);
	readonly searchQuery = signal("");
	readonly activeFilter = signal<GuestFilter>("ALL");
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();

	readonly guestFilters: { key: GuestFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "VIP", label: "VIP" },
		{ key: "LOYALTY", label: "Loyalty" },
		{ key: "BLACKLISTED", label: "Blacklisted" },
	];

	readonly filteredGuests = computed(() => {
		let list = this.guests();
		const filter = this.activeFilter();
		const query = this.searchQuery().toLowerCase().trim();

		if (filter === "VIP") {
			list = list.filter((g) => g.vip_status);
		} else if (filter === "LOYALTY") {
			list = list.filter((g) => g.loyalty_tier && g.loyalty_tier !== "BASE");
		} else if (filter === "BLACKLISTED") {
			list = list.filter((g) => g.is_blacklisted);
		}

		if (query) {
			list = list.filter(
				(g) =>
					g.first_name.toLowerCase().includes(query) ||
					g.last_name.toLowerCase().includes(query) ||
					`${g.first_name} ${g.last_name}`.toLowerCase().includes(query) ||
					(g.email?.toLowerCase().includes(query) ?? false) ||
					(g.phone?.includes(query) ?? false) ||
					(g.company_name?.toLowerCase().includes(query) ?? false),
			);
		}

		return list;
	});

	readonly paginatedGuests = computed(() => {
		const sorted = sortBy(this.filteredGuests(), this.sortState().column, this.sortState().direction);
		const start = (this.currentPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly filterCounts = computed(() => {
		const all = this.guests();
		return {
			ALL: all.length,
			VIP: all.filter((g) => g.vip_status).length,
			LOYALTY: all.filter((g) => g.loyalty_tier && g.loyalty_tier !== "BASE").length,
			BLACKLISTED: all.filter((g) => g.is_blacklisted).length,
		};
	});

	constructor() {
		// Guests are tenant-scoped (not property-scoped) — reload on tenant change only
		effect(() => {
			this.auth.tenantId();
			this.loadGuests();
		});
	}

	setFilter(filter: GuestFilter): void {
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
		if (s.column !== column) return 'unfold_more';
		return s.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
	}

	viewGuest(guestId: string): void {
		this.router.navigate(["/guests", guestId]);
	}

	vipClass = vipStatusClass;
	loyaltyClass = loyaltyTierClass;

	/** Format currency amount for display. */
	formatCurrency(amount: number | null | undefined): string {
		if (amount == null) return "—";
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
	}

	/** Format date for display. */
	formatDate(date: string | Date | null | undefined): string {
		if (!date) return "—";
		return new Date(date).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}

	/** Guest initials for avatar. */
	initials(guest: GuestListItem): string {
		return `${guest.first_name.charAt(0)}${guest.last_name.charAt(0)}`.toUpperCase();
	}

	/** Display loyalty tier label. */
	loyaltyLabel(tier: string | null | undefined): string {
		if (!tier) return "—";
		return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
	}

	async loadGuests(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.loading.set(true);
		this.error.set(null);

		try {
			// Guests are tenant-scoped — don't filter by property
			const params: Record<string, string> = {
				tenant_id: tenantId,
				limit: "100",
			};
			const guests = await this.api.get<GuestListItem[]>("/guests", params);
			this.guests.set(guests);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load guests");
		} finally {
			this.loading.set(false);
		}
	}

	openCreateDialog(): void {
		import("./create-guest-dialog/create-guest-dialog").then(({ CreateGuestDialogComponent }) => {
			const ref = this.dialog.open(CreateGuestDialogComponent, {
				width: "600px",
				disableClose: true,
			});
			ref.afterClosed().subscribe((created: boolean) => {
				if (created) {
					this.successMessage.set("Guest registration submitted. It may take a moment to appear.");
					setTimeout(() => this.successMessage.set(null), 6000);
					// Kafka consumer processes async — delay refresh
					setTimeout(() => this.loadGuests(), 1500);
				}
			});
		});
	}
}
