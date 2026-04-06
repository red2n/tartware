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
import { GlobalSearchService } from "../../../core/search/global-search.service";
import { SettingsService } from "../../../core/settings/settings.service";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../../shared/sort-utils";
import { ToastService } from "../../../shared/toast/toast.service";

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
	private readonly toast = inject(ToastService);
	readonly globalSearch = inject(GlobalSearchService);
	readonly settings = inject(SettingsService);

	// ── State ──
	readonly taxConfigs = signal<TaxConfigurationListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly activeTaxTypeFilter = signal<TaxTypeFilter>("ALL");
	readonly activeStatusFilter = signal<ActiveFilter>("ALL");
	readonly page = signal(1);
	readonly sort = createSortState();
	readonly pageSize = 25;
	private readonly _resetPage = effect(() => {
		this.globalSearch.query();
		this.page.set(1);
	});

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
		const query = this.globalSearch.query().toLowerCase().trim();
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
	onSort(col: string): void {
		this.sort.set(toggleSort(this.sort(), col));
		this.page.set(1);
	}

	sortIcon = (col: string) => getSortIcon(this.sort(), col);
	ariaSort = (col: string) => getAriaSort(this.sort(), col);

	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}

	formatRate(item: TaxConfigurationListItem): string {
		if (item.is_percentage) return `${item.tax_rate}%`;
		return `$${item.tax_rate.toFixed(2)}`;
	}

	readonly taxTypeOptions = [
		"SALES_TAX", "VAT", "GST", "OCCUPANCY_TAX", "TOURISM_TAX", "CITY_TAX",
		"STATE_TAX", "FEDERAL_TAX", "RESORT_FEE", "SERVICE_CHARGE", "EXCISE_TAX", "OTHER",
	];
	readonly calcMethodOptions = [
		"INCLUSIVE", "EXCLUSIVE", "COMPOUND", "CASCADING", "ADDITIVE", "TIERED", "FLAT",
	];

	// ── Create form ──
	readonly showCreateForm = signal(false);
	readonly creating = signal(false);
	readonly createForm = signal({
		tax_code: "",
		tax_name: "",
		tax_description: "",
		tax_type: "OCCUPANCY_TAX",
		country_code: "US",
		state_province: "",
		jurisdiction_name: "",
		tax_rate: 0,
		is_percentage: true,
		effective_from: new Date().toISOString().split("T")[0],
		calculation_method: "EXCLUSIVE",
		is_active: true,
	});

	// ── Edit form ──
	readonly editingTaxId = signal<string | null>(null);
	readonly editing = signal(false);
	readonly editForm = signal({
		tax_code: "",
		tax_name: "",
		tax_description: "",
		tax_type: "OCCUPANCY_TAX",
		tax_rate: 0,
		is_percentage: true,
		effective_from: "",
		calculation_method: "EXCLUSIVE",
		is_active: true,
	});

	// ── Delete ──
	readonly deletingTaxId = signal<string | null>(null);
	readonly deleting = signal(false);
	readonly deleteReason = signal("");

	toggleCreateForm(): void {
		this.showCreateForm.set(!this.showCreateForm());
		this.editingTaxId.set(null);
	}

	updateCreateForm(partial: Record<string, unknown>): void {
		this.createForm.set({ ...this.createForm(), ...partial } as typeof this.createForm extends () => infer T ? T : never);
	}

	async createTaxConfig(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.creating.set(true);
		try {
			const form = this.createForm();
			await this.api.post(`/tenants/${tenantId}/billing/tax-configurations`, {
				property_id: propertyId,
				tax_code: form.tax_code,
				tax_name: form.tax_name,
				tax_description: form.tax_description || undefined,
				tax_type: form.tax_type,
				country_code: form.country_code,
				state_province: form.state_province || undefined,
				jurisdiction_name: form.jurisdiction_name || undefined,
				tax_rate: form.tax_rate,
				is_percentage: form.is_percentage,
				effective_from: form.effective_from,
				calculation_method: form.calculation_method.toLowerCase(),
				is_active: form.is_active,
			});
			this.toast.success("Tax configuration created.");
			this.showCreateForm.set(false);
			this.createForm.set({
				tax_code: "", tax_name: "", tax_description: "", tax_type: "OCCUPANCY_TAX",
				country_code: "US", state_province: "", jurisdiction_name: "",
				tax_rate: 0, is_percentage: true, effective_from: new Date().toISOString().split("T")[0],
				calculation_method: "EXCLUSIVE", is_active: true,
			});
			await this.loadTaxConfigs();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create tax config");
		} finally {
			this.creating.set(false);
		}
	}

	startEdit(tax: TaxConfigurationListItem): void {
		this.editingTaxId.set(tax.tax_config_id);
		this.showCreateForm.set(false);
		this.editForm.set({
			tax_code: tax.tax_code,
			tax_name: tax.tax_name,
			tax_description: tax.tax_description ?? "",
			tax_type: tax.tax_type,
			tax_rate: tax.tax_rate,
			is_percentage: tax.is_percentage,
			effective_from: tax.effective_from,
			calculation_method: tax.calculation_method ?? "EXCLUSIVE",
			is_active: tax.is_active,
		});
	}

	cancelEdit(): void {
		this.editingTaxId.set(null);
	}

	updateEditForm(partial: Record<string, unknown>): void {
		this.editForm.set({ ...this.editForm(), ...partial } as typeof this.editForm extends () => infer T ? T : never);
	}

	async saveEdit(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const taxConfigId = this.editingTaxId();
		if (!tenantId || !propertyId || !taxConfigId) return;
		this.editing.set(true);
		try {
			const form = this.editForm();
			await this.api.post(`/tenants/${tenantId}/billing/tax-configurations/${taxConfigId}/update`, {
				property_id: propertyId,
				tax_code: form.tax_code,
				tax_name: form.tax_name,
				tax_description: form.tax_description || undefined,
				tax_type: form.tax_type,
				tax_rate: form.tax_rate,
				is_percentage: form.is_percentage,
				effective_from: form.effective_from,
				calculation_method: form.calculation_method.toLowerCase(),
				is_active: form.is_active,
			});
			this.toast.success("Tax configuration updated.");
			this.editingTaxId.set(null);
			await this.loadTaxConfigs();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to update tax config");
		} finally {
			this.editing.set(false);
		}
	}

	showDelete(taxConfigId: string): void {
		this.deletingTaxId.set(taxConfigId);
		this.deleteReason.set("");
	}

	cancelDelete(): void {
		this.deletingTaxId.set(null);
	}

	async deleteTaxConfig(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const taxConfigId = this.deletingTaxId();
		if (!tenantId || !propertyId || !taxConfigId) return;
		this.deleting.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/tax-configurations/${taxConfigId}/delete`, {
				property_id: propertyId,
				reason: this.deleteReason() || undefined,
			});
			this.toast.success("Tax configuration deleted.");
			this.deletingTaxId.set(null);
			await this.loadTaxConfigs();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to delete tax config");
		} finally {
			this.deleting.set(false);
		}
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
