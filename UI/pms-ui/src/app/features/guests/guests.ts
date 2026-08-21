import { DecimalPipe, NgClass, NgTemplateOutlet } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import type { GuestGridItem, GuestGridResponse, GuestSummaryStats } from "@tartware/schemas";
import { TooltipModule } from "primeng/tooltip";
import { map } from "rxjs";
import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { SettingsService } from "../../core/settings/settings.service";
import { loyaltyTierClass, vipStatusClass } from "../../shared/badge-utils";
import { IconComponent } from "../../shared/components/icon/icon";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { filterBySearch } from "../../shared/search-utils";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../shared/sort-utils";

type GuestFilter = "ALL" | "VIP" | "LOYALTY" | "BLACKLISTED";

@Component({
	selector: "app-guests",
	standalone: true,
	imports: [
		DecimalPipe,
		NgClass,
		NgTemplateOutlet,
		FormsModule,
		RouterLink,
		IconComponent,
		TooltipModule,
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
	readonly globalSearch = inject(GlobalSearchService);
	readonly settings = inject(SettingsService);

	readonly guests = signal<GuestGridItem[]>([]);
	readonly guestStats = signal<GuestSummaryStats | null>(null);
	readonly dataReady = signal(false);
	readonly error = signal<string | null>(null);
	private readonly route = inject(ActivatedRoute);

	/**
	 * The active segment comes from the URL, so the sub-sidebar link selects it
	 * and each segment is deep-linkable. Unknown segments fall back to ALL.
	 */
	readonly activeFilter = toSignal(
		this.route.paramMap.pipe(
			map((p) => {
				const segment = (p.get("segment") ?? "all").toUpperCase();
				return (
					["ALL", "VIP", "LOYALTY", "BLACKLISTED"].includes(segment) ? segment : "ALL"
				) as GuestFilter;
			}),
		),
		{ initialValue: "ALL" as GuestFilter },
	);
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();
	// biome-ignore lint/correctness/noUnusedPrivateClassMembers: holds the EffectRef; the effect body is the purpose, nothing reads the field
	private readonly _resetPage = effect(() => {
		this.globalSearch.query();
		this.currentPage.set(1);
	});

	readonly guestFilters: { key: GuestFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "VIP", label: "VIP" },
		{ key: "LOYALTY", label: "Loyalty" },
		{ key: "BLACKLISTED", label: "Blacklisted" },
	];

	readonly filteredGuests = computed(() => {
		let list = this.guests();
		const filter = this.activeFilter();
		const query = this.globalSearch.query().toLowerCase().trim();

		if (filter === "VIP") {
			list = list.filter((g) => g.vip_status);
		} else if (filter === "LOYALTY") {
			list = list.filter((g) => g.loyalty_tier && g.loyalty_tier !== "BASE");
		} else if (filter === "BLACKLISTED") {
			list = list.filter((g) => g.is_blacklisted);
		}

		if (query) {
			// The old predicate also tested "first last" concatenated, to catch a
			// full-name search. Term-by-term matching across fields covers that
			// case on its own, so the extra disjunct is gone.
			list = filterBySearch(list, query, (g) => [
				g.first_name,
				g.last_name,
				g.email,
				g.phone,
				g.company_name,
				g.loyalty_tier,
				g.vip_status,
			]);
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

	/** Header text for the open segment — the sub-sidebar no longer carries counts. */
	readonly segmentTitle = computed(
		() => this.guestFilters.find((f) => f.key === this.activeFilter())?.label ?? "All",
	);
	readonly segmentSummary = computed(() => {
		const count = this.filterCounts()[this.activeFilter()] ?? 0;
		return `${count} ${count === 1 ? "guest" : "guests"} in this segment`;
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

		// Switching segment starts at page 1, however the segment was entered
		effect(
			() => {
				this.activeFilter();
				this.currentPage.set(1);
			},
			{ allowSignalWrites: true },
		);

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
		void this.router.navigate(["/guests/segment", filter.toLowerCase()]);
	}

	onSort(column: string): void {
		this.sortState.set(toggleSort(this.sortState(), column));
		this.currentPage.set(1);
	}

	sortIcon = (column: string) => getSortIcon(this.sortState(), column);
	ariaSort = (column: string) => getAriaSort(this.sortState(), column);

	viewGuest(guestId: string): void {
		this.router.navigate(["/guests", guestId]);
	}

	vipClass = vipStatusClass;
	loyaltyClass = loyaltyTierClass;

	/** Percentage of part/total, formatted as "X%". */
	pctOf(part: number, total: number): string {
		if (total === 0) return "0%";
		return `${Math.round((part / total) * 100)}%`;
	}

	/** Format currency amount for display. */
	formatCurrency(amount: number | null | undefined): string {
		if (amount == null) return "—";
		return this.settings.formatCurrency(amount);
	}

	/** Format date for display. */
	formatDate(date: string | Date | null | undefined): string {
		if (!date) return "—";
		return this.settings.formatDate(
			typeof date === "string" ? date : date.toISOString().slice(0, 10),
		);
	}

	/** Guest initials for avatar. */
	initials(guest: GuestGridItem): string {
		return `${guest.first_name.charAt(0)}${guest.last_name.charAt(0)}`.toUpperCase();
	}

	/** Display loyalty tier label. */
	loyaltyLabel(tier: string | null | undefined): string {
		if (!tier) return "—";
		return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
	}

	async loadGuests(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) {
			this.dataReady.set(true);
			return;
		}

		this.dataReady.set(false);
		this.error.set(null);

		try {
			// Guests are tenant-scoped — don't filter by property
			const params: Record<string, string> = {
				tenant_id: tenantId,
				limit: "100",
			};
			const guests = await this.api.get<GuestGridResponse>("/guests/grid", params);
			this.guests.set(guests.data ?? []);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load guests");
		} finally {
			this.dataReady.set(true);
		}
	}

	/**
	 * Guest creation is a full page rather than a dialog: the profile spans
	 * identity, contact, address, company, loyalty and preferences, which does
	 * not fit a modal without scrolling the operator through it blind.
	 */
	openCreateDialog(): void {
		this.router.navigate(["/guests/new"]);
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
