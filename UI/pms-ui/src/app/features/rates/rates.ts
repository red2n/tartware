import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { RateItem } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { SettingsService } from "../../core/settings/settings.service";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../shared/pagination/pagination";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../shared/sort-utils";
import { ToastService } from "../../shared/toast/toast.service";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "EXPIRED" | "FUTURE";
type TypeFilter = "ALL" | string;

@Component({
	selector: "app-rates",
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
	templateUrl: "./rates.html",
	styleUrl: "./rates.scss",
})
export class RatesComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly dialog = inject(MatDialog);
	private readonly toast = inject(ToastService);
	readonly globalSearch = inject(GlobalSearchService);
	readonly settings = inject(SettingsService);

	// ── Settings-driven signals ───────────────────────────────────────────────
	/** When false, the RACK rate type is hidden from the type filter dropdown. */
	readonly showRackRate = computed(() => this.settings.getBool("rates.show_rack_rate", true));
	/** When true, display a deposit-required policy banner. */
	readonly depositRequired = computed(() => this.settings.getBool("rates.deposit_required", false));
	/** When true, display a tax policy banner indicating rates are tax-inclusive. */
	readonly taxInclusive = computed(() => this.settings.getBool("rates.tax_inclusive", false));
	/** Deposit percentage configured for this tenant. */
	readonly depositPercent = computed(() => this.settings.getNumber("rates.deposit_percent", 25));
	/** Maximum discount percentage allowed on rate adjustments. */
	readonly maxDiscountPercent = computed(() =>
		this.settings.getNumber("rates.max_discount_percent", 50),
	);
	/** City/tourist tax per night. */
	readonly cityTaxPerNight = computed(() => this.settings.getNumber("rates.city_tax_per_night", 0));
	/** Non-refundable cutoff in days before arrival. */
	readonly nonRefundableCutoffDays = computed(() =>
		this.settings.getNumber("rates.non_refundable_cutoff_days", 7),
	);
	/** Default rounding method for rate calculations. */
	readonly defaultRounding = computed(() =>
		this.settings.getString("rates.default_rounding", "ROUND_HALF_UP"),
	);
	/** Whether dynamic pricing is enabled. */
	readonly dynamicPricingEnabled = computed(() =>
		this.settings.getBool("advanced.enable_dynamic_pricing", false),
	);

	readonly rates = signal<RateItem[]>([]);
	readonly dataReady = signal(false);
	readonly error = signal<string | null>(null);
	readonly activeFilter = signal<StatusFilter>("ALL");
	readonly activeTypeFilter = signal<TypeFilter>("ALL");
	readonly currentPage = signal(1);
	readonly pageSize = 25;
	readonly sortState = createSortState();
	private readonly _resetPage = effect(() => {
		this.globalSearch.query();
		this.currentPage.set(1);
	});

	readonly statusFilters: { key: StatusFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "ACTIVE", label: "Active" },
		{ key: "INACTIVE", label: "Inactive" },
		{ key: "EXPIRED", label: "Expired" },
		{ key: "FUTURE", label: "Future" },
	];

	readonly rateTypes: { key: string; label: string }[] = [
		{ key: "ALL", label: "All types" },
		{ key: "BAR", label: "BAR" },
		{ key: "RACK", label: "Rack" },
		{ key: "CORPORATE", label: "Corporate" },
		{ key: "PROMO", label: "Promo" },
		{ key: "NON_REFUNDABLE", label: "Non-refundable" },
		{ key: "FLEXIBLE", label: "Flexible" },
		{ key: "EARLYBIRD", label: "Early bird" },
		{ key: "LASTMINUTE", label: "Last minute" },
		{ key: "GOVERNMENT", label: "Government" },
		{ key: "TRAVEL_AGENT", label: "Travel agent" },
		{ key: "LOS", label: "Length of stay" },
		{ key: "COMP", label: "Comp" },
		{ key: "HOUSE", label: "House" },
	];

	/** Rate type options filtered by settings (hides RACK when show_rack_rate=false). */
	readonly visibleRateTypes = computed(() =>
		this.showRackRate() ? this.rateTypes : this.rateTypes.filter((t) => t.key !== "RACK"),
	);

	readonly filteredRates = computed(() => {
		let list = this.rates();
		const status = this.activeFilter();
		const type = this.activeTypeFilter();
		const query = this.globalSearch.query().toLowerCase().trim();

		if (status !== "ALL") {
			list = list.filter((r) => r.status === status);
		}

		if (type !== "ALL") {
			list = list.filter((r) => r.rate_type === type);
		}

		if (query) {
			list = list.filter(
				(r) =>
					r.rate_name.toLowerCase().includes(query) ||
					r.rate_code.toLowerCase().includes(query) ||
					(r.description?.toLowerCase().includes(query) ?? false) ||
					r.rate_type.toLowerCase().includes(query),
			);
		}

		return list;
	});

	readonly paginatedRates = computed(() => {
		const sorted = sortBy(
			this.filteredRates(),
			this.sortState().column,
			this.sortState().direction,
		);
		const start = (this.currentPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly filterCounts = computed(() => {
		const all = this.rates();
		return {
			ALL: all.length,
			ACTIVE: all.filter((r) => r.status === "ACTIVE").length,
			INACTIVE: all.filter((r) => r.status === "INACTIVE").length,
			EXPIRED: all.filter((r) => r.status === "EXPIRED").length,
			FUTURE: all.filter((r) => r.status === "FUTURE").length,
		};
	});

	readonly summary = computed(() => {
		const all = this.rates();
		const active = all.filter((r) => r.status === "ACTIVE");
		const currency = all[0]?.currency ?? "USD";
		const activeRates = active.map((r) => r.base_rate).sort((a, b) => a - b);
		const minRate = activeRates[0] ?? 0;
		const maxRate = activeRates[activeRates.length - 1] ?? 0;
		const barRate = active.find((r) => r.rate_type === "BAR");
		const typeCounts = new Map<string, number>();
		for (const r of active) {
			typeCounts.set(r.rate_type, (typeCounts.get(r.rate_type) ?? 0) + 1);
		}
		const topTypes = [...typeCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([type, count]) => ({ label: this.typeLabel(type), count }));
		return {
			totalPlans: all.length,
			activePlans: active.length,
			minRate,
			maxRate,
			currency,
			barRateValue: barRate?.base_rate ?? null,
			barRateName: barRate?.rate_name ?? null,
			topTypes,
		};
	});

	constructor() {
		// Reload rates when property selection changes
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadRates();
		});

		// Clamp currentPage when filtered list shrinks
		effect(
			() => {
				const maxPage = Math.max(1, Math.ceil(this.filteredRates().length / this.pageSize));
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

	onSort(column: string): void {
		this.sortState.set(toggleSort(this.sortState(), column));
		this.currentPage.set(1);
	}

	sortIcon = (column: string) => getSortIcon(this.sortState(), column);
	ariaSort = (column: string) => getAriaSort(this.sortState(), column);

	statusClass(status: string): string {
		switch (status) {
			case "ACTIVE":
				return "badge-success";
			case "INACTIVE":
				return "badge-muted";
			case "EXPIRED":
				return "badge-danger";
			case "FUTURE":
				return "badge-accent";
			default:
				return "";
		}
	}

	typeLabel(type: string): string {
		const found = this.rateTypes.find((t) => t.key === type);
		return found?.label ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
	}

	strategyLabel(strategy: string): string {
		return strategy.charAt(0) + strategy.slice(1).toLowerCase();
	}

	mealPlanLabel(code?: string): string {
		if (!code) return "—";
		switch (code) {
			case "RO":
				return "Room only";
			case "BB":
				return "Bed & Breakfast";
			case "HB":
				return "Half board";
			case "FB":
				return "Full board";
			case "AI":
				return "All inclusive";
			default:
				return code;
		}
	}

	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}

	validityTooltip(rate: RateItem): string {
		const from = this.formatDate(rate.valid_from);
		const until = rate.valid_until ? this.formatDate(rate.valid_until) : "No end date";
		return `${from} — ${until}`;
	}

	cancellationLabel(policy: unknown): string {
		if (!policy || typeof policy !== "object" || !("type" in policy)) return "—";
		const type = String((policy as Record<string, unknown>)["type"]);
		return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ");
	}

	channelsLabel(channels: unknown): string {
		if (Array.isArray(channels)) {
			return channels.map((c) => String(c).charAt(0).toUpperCase() + String(c).slice(1)).join(", ");
		}
		return "—";
	}

	async loadRates(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.dataReady.set(false);
		this.error.set(null);

		try {
			const params: Record<string, string> = { tenant_id: tenantId };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const rates = await this.api.get<RateItem[]>("/rates", params);
			this.rates.set(rates);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load rates");
		} finally {
			this.dataReady.set(true);
		}
	}

	openCreateDialog(): void {
		import("./create-rate-dialog/create-rate-dialog").then(({ CreateRateDialogComponent }) => {
			const ref = this.dialog.open(CreateRateDialogComponent, {
				width: "600px",
				disableClose: true,
			});
			ref.afterClosed().subscribe((created: boolean) => {
				if (created) {
					this.toast.success("Rate plan created successfully.");
					this.loadRates();
				}
			});
		});
	}

	async toggleStatus(rate: RateItem, newStatus: "ACTIVE" | "INACTIVE"): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		if (
			newStatus === "INACTIVE" &&
			!confirm(
				`Deactivate rate plan "${rate.rate_name}"? It will no longer be available for new bookings.`,
			)
		)
			return;

		try {
			await this.api.put(`/rates/${rate.id}`, {
				tenant_id: tenantId,
				status: newStatus,
			});
			// Update local state immediately
			this.rates.update((list) =>
				list.map((r) => (r.id === rate.id ? { ...r, status: newStatus } : r)),
			);
			this.toast.success(
				`Rate "${rate.rate_name}" ${newStatus === "ACTIVE" ? "activated" : "deactivated"}.`,
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update rate status");
		}
	}
}
