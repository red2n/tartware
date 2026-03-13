import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { TaxConfigurationListItem, TaxConfigurationListResponse } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { formatShortDate } from "../../../shared/format-utils";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../../shared/sort-utils";

type TaxTypeFilter =
	| "ALL"
	| "VALUE_ADDED"
	| "OCCUPANCY_TAX"
	| "SERVICE_CHARGE"
	| "CITY_TAX"
	| "TOURISM_TAX";
type ActiveFilter = "ALL" | "active" | "inactive";

@Component({
	selector: "app-tax-config",
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
	templateUrl: "./tax-config.html",
	styleUrl: "./tax-config.scss",
})
export class TaxConfigComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);

	// ── State ──
	readonly taxConfigs = signal<TaxConfigurationListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly searchQuery = signal("");
	readonly activeTaxTypeFilter = signal<TaxTypeFilter>("ALL");
	readonly activeStatusFilter = signal<ActiveFilter>("ALL");
	readonly page = signal(1);
	readonly sort = createSortState();
	readonly pageSize = 25;

	readonly taxTypeFilters: { key: TaxTypeFilter; label: string }[] = [
		{ key: "ALL", label: "All Types" },
		{ key: "VALUE_ADDED", label: "VAT/GST" },
		{ key: "OCCUPANCY_TAX", label: "Occupancy" },
		{ key: "SERVICE_CHARGE", label: "Service" },
		{ key: "CITY_TAX", label: "City" },
		{ key: "TOURISM_TAX", label: "Tourism" },
	];

	readonly statusFilters: { key: ActiveFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "active", label: "Active" },
		{ key: "inactive", label: "Inactive" },
	];

	readonly filtered = computed(() => {
		let list = this.taxConfigs();
		const type = this.activeTaxTypeFilter();
		const status = this.activeStatusFilter();
		const query = this.searchQuery().toLowerCase().trim();
		if (type !== "ALL") list = list.filter((t) => t.tax_type === type);
		if (status !== "ALL")
			list = list.filter((t) => (status === "active" ? t.is_active : !t.is_active));
		if (query) {
			list = list.filter(
				(t) =>
					t.tax_name.toLowerCase().includes(query) ||
					t.tax_code.toLowerCase().includes(query) ||
					(t.jurisdiction_name?.toLowerCase().includes(query) ?? false) ||
					(t.tax_description?.toLowerCase().includes(query) ?? false),
			);
		}
		return list;
	});

	readonly paginated = computed(() => {
		const sorted = sortBy(this.filtered(), this.sort().column, this.sort().direction);
		const start = (this.page() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly filterCounts = computed(() => {
		const all = this.taxConfigs();
		return {
			ALL: all.length,
			VALUE_ADDED: all.filter((t) => t.tax_type === "VALUE_ADDED").length,
			OCCUPANCY_TAX: all.filter((t) => t.tax_type === "OCCUPANCY_TAX").length,
			SERVICE_CHARGE: all.filter((t) => t.tax_type === "SERVICE_CHARGE").length,
			CITY_TAX: all.filter((t) => t.tax_type === "CITY_TAX").length,
			TOURISM_TAX: all.filter((t) => t.tax_type === "TOURISM_TAX").length,
		};
	});

	readonly summary = computed(() => {
		const all = this.taxConfigs();
		const activeCount = all.filter((t) => t.is_active).length;
		const jurisdictions = new Set(all.map((t) => t.jurisdiction_name).filter(Boolean)).size;
		const avgRate = all.length > 0 ? all.reduce((sum, t) => sum + t.tax_rate, 0) / all.length : 0;
		return { total: all.length, activeCount, jurisdictions, avgRate };
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadTaxConfigs();
		});
	}

	// ── Actions ──
	setTaxTypeFilter(f: TaxTypeFilter): void {
		this.activeTaxTypeFilter.set(f);
		this.page.set(1);
	}
	setStatusFilter(f: ActiveFilter): void {
		this.activeStatusFilter.set(f);
		this.page.set(1);
	}
	onSearch(v: string): void {
		this.searchQuery.set(v);
		this.page.set(1);
	}
	onSort(col: string): void {
		this.sort.set(toggleSort(this.sort(), col));
		this.page.set(1);
	}

	sortIcon(col: string): string {
		const s = this.sort();
		if (s.column !== col) return "unfold_more";
		return s.direction === "asc" ? "arrow_upward" : "arrow_downward";
	}
	ariaSort(col: string): string | null {
		const s = this.sort();
		if (s.column !== col) return null;
		return s.direction === "asc" ? "ascending" : "descending";
	}

	formatDate = formatShortDate;

	formatRate(item: TaxConfigurationListItem): string {
		if (item.is_percentage) return `${item.tax_rate}%`;
		return `$${item.tax_rate.toFixed(2)}`;
	}

	// ── Data loading ──
	async loadTaxConfigs(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		this.error.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "500" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<TaxConfigurationListResponse>(
				"/billing/tax-configurations",
				params,
			);
			this.taxConfigs.set(res.data ?? []);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load tax configurations");
		} finally {
			this.loading.set(false);
		}
	}
}
