import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { CommissionReportItem, CommissionReportResponse } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../../shared/sort-utils";
import { ToastService } from "../../../shared/toast/toast.service";

@Component({
	selector: "app-commissions",
	standalone: true,
	imports: [
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./commissions.html",
	styleUrl: "./commissions.scss",
})
export class CommissionsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	// ── Report data ──
	readonly items = signal<CommissionReportItem[]>([]);
	readonly totalCommission = signal(0);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);

	// ── Date filter ──
	readonly periodStart = signal(this.monthStart());
	readonly periodEnd = signal(this.todayString());

	// ── Sort ──
	readonly sort = createSortState();

	readonly sorted = computed(() => sortBy(this.items(), this.sort().column, this.sort().direction));

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadReport();
		});
	}

	async loadReport(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.loading.set(true);
		this.error.set(null);
		try {
			const res = await this.api.get<CommissionReportResponse>("/billing/reports/commissions", {
				tenant_id: tenantId,
				property_id: propertyId,
				start_date: this.periodStart(),
				end_date: this.periodEnd(),
			});
			this.items.set(res.items ?? []);
			this.totalCommission.set(res.total_commission ?? 0);
		} catch (e) {
			this.items.set([]);
			this.totalCommission.set(0);
			this.error.set(e instanceof Error ? e.message : "Failed to load commission report.");
		} finally {
			this.loading.set(false);
		}
	}

	// ── Sorting ──
	toggleSort(column: string): void {
		this.sort.set(toggleSort(this.sort(), column));
	}
	getSortIcon(column: string): string {
		return getSortIcon(this.sort(), column);
	}
	getAriaSort(column: string): string | null {
		return getAriaSort(this.sort(), column);
	}

	// ── Formatting ──
	formatCurrency(amount: number, currency = "USD"): string {
		return this.settings.formatCurrency(amount, currency);
	}

	// ── Date helpers ──
	private todayString(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}
	private monthStart(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
	}
}
