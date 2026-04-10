import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { FiscalPeriodListItem } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { settleCommandReadModel } from "../../../shared/command-refresh";
import { ToastService } from "../../../shared/toast/toast.service";

type StatusFilter = "ALL" | "FUTURE" | "OPEN" | "SOFT_CLOSE" | "CLOSED" | "LOCKED";

@Component({
	selector: "app-fiscal-periods",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./fiscal-periods.html",
	styleUrl: "./fiscal-periods.scss",
})
export class FiscalPeriodsComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	// ── State ──
	readonly periods = signal<FiscalPeriodListItem[]>([]);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly statusFilter = signal<StatusFilter>("ALL");
	readonly actionLoading = signal(false);

	// ── Close dialog ──
	readonly closingPeriodId = signal<string | null>(null);
	readonly closeReason = signal("");
	readonly reconciliationConfirmed = signal(false);

	// ── Reopen dialog ──
	readonly reopeningPeriodId = signal<string | null>(null);
	readonly reopenReason = signal("");

	readonly filtered = computed(() => {
		const status = this.statusFilter();
		const items = this.periods();
		if (status === "ALL") return items;
		return items.filter((p) => p.period_status === status);
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadPeriods();
		});
	}

	async loadPeriods(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.loading.set(true);
		this.error.set(null);
		try {
			const res = await this.api.get<{ data: FiscalPeriodListItem[] }>("/billing/fiscal-periods", {
				tenant_id: tenantId,
				property_id: propertyId,
			});
			this.periods.set(res.data ?? []);
		} catch (e) {
			this.periods.set([]);
			this.error.set(
				e instanceof Error
					? e.message
					: "Fiscal period list endpoint is not currently available through the API.",
			);
		} finally {
			this.loading.set(false);
		}
	}

	setStatusFilter(f: StatusFilter): void {
		this.statusFilter.set(f);
	}

	formatDate(d: string): string {
		return this.settings.formatDate(d);
	}

	formatCurrency(amount: number | string, currency = "USD"): string {
		return this.settings.formatCurrency(Number(amount), currency);
	}

	statusBadge(status: string): string {
		switch (status) {
			case "FUTURE":
				return "badge badge-accent";
			case "OPEN":
				return "badge badge-success";
			case "SOFT_CLOSE":
				return "badge badge-warning";
			case "CLOSED":
				return "badge badge-muted";
			case "LOCKED":
				return "badge badge-danger";
			default:
				return "badge";
		}
	}

	// ── State transitions ──
	canClose(p: FiscalPeriodListItem): boolean {
		return p.period_status === "OPEN";
	}
	canLock(p: FiscalPeriodListItem): boolean {
		return p.period_status === "SOFT_CLOSE";
	}
	canReopen(p: FiscalPeriodListItem): boolean {
		return p.period_status === "SOFT_CLOSE";
	}

	// ── Close ──
	showCloseDialog(p: FiscalPeriodListItem): void {
		this.closingPeriodId.set(p.fiscal_period_id);
		this.closeReason.set("");
		this.reconciliationConfirmed.set(false);
	}
	cancelClose(): void {
		this.closingPeriodId.set(null);
	}
	async submitClose(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const periodId = this.closingPeriodId();
		if (!tenantId || !propertyId || !periodId) return;

		this.actionLoading.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.fiscal_period.close`, {
				property_id: propertyId,
				period_id: periodId,
				close_reason: this.closeReason() || undefined,
				reconciliation_confirmed: this.reconciliationConfirmed(),
			});
			this.toast.success("Fiscal period close submitted. Refreshing periods...");
			this.closingPeriodId.set(null);
			await settleCommandReadModel(() => this.loadPeriods());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to close period.");
		} finally {
			this.actionLoading.set(false);
		}
	}

	// ── Lock ──
	async lockPeriod(p: FiscalPeriodListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.actionLoading.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.fiscal_period.lock`, {
				property_id: propertyId,
				period_id: p.fiscal_period_id,
			});
			this.toast.success("Fiscal period lock submitted. Refreshing periods...");
			await settleCommandReadModel(() => this.loadPeriods());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to lock period.");
		} finally {
			this.actionLoading.set(false);
		}
	}

	// ── Reopen ──
	showReopenDialog(p: FiscalPeriodListItem): void {
		this.reopeningPeriodId.set(p.fiscal_period_id);
		this.reopenReason.set("");
	}
	cancelReopen(): void {
		this.reopeningPeriodId.set(null);
	}
	async submitReopen(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const periodId = this.reopeningPeriodId();
		if (!tenantId || !propertyId || !periodId) return;

		if (!this.reopenReason()) {
			this.toast.error("Reason for reopening is required.");
			return;
		}

		this.actionLoading.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.fiscal_period.reopen`, {
				property_id: propertyId,
				period_id: periodId,
				reason: this.reopenReason(),
			});
			this.toast.success("Fiscal period reopen submitted. Refreshing periods...");
			this.reopeningPeriodId.set(null);
			await settleCommandReadModel(() => this.loadPeriods());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to reopen period.");
		} finally {
			this.actionLoading.set(false);
		}
	}
}
