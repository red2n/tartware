import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type {
	BillingPaymentListItem,
	ChargePostingListItem,
	FolioListItem,
	InvoiceListItem,
} from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { SettingsService } from "../../core/settings/settings.service";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../shared/sort-utils";
import { ToastService } from "../../shared/toast/toast.service";

import {
	CHARGE_CODE_OPTIONS,
	CHARGE_TYPE_FILTERS,
	DEFAULT_PAGE_SIZE,
	FOLIO_STATUS_FILTERS,
	FOLIO_TYPE_OPTIONS,
	INVOICE_STATUS_FILTERS,
	PAYMENT_METHOD_OPTIONS,
	PAYMENT_STATUS_FILTERS,
	type BillingView,
	type ChargeTypeFilter,
	type FolioStatusFilter,
	type InvoiceStatusFilter,
	type PaymentStatusFilter,
} from "./billing-constants";
import { BillingDataService } from "./billing-data.service";
import {
	canCloseFolio,
	canCreditNote,
	canFinalizeInvoice,
	canRefundPayment,
	canVoidCharge,
	canVoidInvoice,
	canVoidPayment,
	chargeTypeClass,
	folioStatusClass,
	invoiceStatusClass,
	paymentStatusClass,
} from "./billing-utils";

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
	providers: [BillingDataService],
})
export class BillingComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly data = inject(BillingDataService);
	readonly globalSearch = inject(GlobalSearchService);
	readonly settings = inject(SettingsService);

	// ── Reusable option lists from billing-constants ──
	readonly chargeCodeOptions = CHARGE_CODE_OPTIONS;
	readonly paymentMethodOptions = PAYMENT_METHOD_OPTIONS;
	readonly folioTypeOptions = FOLIO_TYPE_OPTIONS;

	readonly activeView = signal<BillingView>("payments");

	// ── Delegate data signals to BillingDataService ──
	readonly payments = this.data.payments;
	readonly paymentsLoading = this.data.paymentsLoading;
	readonly paymentsError = this.data.paymentsError;
	readonly activePaymentFilter = signal<PaymentStatusFilter>("ALL");
	readonly paymentPage = signal(1);
	readonly paymentSort = createSortState();

	readonly paymentStatusFilters = PAYMENT_STATUS_FILTERS;

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
			authorized: all.filter((p) => p.status === "authorized").length,
			failed: all.filter((p) => p.status === "failed").length,
			cancelled: all.filter((p) => p.status === "cancelled").length,
			refunded: all.filter((p) => p.status === "refunded").length,
			partially_refunded: all.filter((p) => p.status === "partially_refunded").length,
		};
	});

	// ── Invoices ──
	readonly invoices = this.data.invoices;
	readonly invoicesLoading = this.data.invoicesLoading;
	readonly invoicesError = this.data.invoicesError;
	readonly activeInvoiceFilter = signal<InvoiceStatusFilter>("ALL");
	readonly invoicePage = signal(1);
	readonly invoiceSort = createSortState();

	readonly invoiceStatusFilters = INVOICE_STATUS_FILTERS;

	readonly filteredInvoices = computed(() => {
		let list = this.invoices();
		const status = this.activeInvoiceFilter();
		const query = this.globalSearch.query().toLowerCase().trim();
		if (status !== "ALL") list = list.filter((i) => i.status === status);
		if (query) {
			list = list.filter(
				(i) =>
					(i.invoice_number?.toLowerCase().includes(query) ?? false) ||
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
	readonly folios = this.data.folios;
	readonly foliosLoading = this.data.foliosLoading;
	readonly foliosError = this.data.foliosError;
	readonly activeFolioFilter = signal<FolioStatusFilter>("ALL");
	readonly folioPage = signal(1);
	readonly folioSort = createSortState();

	readonly folioStatusFilters = FOLIO_STATUS_FILTERS;

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
	readonly charges = this.data.charges;
	readonly chargesLoading = this.data.chargesLoading;
	readonly chargesError = this.data.chargesError;
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

	readonly chargeTypeFilters = CHARGE_TYPE_FILTERS;

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
	readonly pageSize = DEFAULT_PAGE_SIZE;

	/** KPI summary across all billing data. */
	readonly summary = this.data.summary;

	constructor() {
		// On tenant/property change, load the active tab first, then the rest incrementally
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.data.loadForView(this.activeView());
		});
	}

	setView(view: BillingView): void {
		this.activeView.set(view);
		// Ensure the tab data is loaded when the user switches to it
		this.data.ensureLoaded(view);
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

	// ── Display helpers (delegated to billing-utils) ──
	readonly paymentStatusClass = paymentStatusClass;
	readonly invoiceStatusClass = invoiceStatusClass;
	readonly folioStatusClass = folioStatusClass;
	readonly chargeTypeClass = chargeTypeClass;

	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}
	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	// ── Payment action state ──
	readonly voidingPaymentId = signal<string | null>(null);
	readonly voidPaymentReason = signal("");
	readonly processingVoid = signal(false);
	readonly refundingPaymentId = signal<string | null>(null);
	readonly refundForm = signal({ amount: 0, reason: "" });
	readonly processingRefund = signal(false);

	// ── Invoice action state ──
	readonly processingInvoiceAction = signal<string | null>(null);
	readonly creditNoteInvoiceId = signal<string | null>(null);
	readonly creditNoteForm = signal({ credit_amount: 0, reason: "" });
	readonly processingCreditNote = signal(false);
	readonly voidInvoiceId = signal<string | null>(null);
	readonly voidInvoiceReason = signal("");
	readonly processingInvoiceVoid = signal(false);
	readonly showCreateInvoiceForm = signal(false);
	readonly createInvoiceForm = signal({
		reservation_id: "" as string,
		guest_id: "" as string,
		total_amount: 0,
		due_date: "" as string,
		notes: "" as string,
	});
	readonly creatingInvoice = signal(false);

	/** Unique guests derived from loaded folios for the invoice form picker. */
	readonly availableGuests = this.data.availableGuests;

	/** Reservations available for the selected guest. */
	readonly availableReservations = computed(() =>
		this.data.reservationsForGuest(this.createInvoiceForm().guest_id),
	);

	// ── Folio action state ──
	readonly showCreateFolioForm = signal(false);
	readonly createFolioForm = signal({
		folio_type: "HOUSE_ACCOUNT" as string,
		folio_name: "",
		notes: "",
	});
	readonly creatingFolio = signal(false);
	readonly selectedFolioId = this.data.selectedFolioId;
	readonly folioCharges = this.data.folioCharges;
	readonly folioChargesLoading = this.data.folioChargesLoading;

	// ── Charge posting state ──
	readonly showPostChargeForm = signal(false);
	readonly postChargeForm = signal({
		folio_id: "" as string,
		charge_code: "MISC" as string,
		amount: 0,
		quantity: 1,
		description: "" as string,
		department_code: "" as string,
	});
	readonly postingCharge = signal(false);

	/** Open folios available as charge targets. */
	readonly openFolios = this.data.openFolios;

	// ── Payment capture state ──
	readonly showCapturePaymentForm = signal(false);
	readonly capturePaymentForm = signal({
		folio_id: "" as string,
		amount: 0,
		payment_method: "CASH" as string,
		payment_reference: "" as string,
	});
	readonly capturingPayment = signal(false);

	// ── Charge void state ──
	readonly voidingChargeId = signal<string | null>(null);
	readonly voidChargeReason = signal("");
	readonly processingChargeVoid = signal(false);

	// ── Folio close state ──
	readonly closingFolioId = signal<string | null>(null);
	readonly closeFolioReason = signal("");
	readonly closeFolioForce = signal(false);
	readonly processingFolioClose = signal(false);

	// ── Payment actions ──
	showVoidPayment(paymentId: string): void {
		this.voidingPaymentId.set(paymentId);
		this.voidPaymentReason.set("");
	}
	cancelVoidPayment(): void {
		this.voidingPaymentId.set(null);
	}
	async voidPayment(payment: BillingPaymentListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.processingVoid.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/payments/${payment.id}/void`, {
				payment_reference: payment.payment_reference,
				property_id: this.ctx.propertyId(),
				reservation_id: payment.reservation_id,
				reason: this.voidPaymentReason() || undefined,
			});
			this.toast.success("Payment voided.");
			this.voidingPaymentId.set(null);
			await this.loadPayments();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to void payment");
		} finally {
			this.processingVoid.set(false);
		}
	}

	showRefundPayment(payment: BillingPaymentListItem): void {
		this.refundingPaymentId.set(payment.id);
		this.refundForm.set({ amount: payment.amount, reason: "" });
	}
	cancelRefundPayment(): void {
		this.refundingPaymentId.set(null);
	}
	async refundPayment(payment: BillingPaymentListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.processingRefund.set(true);
		try {
			const form = this.refundForm();
			await this.api.post(`/tenants/${tenantId}/billing/payments/${payment.id}/refund`, {
				payment_id: payment.id,
				property_id: this.ctx.propertyId(),
				reservation_id: payment.reservation_id,
				guest_id: payment.guest_id,
				amount: form.amount,
				reason: form.reason || undefined,
			});
			this.toast.success("Refund submitted.");
			this.refundingPaymentId.set(null);
			await this.loadPayments();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to refund payment");
		} finally {
			this.processingRefund.set(false);
		}
	}

	readonly canVoid = canVoidPayment;
	readonly canRefund = canRefundPayment;

	// ── Invoice actions ──
	async finalizeInvoice(invoice: InvoiceListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.processingInvoiceAction.set(invoice.id);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${invoice.id}/finalize`, {});
			this.toast.success("Invoice finalized.");
			await this.loadInvoices();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to finalize invoice");
		} finally {
			this.processingInvoiceAction.set(null);
		}
	}

	showVoidInvoice(invoiceId: string): void {
		this.voidInvoiceId.set(invoiceId);
		this.voidInvoiceReason.set("");
	}
	cancelVoidInvoice(): void {
		this.voidInvoiceId.set(null);
	}
	async voidInvoice(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const invoiceId = this.voidInvoiceId();
		if (!tenantId || !invoiceId) return;
		this.processingInvoiceVoid.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${invoiceId}/void`, {
				reason: this.voidInvoiceReason() || undefined,
			});
			this.toast.success("Invoice voided.");
			this.voidInvoiceId.set(null);
			await this.loadInvoices();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to void invoice");
		} finally {
			this.processingInvoiceVoid.set(false);
		}
	}

	showCreditNote(invoice: InvoiceListItem): void {
		this.creditNoteInvoiceId.set(invoice.id);
		this.creditNoteForm.set({ credit_amount: invoice.total_amount, reason: "" });
	}
	cancelCreditNote(): void {
		this.creditNoteInvoiceId.set(null);
	}
	async createCreditNote(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const invoiceId = this.creditNoteInvoiceId();
		if (!tenantId || !invoiceId) return;
		this.processingCreditNote.set(true);
		try {
			const form = this.creditNoteForm();
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${invoiceId}/credit-note`, {
				property_id: this.ctx.propertyId(),
				credit_amount: form.credit_amount,
				reason: form.reason,
			});
			this.toast.success("Credit note created.");
			this.creditNoteInvoiceId.set(null);
			await this.loadInvoices();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create credit note");
		} finally {
			this.processingCreditNote.set(false);
		}
	}

	readonly canVoidInvoice = canVoidInvoice;
	readonly canFinalizeInvoice = canFinalizeInvoice;
	readonly canCreditNote = canCreditNote;

	// ── Invoice creation ──
	toggleCreateInvoiceForm(): void {
		this.showCreateInvoiceForm.set(!this.showCreateInvoiceForm());
	}
	updateCreateInvoiceForm(
		partial: Partial<{
			reservation_id: string;
			guest_id: string;
			total_amount: number;
			due_date: string;
			notes: string;
		}>,
	): void {
		this.createInvoiceForm.set({ ...this.createInvoiceForm(), ...partial });
	}
	async createInvoice(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		const form = this.createInvoiceForm();
		if (!form.guest_id || form.total_amount <= 0) return;
		this.creatingInvoice.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices`, {
				property_id: propertyId,
				guest_id: form.guest_id,
				reservation_id: form.reservation_id || undefined,
				total_amount: form.total_amount,
				due_date: form.due_date || undefined,
				notes: form.notes || undefined,
			});
			this.toast.success("Invoice created.");
			this.showCreateInvoiceForm.set(false);
			this.createInvoiceForm.set({
				reservation_id: "",
				guest_id: "",
				total_amount: 0,
				due_date: "",
				notes: "",
			});
			await this.loadInvoices();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create invoice");
		} finally {
			this.creatingInvoice.set(false);
		}
	}

	// ── Folio actions ──
	toggleCreateFolioForm(): void {
		this.showCreateFolioForm.set(!this.showCreateFolioForm());
	}
	updateCreateFolioForm(
		partial: Partial<{ folio_type: string; folio_name: string; notes: string }>,
	): void {
		this.createFolioForm.set({ ...this.createFolioForm(), ...partial });
	}
	async createFolio(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.creatingFolio.set(true);
		try {
			const form = this.createFolioForm();
			await this.api.post(`/tenants/${tenantId}/billing/folios`, {
				property_id: propertyId,
				folio_type: form.folio_type,
				folio_name: form.folio_name || undefined,
				notes: form.notes || undefined,
			});
			this.toast.success("Folio created.");
			this.showCreateFolioForm.set(false);
			this.createFolioForm.set({ folio_type: "HOUSE_ACCOUNT", folio_name: "", notes: "" });
			await this.loadFolios();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create folio");
		} finally {
			this.creatingFolio.set(false);
		}
	}

	// ── Post Charge actions ──
	togglePostChargeForm(): void {
		this.showPostChargeForm.set(!this.showPostChargeForm());
	}
	updatePostChargeForm(
		partial: Partial<{
			folio_id: string;
			charge_code: string;
			amount: number;
			quantity: number;
			description: string;
			department_code: string;
		}>,
	): void {
		this.postChargeForm.set({ ...this.postChargeForm(), ...partial });
	}
	async postCharge(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		const form = this.postChargeForm();
		if (!form.folio_id || form.amount <= 0) return;
		this.postingCharge.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/charges`, {
				property_id: propertyId,
				folio_id: form.folio_id,
				charge_code: form.charge_code || "MISC",
				amount: form.amount,
				quantity: form.quantity || 1,
				description: form.description || undefined,
				department_code: form.department_code || undefined,
			});
			this.toast.success("Charge posted.");
			this.showPostChargeForm.set(false);
			this.postChargeForm.set({
				folio_id: "",
				charge_code: "MISC",
				amount: 0,
				quantity: 1,
				description: "",
				department_code: "",
			});
			await Promise.all([this.loadCharges(), this.loadFolios()]);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to post charge");
		} finally {
			this.postingCharge.set(false);
		}
	}

	// ── Payment capture actions ──
	toggleCapturePaymentForm(): void {
		this.showCapturePaymentForm.set(!this.showCapturePaymentForm());
	}
	updateCapturePaymentForm(
		partial: Partial<{
			folio_id: string;
			amount: number;
			payment_method: string;
			payment_reference: string;
		}>,
	): void {
		this.capturePaymentForm.set({ ...this.capturePaymentForm(), ...partial });
	}
	async capturePayment(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		const form = this.capturePaymentForm();
		if (form.amount <= 0 || !form.payment_reference) return;
		this.capturingPayment.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/payments/capture`, {
				property_id: propertyId,
				folio_id: form.folio_id || undefined,
				amount: form.amount,
				payment_method: form.payment_method || "CASH",
				payment_reference: form.payment_reference,
			});
			this.toast.success("Payment captured.");
			this.showCapturePaymentForm.set(false);
			this.capturePaymentForm.set({
				folio_id: "",
				amount: 0,
				payment_method: "CASH",
				payment_reference: "",
			});
			await Promise.all([this.loadPayments(), this.loadFolios()]);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to capture payment");
		} finally {
			this.capturingPayment.set(false);
		}
	}

	// ── Charge void actions ──
	showVoidCharge(postingId: string): void {
		this.voidingChargeId.set(postingId);
		this.voidChargeReason.set("");
	}
	cancelVoidCharge(): void {
		this.voidingChargeId.set(null);
	}
	async voidCharge(charge: ChargePostingListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.processingChargeVoid.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/charges/${charge.id}/void`, {
				posting_id: charge.id,
				void_reason: this.voidChargeReason() || undefined,
			});
			this.toast.success("Charge voided.");
			this.voidingChargeId.set(null);
			await Promise.all([this.loadCharges(), this.loadFolios()]);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to void charge");
		} finally {
			this.processingChargeVoid.set(false);
		}
	}
	readonly canVoidCharge = canVoidCharge;

	// ── Folio close actions ──
	showCloseFolio(folioId: string): void {
		this.closingFolioId.set(folioId);
		this.closeFolioReason.set("");
		this.closeFolioForce.set(false);
	}
	cancelCloseFolio(): void {
		this.closingFolioId.set(null);
	}
	async closeFolio(folio: FolioListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;
		this.processingFolioClose.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/folios/close`, {
				property_id: propertyId,
				folio_id: folio.id,
				close_reason: this.closeFolioReason() || undefined,
				force: this.closeFolioForce(),
			});
			this.toast.success("Folio closed.");
			this.closingFolioId.set(null);
			await this.loadFolios();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to close folio");
		} finally {
			this.processingFolioClose.set(false);
		}
	}
	readonly canCloseFolio = canCloseFolio;

	async selectFolio(folio: FolioListItem): Promise<void> {
		await this.data.selectFolio(folio);
	}

	// ── Data loading (delegated to BillingDataService) ──
	refreshAll(): void {
		this.data.loadForView(this.activeView());
	}
	loadPayments(): Promise<void> {
		return this.data.loadPayments();
	}
	loadInvoices(): Promise<void> {
		return this.data.loadInvoices();
	}
	loadFolios(): Promise<void> {
		return this.data.loadFolios();
	}
	loadCharges(): Promise<void> {
		return this.data.loadCharges();
	}
}
