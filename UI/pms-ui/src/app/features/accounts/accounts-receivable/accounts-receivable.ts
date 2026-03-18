import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type {
	AccountsReceivableDetail,
	AccountsReceivableListItem,
	ArAgingSummary,
} from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../../core/search/global-search.service";
import { PageHeaderComponent } from "../../../shared/components/page-header/page-header";
import { formatCurrency, formatShortDate } from "../../../shared/format-utils";
import { PaginationComponent } from "../../../shared/pagination/pagination";
import { createSortState, getAriaSort, getSortIcon, sortBy, toggleSort } from "../../../shared/sort-utils";
import { ToastService } from "../../../shared/toast/toast.service";

type StatusFilter = "ALL" | "open" | "partial" | "paid" | "overdue" | "in_collection" | "written_off" | "disputed";
type AccountTypeFilter = "ALL" | "guest" | "corporate" | "travel_agent" | "group" | "direct_bill" | "city_ledger";
type AgingFilter = "ALL" | "current" | "1_30_days" | "31_60_days" | "61_90_days" | "91_120_days" | "over_120_days";

@Component({
	selector: "app-accounts-receivable",
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
	templateUrl: "./accounts-receivable.html",
	styleUrl: "./accounts-receivable.scss",
})
export class AccountsReceivableComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly globalSearch = inject(GlobalSearchService);

	// ── State ──
	readonly arItems = signal<AccountsReceivableListItem[]>([]);
	readonly agingSummary = signal<ArAgingSummary[]>([]);
	readonly selectedAr = signal<AccountsReceivableDetail | null>(null);
	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly activeStatusFilter = signal<StatusFilter>("ALL");
	readonly activeTypeFilter = signal<AccountTypeFilter>("ALL");
	readonly activeAgingFilter = signal<AgingFilter>("ALL");
	readonly page = signal(1);
	readonly sort = createSortState();
	readonly pageSize = 25;
	private readonly _resetPage = effect(() => {
		this.globalSearch.query();
		this.page.set(1);
	});

	// ── Action state ──
	readonly showPaymentForm = signal(false);
	readonly applyingPayment = signal(false);
	readonly paymentForm = signal({
		amount: 0,
		payment_reference: "",
		payment_method: "check",
		notes: "",
	});

	readonly showWriteOffForm = signal(false);
	readonly writingOff = signal(false);
	readonly writeOffForm = signal({
		write_off_amount: 0,
		reason: "",
	});

	readonly recalculatingAging = signal(false);

	readonly statusFilters: { key: StatusFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "open", label: "Open" },
		{ key: "partial", label: "Partial" },
		{ key: "overdue", label: "Overdue" },
		{ key: "in_collection", label: "In Collection" },
		{ key: "disputed", label: "Disputed" },
		{ key: "written_off", label: "Written Off" },
		{ key: "paid", label: "Paid" },
	];

	readonly typeFilters: { key: AccountTypeFilter; label: string }[] = [
		{ key: "ALL", label: "All Types" },
		{ key: "guest", label: "Guest" },
		{ key: "corporate", label: "Corporate" },
		{ key: "city_ledger", label: "City Ledger" },
		{ key: "direct_bill", label: "Direct Bill" },
		{ key: "travel_agent", label: "Travel Agent" },
		{ key: "group", label: "Group" },
	];

	readonly agingFilters: { key: AgingFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "current", label: "Current" },
		{ key: "1_30_days", label: "1–30 days" },
		{ key: "31_60_days", label: "31–60 days" },
		{ key: "61_90_days", label: "61–90 days" },
		{ key: "91_120_days", label: "91–120 days" },
		{ key: "over_120_days", label: "120+ days" },
	];

	readonly filtered = computed(() => {
		let list = this.arItems();
		const status = this.activeStatusFilter();
		const type = this.activeTypeFilter();
		const aging = this.activeAgingFilter();
		const query = this.globalSearch.query().toLowerCase().trim();
		if (status !== "ALL") list = list.filter((a) => a.ar_status === status);
		if (type !== "ALL") list = list.filter((a) => a.account_type === type);
		if (aging !== "ALL") list = list.filter((a) => a.aging_bucket === aging);
		if (query) {
			list = list.filter(
				(a) =>
					a.ar_number.toLowerCase().includes(query) ||
					a.account_name.toLowerCase().includes(query) ||
					(a.guest_name?.toLowerCase().includes(query) ?? false) ||
					(a.ar_reference?.toLowerCase().includes(query) ?? false),
			);
		}
		return list;
	});

	readonly paginated = computed(() => {
		const sorted = sortBy(this.filtered(), this.sort().column, this.sort().direction);
		const start = (this.page() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly summary = computed(() => {
		const all = this.arItems();
		const totalOutstanding = all.reduce(
			(sum, a) => sum + Number.parseFloat(a.outstanding_balance || "0"),
			0,
		);
		const overdueCount = all.filter((a) => a.is_overdue).length;
		const openCount = all.filter((a) => a.ar_status === "open" || a.ar_status === "partial").length;
		return { total: all.length, totalOutstanding, overdueCount, openCount };
	});

	readonly agingTotals = computed(() => {
		const summaries = this.agingSummary();
		if (summaries.length === 0)
			return { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_91_120: 0, over_120: 0, total: 0 };
		return summaries.reduce(
			(acc, s) => ({
				current: acc.current + Number.parseFloat(s.current || "0"),
				days_1_30: acc.days_1_30 + Number.parseFloat(s.days_1_30 || "0"),
				days_31_60: acc.days_31_60 + Number.parseFloat(s.days_31_60 || "0"),
				days_61_90: acc.days_61_90 + Number.parseFloat(s.days_61_90 || "0"),
				days_91_120: acc.days_91_120 + Number.parseFloat(s.days_91_120 || "0"),
				over_120: acc.over_120 + Number.parseFloat(s.over_120 || "0"),
				total: acc.total + Number.parseFloat(s.total_outstanding || "0"),
			}),
			{ current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_91_120: 0, over_120: 0, total: 0 },
		);
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadArData();
		});
	}

	// ── Filter actions ──
	setStatusFilter(f: StatusFilter): void {
		this.activeStatusFilter.set(f);
		this.page.set(1);
	}
	setTypeFilter(f: AccountTypeFilter): void {
		this.activeTypeFilter.set(f);
		this.page.set(1);
	}
	setAgingFilter(f: AgingFilter): void {
		this.activeAgingFilter.set(f);
		this.page.set(1);
	}
	onSort(col: string): void {
		this.sort.set(toggleSort(this.sort(), col));
		this.page.set(1);
	}

	sortIcon = (col: string) => getSortIcon(this.sort(), col);
	ariaSort = (col: string) => getAriaSort(this.sort(), col);

	formatDate = formatShortDate;

	fmtMoney(amount: number, currency = "USD"): string {
		return formatCurrency(amount, currency);
	}

	statusClass(status: string): string {
		const map: Record<string, string> = {
			open: "status-open",
			partial: "status-warning",
			paid: "status-success",
			overdue: "status-danger",
			in_collection: "status-danger",
			written_off: "status-muted",
			disputed: "status-warning",
			cancelled: "status-muted",
		};
		return map[status] ?? "";
	}

	// ── Detail ──
	async selectAr(item: AccountsReceivableListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		try {
			const detail = await this.api.get<AccountsReceivableDetail>(
				`/billing/accounts-receivable/${item.ar_id}`,
				{ tenant_id: tenantId },
			);
			this.selectedAr.set(detail);
		} catch {
			this.selectedAr.set(null);
		}
	}

	closeDetail(): void {
		this.selectedAr.set(null);
		this.showPaymentForm.set(false);
		this.showWriteOffForm.set(false);
	}

	// ── Apply Payment ──
	togglePaymentForm(): void {
		this.showPaymentForm.set(!this.showPaymentForm());
		this.showWriteOffForm.set(false);
		const detail = this.selectedAr();
		if (detail && this.showPaymentForm()) {
			this.paymentForm.set({
				amount: Number.parseFloat(detail.outstanding_balance || "0"),
				payment_reference: "",
				payment_method: "check",
				notes: "",
			});
		}
	}

	updatePaymentForm(partial: Partial<typeof this.paymentForm extends () => infer T ? T : never>): void {
		this.paymentForm.set({ ...this.paymentForm(), ...partial });
	}

	async applyPayment(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const detail = this.selectedAr();
		if (!tenantId || !detail) return;

		this.applyingPayment.set(true);
		try {
			const form = this.paymentForm();
			await this.api.post(`/tenants/${tenantId}/commands/billing.ar.apply_payment`, {
				ar_id: detail.ar_id,
				amount: form.amount,
				payment_reference: form.payment_reference,
				payment_method: form.payment_method || undefined,
				notes: form.notes || undefined,
			});
			this.toast.success("Payment applied successfully.");
			this.showPaymentForm.set(false);
			this.closeDetail();
			await this.loadArData();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to apply payment");
		} finally {
			this.applyingPayment.set(false);
		}
	}

	// ── Write Off ──
	toggleWriteOffForm(): void {
		this.showWriteOffForm.set(!this.showWriteOffForm());
		this.showPaymentForm.set(false);
		const detail = this.selectedAr();
		if (detail && this.showWriteOffForm()) {
			this.writeOffForm.set({
				write_off_amount: Number.parseFloat(detail.outstanding_balance || "0"),
				reason: "",
			});
		}
	}

	updateWriteOffForm(partial: Partial<typeof this.writeOffForm extends () => infer T ? T : never>): void {
		this.writeOffForm.set({ ...this.writeOffForm(), ...partial });
	}

	async writeOff(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const detail = this.selectedAr();
		if (!tenantId || !detail) return;

		this.writingOff.set(true);
		try {
			const form = this.writeOffForm();
			await this.api.post(`/tenants/${tenantId}/commands/billing.ar.write_off`, {
				ar_id: detail.ar_id,
				write_off_amount: form.write_off_amount,
				reason: form.reason,
			});
			this.toast.success("AR entry written off.");
			this.showWriteOffForm.set(false);
			this.closeDetail();
			await this.loadArData();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to write off AR");
		} finally {
			this.writingOff.set(false);
		}
	}

	// ── Recalculate Aging ──
	async recalculateAging(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.recalculatingAging.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/commands/billing.ar.age`, {
				property_id: propertyId,
			});
			this.toast.success("Aging recalculation initiated.");
			await this.loadArData();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to recalculate aging");
		} finally {
			this.recalculatingAging.set(false);
		}
	}

	// ── Data loading ──
	async loadArData(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.loading.set(true);
		this.error.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "500" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;

			const [items, aging] = await Promise.all([
				this.api.get<AccountsReceivableListItem[]>("/billing/accounts-receivable", params),
				this.api.get<ArAgingSummary[]>("/billing/accounts-receivable/aging-summary", params),
			]);
			this.arItems.set(items);
			this.agingSummary.set(aging);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Failed to load AR data");
		} finally {
			this.loading.set(false);
		}
	}
}
