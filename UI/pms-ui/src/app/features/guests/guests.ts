import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";
import { Router, RouterLink } from "@angular/router";

import type { GuestSummaryStats, GuestWithStats } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { loyaltyTierClass, vipStatusClass } from "../../shared/badge-utils";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../shared/sort-utils";
import { ToastService } from "../../shared/toast/toast.service";

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
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./guests.html",
	styleUrl: "./guests.scss",
})
export class GuestsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly router = inject(Router);
	private readonly dialog = inject(MatDialog);
	private readonly toast = inject(ToastService);

	readonly guests = signal<GuestListItem[]>([]);
	readonly guestStats = signal<GuestSummaryStats | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
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
		const sorted = sortBy(
			this.filteredGuests(),
			this.sortState().column,
			this.sortState().direction,
		);
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

	/** SVG sparkline path — guest registrations grouped into 12 weekly buckets. */
	readonly sparkline = computed(() => {
		const all = this.guests();
		if (all.length === 0) return null;

		const weeks = 12;
		const now = Date.now();
		const msPerWeek = 7 * 24 * 60 * 60 * 1000;
		const buckets = new Array<number>(weeks).fill(0);

		for (const g of all) {
			const ts = new Date(g.member_since).getTime();
			const weeksAgo = Math.floor((now - ts) / msPerWeek);
			if (weeksAgo >= 0 && weeksAgo < weeks) {
				buckets[weeks - 1 - weeksAgo]++;
			}
		}

		const w = 120;
		const h = 28;
		const max = Math.max(...buckets, 1);
		const step = w / (weeks - 1);

		const points = buckets.map((v, i) => {
			const x = Math.round(i * step * 100) / 100;
			const y = Math.round((1 - v / max) * h * 100) / 100;
			return `${x},${y}`;
		});

		const line = `M${points.join(" L")}`;
		const area = `${line} L${w},${h} L0,${h} Z`;

		return { line, area, width: w, height: h };
	});

	constructor() {
		// Guests are tenant-scoped (not property-scoped) — reload on tenant change only
		effect(() => {
			this.auth.tenantId();
			this.loadGuests();
			this.loadGuestStats();
		});

		// Clamp currentPage when filtered list shrinks
		effect(
			() => {
				const maxPage = Math.max(1, Math.ceil(this.filteredGuests().length / this.pageSize));
				if (this.currentPage() > maxPage) {
					this.currentPage.set(maxPage);
				}
			},
			{ allowSignalWrites: true },
		);
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
		if (s.column !== column) return "unfold_more";
		return s.direction === "asc" ? "arrow_upward" : "arrow_downward";
	}

	ariaSort(column: string): string | null {
		const s = this.sortState();
		if (s.column !== column) return null;
		return s.direction === "asc" ? "ascending" : "descending";
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
					this.toast.success("Guest registration submitted. It may take a moment to appear.");
					// Kafka consumer processes async — delay refresh
					setTimeout(() => {
						this.loadGuests();
						this.loadGuestStats();
					}, 1500);
				}
			});
		});
	}

	private async loadGuestStats(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) {
			this.guestStats.set(null);
			return;
		}

		this.guestStats.set(null);

		try {
			const stats = await this.api.get<GuestSummaryStats>("/guests/stats", { tenant_id: tenantId });
			this.guestStats.set(stats);
		} catch {
			// Stats are non-critical — on error, leave cleared so stale data is not displayed
		}
	}
}
