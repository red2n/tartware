import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type {
	BillingPaymentListItem,
	BillingPaymentListResponse,
	ChargePostingListItem,
	ChargePostingListResponse,
	FolioListItem,
	FolioListResponse,
	InvoiceListItem,
	InvoiceListResponse,
} from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { formatCurrency, formatShortDate } from "../../shared/format-utils";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../shared/sort-utils";

type BillingView = "payments" | "invoices" | "folios" | "charges";
type PaymentStatusFilter = "ALL" | "completed" | "pending" | "failed" | "refunded";
type InvoiceStatusFilter = "ALL" | "draft" | "issued" | "paid" | "overdue";
type FolioStatusFilter = "ALL" | "open" | "closed" | "settled";
type ChargeTypeFilter = "ALL" | "charge" | "payment" | "adjustment";

@Component({
	selector: "app-billing",
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
	templateUrl: "./billing.html",
	styleUrl: "./billing.scss",
})
export class BillingComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	readonly globalSearch = inject(GlobalSearchService);

	readonly activeView = signal<BillingView>("payments");

	// ── Payments ──
	readonly payments = signal<BillingPaymentListItem[]>([]);
	readonly paymentsLoading = signal(false);
	readonly paymentsError = signal<string | null>(null);
	readonly activePaymentFilter = signal<PaymentStatusFilter>("ALL");
	readonly paymentPage = signal(1);
	readonly paymentSort = createSortState();

	readonly paymentStatusFilters: { key: PaymentStatusFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "completed", label: "Completed" },
		{ key: "pending", label: "Pending" },
		{ key: "failed", label: "Failed" },
		{ key: "refunded", label: "Refunded" },
	];

	readonly filteredPayments = computed(() => {
		let list = this.payments();
		const status = this.activePaymentFilter();
		const query = this.globalSearch.query().toLowerCase().trim();
		if (status !== "ALL") list = list.filter((p) => p.status === status);
		if (query) {
			list = list.filter(
				(p) =>
					p.payment_reference.toLowerCase().includes(query) ||
					(p.guest_name?.toLowerCase().includes(query) ?? false) ||
					(p.confirmation_number?.toLowerCase().includes(query) ?? false) ||
					p.payment_method_display.toLowerCase().includes(query),
			);
		}
		return list;
	});

	readonly paginatedPayments = computed(() => {
		const sorted = sortBy(
			this.filteredPayments(),
			this.paymentSort().column,
			this.paymentSort().direction,
		);
		const start = (this.paymentPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly paymentFilterCounts = computed(() => {
		const all = this.payments();
		return {
			ALL: all.length,
			completed: all.filter((p) => p.status === "completed").length,
			pending: all.filter((p) => p.status === "pending").length,
			failed: all.filter((p) => p.status === "failed").length,
			refunded: all.filter((p) => p.status === "refunded").length,
		};
	});

	// ── Invoices ──
	readonly invoices = signal<InvoiceListItem[]>([]);
	readonly invoicesLoading = signal(false);
	readonly invoicesError = signal<string | null>(null);
	readonly activeInvoiceFilter = signal<InvoiceStatusFilter>("ALL");
	readonly invoicePage = signal(1);
	readonly invoiceSort = createSortState();

	readonly invoiceStatusFilters: { key: InvoiceStatusFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "issued", label: "Issued" },
		{ key: "paid", label: "Paid" },
		{ key: "overdue", label: "Overdue" },
		{ key: "draft", label: "Draft" },
	];

	readonly filteredInvoices = computed(() => {
		let list = this.invoices();
		const status = this.activeInvoiceFilter();
		const query = this.globalSearch.query().toLowerCase().trim();
		if (status !== "ALL") list = list.filter((i) => i.status === status);
		if (query) {
			list = list.filter(
				(i) =>
					i.invoice_number.toLowerCase().includes(query) ||
					(i.guest_name?.toLowerCase().includes(query) ?? false) ||
					(i.confirmation_number?.toLowerCase().includes(query) ?? false),
			);
		}
		return list;
	});

	readonly paginatedInvoices = computed(() => {
		const sorted = sortBy(
			this.filteredInvoices(),
			this.invoiceSort().column,
			this.invoiceSort().direction,
		);
		const start = (this.invoicePage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly invoiceFilterCounts = computed(() => {
		const all = this.invoices();
		return {
			ALL: all.length,
			issued: all.filter((i) => i.status === "issued").length,
			paid: all.filter((i) => i.status === "paid").length,
			overdue: all.filter((i) => i.status === "overdue").length,
			draft: all.filter((i) => i.status === "draft").length,
		};
	});

	// ── Folios ──
	readonly folios = signal<FolioListItem[]>([]);
	readonly foliosLoading = signal(false);
	readonly foliosError = signal<string | null>(null);
	readonly activeFolioFilter = signal<FolioStatusFilter>("ALL");
	readonly folioPage = signal(1);
	readonly folioSort = createSortState();

	readonly folioStatusFilters: { key: FolioStatusFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "open", label: "Open" },
		{ key: "closed", label: "Closed" },
		{ key: "settled", label: "Settled" },
	];

	readonly filteredFolios = computed(() => {
		let list = this.folios();
		const status = this.activeFolioFilter();
		const query = this.globalSearch.query().toLowerCase().trim();
		if (status !== "ALL") list = list.filter((f) => f.folio_status === status);
		if (query) {
			list = list.filter(
				(f) =>
					f.folio_number.toLowerCase().includes(query) ||
					(f.guest_name?.toLowerCase().includes(query) ?? false) ||
					(f.confirmation_number?.toLowerCase().includes(query) ?? false) ||
					(f.company_name?.toLowerCase().includes(query) ?? false),
			);
		}
		return list;
	});

	readonly paginatedFolios = computed(() => {
		const sorted = sortBy(
			this.filteredFolios(),
			this.folioSort().column,
			this.folioSort().direction,
		);
		const start = (this.folioPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly folioFilterCounts = computed(() => {
		const all = this.folios();
		return {
			ALL: all.length,
			open: all.filter((f) => f.folio_status === "open").length,
			closed: all.filter((f) => f.folio_status === "closed").length,
			settled: all.filter((f) => f.folio_status === "settled").length,
		};
	});

	// ── Charges ──
	readonly charges = signal<ChargePostingListItem[]>([]);
	readonly chargesLoading = signal(false);
	readonly chargesError = signal<string | null>(null);
	readonly activeChargeFilter = signal<ChargeTypeFilter>("ALL");
	readonly chargePage = signal(1);
	readonly chargeSort = createSortState();
	private readonly _resetPage = effect(() => {
		this.globalSearch.query();
		this.paymentPage.set(1);
		this.invoicePage.set(1);
		this.folioPage.set(1);
		this.chargePage.set(1);
	});

	readonly chargeTypeFilters: { key: ChargeTypeFilter; label: string }[] = [
		{ key: "ALL", label: "All" },
		{ key: "charge", label: "Charges" },
		{ key: "payment", label: "Payments" },
		{ key: "adjustment", label: "Adjustments" },
	];

	readonly filteredCharges = computed(() => {
		let list = this.charges();
		const type = this.activeChargeFilter();
		const query = this.globalSearch.query().toLowerCase().trim();
		if (type !== "ALL") list = list.filter((c) => c.transaction_type === type);
		if (query) {
			list = list.filter(
				(c) =>
					c.charge_code.toLowerCase().includes(query) ||
					c.charge_description.toLowerCase().includes(query) ||
					(c.guest_name?.toLowerCase().includes(query) ?? false) ||
					(c.folio_number?.toLowerCase().includes(query) ?? false),
			);
		}
		return list;
	});

	readonly paginatedCharges = computed(() => {
		const sorted = sortBy(
			this.filteredCharges(),
			this.chargeSort().column,
			this.chargeSort().direction,
		);
		const start = (this.chargePage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});

	readonly chargeFilterCounts = computed(() => {
		const all = this.charges();
		return {
			ALL: all.length,
			charge: all.filter((c) => c.transaction_type === "charge").length,
			payment: all.filter((c) => c.transaction_type === "payment").length,
			adjustment: all.filter((c) => c.transaction_type === "adjustment").length,
		};
	});

	// ── Shared ──
	readonly pageSize = 25;

	/** KPI summary across all billing data. */
	readonly summary = computed(() => {
		const pays = this.payments();
		const invs = this.invoices();
		const fols = this.folios();
		const completedPayments = pays.filter((p) => p.status === "completed");
		const totalReceived = completedPayments.reduce((sum, p) => sum + p.amount, 0);
		const currency = pays[0]?.currency ?? invs[0]?.currency ?? "USD";
		const outstandingBalance = fols
			.filter((f) => f.folio_status === "open")
			.reduce((sum, f) => sum + f.balance, 0);
		const overdueCount = invs.filter((i) => i.status === "overdue").length;
		const openFolios = fols.filter((f) => f.folio_status === "open").length;
		return { totalReceived, outstandingBalance, overdueCount, openFolios, currency };
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadAll();
		});
	}

	setView(view: BillingView): void {
		this.activeView.set(view);
	}

	// ── Payment actions ──
	setPaymentFilter(f: PaymentStatusFilter): void {
		this.activePaymentFilter.set(f);
		this.paymentPage.set(1);
	}
	onPaymentSort(col: string): void {
		this.paymentSort.set(toggleSort(this.paymentSort(), col));
		this.paymentPage.set(1);
	}

	// ── Invoice actions ──
	setInvoiceFilter(f: InvoiceStatusFilter): void {
		this.activeInvoiceFilter.set(f);
		this.invoicePage.set(1);
	}
	onInvoiceSort(col: string): void {
		this.invoiceSort.set(toggleSort(this.invoiceSort(), col));
		this.invoicePage.set(1);
	}

	// ── Folio actions ──
	setFolioFilter(f: FolioStatusFilter): void {
		this.activeFolioFilter.set(f);
		this.folioPage.set(1);
	}
	onFolioSort(col: string): void {
		this.folioSort.set(toggleSort(this.folioSort(), col));
		this.folioPage.set(1);
	}

	// ── Charge actions ──
	setChargeFilter(f: ChargeTypeFilter): void {
		this.activeChargeFilter.set(f);
		this.chargePage.set(1);
	}
	onChargeSort(col: string): void {
		this.chargeSort.set(toggleSort(this.chargeSort(), col));
		this.chargePage.set(1);
	}

	// ── Sort helpers ──
	sortIcon(sort: ReturnType<typeof createSortState>, col: string): string {
		const s = sort();
		if (s.column !== col) return "unfold_more";
		return s.direction === "asc" ? "arrow_upward" : "arrow_downward";
	}

	ariaSort(sort: ReturnType<typeof createSortState>, col: string): string | null {
		const s = sort();
		if (s.column !== col) return null;
		return s.direction === "asc" ? "ascending" : "descending";
	}

	// ── Display helpers ──
	paymentStatusClass(status: string): string {
		switch (status) {
			case "completed":
				return "badge-success";
			case "pending":
				return "badge-warning";
			case "failed":
				return "badge-danger";
			case "refunded":
				return "badge-accent";
			case "authorized":
				return "badge-muted";
			default:
				return "";
		}
	}

	invoiceStatusClass(status: string): string {
		switch (status) {
			case "paid":
				return "badge-success";
			case "issued":
				return "badge-accent";
			case "overdue":
				return "badge-danger";
			case "draft":
				return "badge-muted";
			case "cancelled":
			case "void":
				return "badge-danger";
			default:
				return "";
		}
	}

	folioStatusClass(status: string): string {
		switch (status) {
			case "open":
				return "badge-accent";
			case "closed":
				return "badge-muted";
			case "settled":
				return "badge-success";
			default:
				return "";
		}
	}

	chargeTypeClass(type: string): string {
		switch (type) {
			case "charge":
				return "badge-danger";
			case "payment":
				return "badge-success";
			case "adjustment":
				return "badge-warning";
			case "refund":
				return "badge-accent";
			default:
				return "";
		}
	}

	formatDate = formatShortDate;
	formatCurrency = formatCurrency;

	// ── Data loading ──
	loadAll(): void {
		this.loadPayments();
		this.loadInvoices();
		this.loadFolios();
		this.loadCharges();
	}

	async loadPayments(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.paymentsLoading.set(true);
		this.paymentsError.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<BillingPaymentListResponse>("/billing/payments", params);
			this.payments.set(res.data ?? []);
		} catch (e) {
			this.paymentsError.set(e instanceof Error ? e.message : "Failed to load payments");
		} finally {
			this.paymentsLoading.set(false);
		}
	}

	async loadInvoices(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.invoicesLoading.set(true);
		this.invoicesError.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<InvoiceListResponse>("/billing/invoices", params);
			this.invoices.set(res.data ?? []);
		} catch (e) {
			this.invoicesError.set(e instanceof Error ? e.message : "Failed to load invoices");
		} finally {
			this.invoicesLoading.set(false);
		}
	}

	async loadFolios(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.foliosLoading.set(true);
		this.foliosError.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<FolioListResponse>("/billing/folios", params);
			this.folios.set(res.data ?? []);
		} catch (e) {
			this.foliosError.set(e instanceof Error ? e.message : "Failed to load folios");
		} finally {
			this.foliosLoading.set(false);
		}
	}

	async loadCharges(): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.chargesLoading.set(true);
		this.chargesError.set(null);
		try {
			const params: Record<string, string> = { tenant_id: tenantId, limit: "200" };
			const propertyId = this.ctx.propertyId();
			if (propertyId) params["property_id"] = propertyId;
			const res = await this.api.get<ChargePostingListResponse>("/billing/charges", params);
			this.charges.set(res.data ?? []);
		} catch (e) {
			this.chargesError.set(e instanceof Error ? e.message : "Failed to load charges");
		} finally {
			this.chargesLoading.set(false);
		}
	}
}
