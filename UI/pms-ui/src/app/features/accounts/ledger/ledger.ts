import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { LedgerEntryListItem, LedgerEntryListResponse } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { SettingsService } from "../../../core/settings/settings.service";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { settleCommandReadModel } from "../../../shared/command-refresh";
import {
	createSortState,
	getAriaSort,
	getSortIcon,
	sortBy,
	toggleSort,
} from "../../../shared/sort-utils";
import { ToastService } from "../../../shared/toast/toast.service";

type LedgerStatusFilter = "ALL" | "draft" | "ready" | "posted" | "voided";
type BatchStatusFilter = "ALL" | "open" | "review" | "posted" | "error";

@Component({
	selector: "app-ledger",
	standalone: true,
	imports: [
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatTooltipModule,
		PageHeaderComponent,
		TranslatePipe,
	],
	templateUrl: "./ledger.html",
	styleUrl: "./ledger.scss",
})
export class LedgerComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	readonly items = signal<LedgerEntryListItem[]>([]);
	readonly dataReady = signal(false);
	readonly posting = signal(false);
	readonly error = signal<string | null>(null);
	readonly statusFilter = signal<LedgerStatusFilter>("ALL");
	readonly batchStatusFilter = signal<BatchStatusFilter>("ALL");
	readonly glAccountCode = signal("");
	readonly departmentCode = signal("");
	readonly startDate = signal(this.monthStart());
	readonly endDate = signal(this.todayString());
	readonly sort = createSortState();

	readonly sorted = computed(() =>
		sortBy(this.items(), this.sort().column, this.sort().direction),
	);

	readonly totals = computed(() => {
		const rows = this.items();
		const totalDebits = rows.reduce((sum, item) => sum + item.debit_amount, 0);
		const totalCredits = rows.reduce((sum, item) => sum + item.credit_amount, 0);
		const postedCount = rows.filter((item) => item.status === "posted").length;
		return {
			totalDebits,
			totalCredits,
			variance: totalDebits - totalCredits,
			postedCount,
			currency: rows[0]?.currency ?? "USD",
		};
	});

	constructor() {
		this.sort.set({ column: "posting_date", direction: "desc" });
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			void this.loadLedger();
		});
	}

	async loadLedger(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.dataReady.set(false);
		this.error.set(null);
		try {
			const params: Record<string, string> = {
				tenant_id: tenantId,
				property_id: propertyId,
				limit: "250",
			};

			if (this.statusFilter() !== "ALL") params["status"] = this.statusFilter();
			if (this.batchStatusFilter() !== "ALL") params["batch_status"] = this.batchStatusFilter();
			if (this.glAccountCode().trim()) params["gl_account_code"] = this.glAccountCode().trim();
			if (this.departmentCode().trim()) params["department_code"] = this.departmentCode().trim();
			if (this.startDate()) params["start_date"] = this.startDate();
			if (this.endDate()) params["end_date"] = this.endDate();

			const response = await this.api.get<LedgerEntryListResponse>("/billing/ledger", params);
			this.items.set(response.data ?? []);
		} catch (e) {
			this.items.set([]);
			this.error.set(e instanceof Error ? e.message : "Failed to load ledger entries.");
		} finally {
			this.dataReady.set(true);
		}
	}

	resetFilters(): void {
		this.statusFilter.set("ALL");
		this.batchStatusFilter.set("ALL");
		this.glAccountCode.set("");
		this.departmentCode.set("");
		this.startDate.set(this.monthStart());
		this.endDate.set(this.todayString());
		void this.loadLedger();
	}

	async postLedger(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.posting.set(true);
		try {
			const businessDate = this.endDate() || this.todayString();
			await this.api.post(`/tenants/${tenantId}/commands/billing.ledger.post`, {
				property_id: propertyId,
				business_date: businessDate,
			});
			this.toast.success(`Ledger post submitted for ${businessDate}. Refreshing ledger...`);
			await settleCommandReadModel(() => this.loadLedger());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to post ledger");
		} finally {
			this.posting.set(false);
		}
	}

	toggleSort(column: string): void {
		this.sort.set(toggleSort(this.sort(), column));
	}

	getSortIcon(column: string): string {
		return getSortIcon(this.sort(), column);
	}

	getAriaSort(column: string): string | null {
		return getAriaSort(this.sort(), column);
	}

	formatCurrency(amount: number, currency = "USD"): string {
		return this.settings.formatCurrency(amount, currency);
	}

	formatDate(value?: string): string {
		return value ? this.settings.formatDate(value) : "—";
	}

	statusBadge(status: string): string {
		switch (status) {
			case "posted":
				return "badge badge-success";
			case "ready":
				return "badge badge-accent";
			case "voided":
				return "badge badge-danger";
			default:
				return "badge badge-muted";
		}
	}

	batchBadge(status?: string): string {
		switch (status) {
			case "posted":
				return "badge badge-success";
			case "review":
				return "badge badge-warning";
			case "error":
				return "badge badge-danger";
			default:
				return "badge badge-muted";
		}
	}

	private todayString(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}

	private monthStart(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
	}
}
