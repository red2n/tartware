import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

import type { FolioListItem } from "@tartware/schemas";

import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { TranslatePipe } from "../../core/i18n/translate.pipe";
import { GlobalSearchService } from "../../core/search/global-search.service";
import { SettingsService } from "../../core/settings/settings.service";
import { PageHeaderComponent } from "../../shared/components/page-header/page-header";
import { PaginationComponent } from "../../shared/pagination/pagination";
import { createSortState, sortBy, toggleSort } from "../../shared/sort-utils";

import {
	type BillingView,
	CHARGE_CODE_OPTIONS,
	CHARGE_TYPE_FILTERS,
	type ChargeTypeFilter,
	DEFAULT_PAGE_SIZE,
	FOLIO_STATUS_FILTERS,
	FOLIO_TYPE_OPTIONS,
	type FolioStatusFilter,
	INVOICE_STATUS_FILTERS,
	type InvoiceStatusFilter,
	PAYMENT_METHOD_OPTIONS,
	PAYMENT_STATUS_FILTERS,
	type PaymentStatusFilter,
} from "./billing-constants";
import { BillingDataService } from "./billing-data.service";
import { BillingFoliosService } from "./billing-folios.service";
import { BillingInvoicesService } from "./billing-invoices.service";
import { BillingPaymentsService } from "./billing-payments.service";
import { BillingRoutingService } from "./billing-routing.service";
import {
	canCloseFolio,
	canCreditNote,
	canFinalizeInvoice,
	canRefundPayment,
	canReopenFolio,
	canReopenInvoice,
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
	providers: [
		BillingDataService,
		BillingPaymentsService,
		BillingInvoicesService,
		BillingFoliosService,
		BillingRoutingService,
	],
})
export class BillingComponent {
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	readonly data = inject(BillingDataService);
	readonly globalSearch = inject(GlobalSearchService);
	readonly settings = inject(SettingsService);
	private readonly paymentActions = inject(BillingPaymentsService);
	private readonly invoiceActions = inject(BillingInvoicesService);
	private readonly folioActions = inject(BillingFoliosService);
	private readonly routingActions = inject(BillingRoutingService);

	readonly chargeCodeOptions = CHARGE_CODE_OPTIONS;
	readonly paymentMethodOptions = PAYMENT_METHOD_OPTIONS;
	readonly folioTypeOptions = FOLIO_TYPE_OPTIONS;
	readonly billedToTypeOptions = this.folioActions.billedToTypeOptions;
	readonly taxExemptionTypeOptions = this.folioActions.taxExemptionTypeOptions;
	readonly compTypeOptions = this.folioActions.compTypeOptions;
	readonly routingTypeOptions = this.routingActions.routingTypeOptions;
	readonly routingChargeCategoryOptions = this.routingActions.routingChargeCategoryOptions;
	readonly routingDestinationTypeOptions = this.routingActions.routingDestinationTypeOptions;
	readonly pageSize = DEFAULT_PAGE_SIZE;
	readonly activeView = signal<BillingView>("payments");

	readonly payments = this.data.payments;
	readonly paymentsReady = this.data.paymentsReady;
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

	readonly invoices = this.data.invoices;
	readonly invoicesReady = this.data.invoicesReady;
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

	readonly folios = this.data.folios;
	readonly foliosReady = this.data.foliosReady;
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

	readonly charges = this.data.charges;
	readonly chargesReady = this.data.chargesReady;
	readonly chargesError = this.data.chargesError;
	readonly activeChargeFilter = signal<ChargeTypeFilter>("ALL");
	readonly chargePage = signal(1);
	readonly chargeSort = createSortState();
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

	readonly routingRules = this.routingActions.routingRules;
	readonly routingTemplates = this.routingActions.routingTemplates;
	readonly routingLoading = this.routingActions.routingLoading;
	readonly routingError = this.routingActions.routingError;
	readonly routingPage = signal(1);
	readonly routingSort = createSortState();
	readonly filteredRoutingRules = computed(() => {
		let list = [...this.routingRules(), ...this.routingTemplates()];
		const query = this.globalSearch.query().toLowerCase().trim();
		if (query) {
			list = list.filter(
				(rule) =>
					rule.rule_name.toLowerCase().includes(query) ||
					(rule.rule_code?.toLowerCase().includes(query) ?? false) ||
					(rule.charge_code_pattern?.toLowerCase().includes(query) ?? false),
			);
		}
		return list;
	});
	readonly paginatedRoutingRules = computed(() => {
		const sorted = sortBy(
			this.filteredRoutingRules(),
			this.routingSort().column,
			this.routingSort().direction,
		);
		const start = (this.routingPage() - 1) * this.pageSize;
		return sorted.slice(start, start + this.pageSize);
	});
	readonly selectedFolioId = this.folioActions.selectedFolioId;
	readonly selectedFolioRoutingRules = computed(() => {
		const selectedFolioId = this.selectedFolioId();
		if (!selectedFolioId) return [];
		return this.routingRules().filter((rule) => rule.source_folio_id === selectedFolioId);
	});
	readonly summary = this.data.summary;

	readonly voidingPaymentId = this.paymentActions.voidingPaymentId;
	readonly voidPaymentReason = this.paymentActions.voidPaymentReason;
	readonly processingVoid = this.paymentActions.processingVoid;
	readonly refundingPaymentId = this.paymentActions.refundingPaymentId;
	readonly refundForm = this.paymentActions.refundForm;
	readonly processingRefund = this.paymentActions.processingRefund;
	readonly showCapturePaymentForm = this.paymentActions.showCapturePaymentForm;
	readonly capturePaymentForm = this.paymentActions.capturePaymentForm;
	readonly capturingPayment = this.paymentActions.capturingPayment;
	readonly showVoidPayment = this.paymentActions.showVoidPayment.bind(this.paymentActions);
	readonly cancelVoidPayment = this.paymentActions.cancelVoidPayment.bind(this.paymentActions);
	readonly voidPayment = this.paymentActions.voidPayment.bind(this.paymentActions);
	readonly showRefundPayment = this.paymentActions.showRefundPayment.bind(this.paymentActions);
	readonly cancelRefundPayment = this.paymentActions.cancelRefundPayment.bind(this.paymentActions);
	readonly refundPayment = this.paymentActions.refundPayment.bind(this.paymentActions);
	readonly toggleCapturePaymentForm = this.paymentActions.toggleCapturePaymentForm.bind(
		this.paymentActions,
	);
	readonly updateCapturePaymentForm = this.paymentActions.updateCapturePaymentForm.bind(
		this.paymentActions,
	);
	readonly capturePayment = this.paymentActions.capturePayment.bind(this.paymentActions);

	readonly processingInvoiceAction = this.invoiceActions.processingInvoiceAction;
	readonly creditNoteInvoiceId = this.invoiceActions.creditNoteInvoiceId;
	readonly creditNoteForm = this.invoiceActions.creditNoteForm;
	readonly processingCreditNote = this.invoiceActions.processingCreditNote;
	readonly voidInvoiceId = this.invoiceActions.voidInvoiceId;
	readonly voidInvoiceReason = this.invoiceActions.voidInvoiceReason;
	readonly processingInvoiceVoid = this.invoiceActions.processingInvoiceVoid;
	readonly reopenInvoiceId = this.invoiceActions.reopenInvoiceId;
	readonly reopenInvoiceReason = this.invoiceActions.reopenInvoiceReason;
	readonly processingInvoiceReopen = this.invoiceActions.processingInvoiceReopen;
	readonly showCreateInvoiceForm = this.invoiceActions.showCreateInvoiceForm;
	readonly createInvoiceForm = this.invoiceActions.createInvoiceForm;
	readonly creatingInvoice = this.invoiceActions.creatingInvoice;
	readonly availableGuests = this.invoiceActions.availableGuests;
	readonly availableReservations = this.invoiceActions.availableReservations;
	readonly finalizeInvoice = this.invoiceActions.finalizeInvoice.bind(this.invoiceActions);
	readonly showVoidInvoice = this.invoiceActions.showVoidInvoice.bind(this.invoiceActions);
	readonly cancelVoidInvoice = this.invoiceActions.cancelVoidInvoice.bind(this.invoiceActions);
	readonly voidInvoice = this.invoiceActions.voidInvoice.bind(this.invoiceActions);
	readonly showCreditNote = this.invoiceActions.showCreditNote.bind(this.invoiceActions);
	readonly cancelCreditNote = this.invoiceActions.cancelCreditNote.bind(this.invoiceActions);
	readonly createCreditNote = this.invoiceActions.createCreditNote.bind(this.invoiceActions);
	readonly showReopenInvoice = this.invoiceActions.showReopenInvoice.bind(this.invoiceActions);
	readonly cancelReopenInvoice = this.invoiceActions.cancelReopenInvoice.bind(this.invoiceActions);
	readonly reopenInvoice = this.invoiceActions.reopenInvoice.bind(this.invoiceActions);
	readonly toggleCreateInvoiceForm = this.invoiceActions.toggleCreateInvoiceForm.bind(
		this.invoiceActions,
	);
	readonly updateCreateInvoiceForm = this.invoiceActions.updateCreateInvoiceForm.bind(
		this.invoiceActions,
	);
	readonly createInvoice = this.invoiceActions.createInvoice.bind(this.invoiceActions);

	readonly showCreateFolioForm = this.folioActions.showCreateFolioForm;
	readonly createFolioForm = this.folioActions.createFolioForm;
	readonly creatingFolio = this.folioActions.creatingFolio;
	readonly folioCharges = this.folioActions.folioCharges;
	readonly folioChargesLoading = this.folioActions.folioChargesLoading;
	readonly showPostChargeForm = this.folioActions.showPostChargeForm;
	readonly postChargeForm = this.folioActions.postChargeForm;
	readonly postingCharge = this.folioActions.postingCharge;
	readonly openFolios = this.folioActions.openFolios;
	readonly voidingChargeId = this.folioActions.voidingChargeId;
	readonly voidChargeReason = this.folioActions.voidChargeReason;
	readonly processingChargeVoid = this.folioActions.processingChargeVoid;
	readonly closingFolioId = this.folioActions.closingFolioId;
	readonly closeFolioReason = this.folioActions.closeFolioReason;
	readonly closeFolioForce = this.folioActions.closeFolioForce;
	readonly processingFolioClose = this.folioActions.processingFolioClose;
	readonly reopeningFolioId = this.folioActions.reopeningFolioId;
	readonly reopenFolioReason = this.folioActions.reopenFolioReason;
	readonly processingFolioReopen = this.folioActions.processingFolioReopen;
	readonly mergingFolioId = this.folioActions.mergingFolioId;
	readonly mergeFolioForm = this.folioActions.mergeFolioForm;
	readonly processingFolioMerge = this.folioActions.processingFolioMerge;
	readonly creatingWindowFolioId = this.folioActions.creatingWindowFolioId;
	readonly folioWindowForm = this.folioActions.folioWindowForm;
	readonly processingFolioWindow = this.folioActions.processingFolioWindow;
	readonly taxExemptionFolioId = this.folioActions.taxExemptionFolioId;
	readonly taxExemptionForm = this.folioActions.taxExemptionForm;
	readonly processingTaxExemption = this.folioActions.processingTaxExemption;
	readonly compPostingFolioId = this.folioActions.compPostingFolioId;
	readonly compPostingForm = this.folioActions.compPostingForm;
	readonly processingCompPosting = this.folioActions.processingCompPosting;
	readonly splittingChargeId = this.folioActions.splittingChargeId;
	readonly splitChargeForm = this.folioActions.splitChargeForm;
	readonly processingChargeSplit = this.folioActions.processingChargeSplit;
	readonly toggleCreateFolioForm = this.folioActions.toggleCreateFolioForm.bind(this.folioActions);
	readonly updateCreateFolioForm = this.folioActions.updateCreateFolioForm.bind(this.folioActions);
	readonly createFolio = this.folioActions.createFolio.bind(this.folioActions);
	readonly togglePostChargeForm = this.folioActions.togglePostChargeForm.bind(this.folioActions);
	readonly updatePostChargeForm = this.folioActions.updatePostChargeForm.bind(this.folioActions);
	readonly postCharge = this.folioActions.postCharge.bind(this.folioActions);
	readonly showVoidCharge = this.folioActions.showVoidCharge.bind(this.folioActions);
	readonly cancelVoidCharge = this.folioActions.cancelVoidCharge.bind(this.folioActions);
	readonly voidCharge = this.folioActions.voidCharge.bind(this.folioActions);
	readonly showCloseFolio = this.folioActions.showCloseFolio.bind(this.folioActions);
	readonly cancelCloseFolio = this.folioActions.cancelCloseFolio.bind(this.folioActions);
	readonly closeFolio = this.folioActions.closeFolio.bind(this.folioActions);
	readonly showReopenFolio = this.folioActions.showReopenFolio.bind(this.folioActions);
	readonly cancelReopenFolio = this.folioActions.cancelReopenFolio.bind(this.folioActions);
	readonly reopenFolio = this.folioActions.reopenFolio.bind(this.folioActions);
	readonly showMergeFolio = this.folioActions.showMergeFolio.bind(this.folioActions);
	readonly cancelMergeFolio = this.folioActions.cancelMergeFolio.bind(this.folioActions);
	readonly mergeFolio = this.folioActions.mergeFolio.bind(this.folioActions);
	readonly showCreateWindow = this.folioActions.showCreateWindow.bind(this.folioActions);
	readonly cancelCreateWindow = this.folioActions.cancelCreateWindow.bind(this.folioActions);
	readonly createFolioWindow = this.folioActions.createFolioWindow.bind(this.folioActions);
	readonly showTaxExemption = this.folioActions.showTaxExemption.bind(this.folioActions);
	readonly cancelTaxExemption = this.folioActions.cancelTaxExemption.bind(this.folioActions);
	readonly applyTaxExemption = this.folioActions.applyTaxExemption.bind(this.folioActions);
	readonly showCompPosting = this.folioActions.showCompPosting.bind(this.folioActions);
	readonly cancelCompPosting = this.folioActions.cancelCompPosting.bind(this.folioActions);
	readonly postCompCharge = this.folioActions.postCompCharge.bind(this.folioActions);
	readonly showSplitCharge = this.folioActions.showSplitCharge.bind(this.folioActions);
	readonly cancelSplitCharge = this.folioActions.cancelSplitCharge.bind(this.folioActions);
	readonly splitCharge = this.folioActions.splitCharge.bind(this.folioActions);
	readonly selectFolio = this.folioActions.selectFolio.bind(this.folioActions);

	readonly showCreateRoutingRuleForm = this.routingActions.showCreateRoutingRuleForm;
	readonly creatingRoutingRule = this.routingActions.creatingRoutingRule;
	readonly editingRoutingRuleId = this.routingActions.editingRoutingRuleId;
	readonly editingRoutingRule = this.routingActions.editingRoutingRule;
	readonly deletingRoutingRuleId = this.routingActions.deletingRoutingRuleId;
	readonly deletingRoutingRule = this.routingActions.deletingRoutingRule;
	readonly cloningTemplateId = this.routingActions.cloningTemplateId;
	readonly cloningTemplate = this.routingActions.cloningTemplate;
	readonly createRoutingRuleForm = this.routingActions.createRoutingRuleForm;
	readonly editRoutingRuleForm = this.routingActions.editRoutingRuleForm;
	readonly cloneTemplateForm = this.routingActions.cloneTemplateForm;
	readonly loadRoutingRules = this.routingActions.loadRoutingRules.bind(this.routingActions);
	readonly toggleCreateRoutingRuleForm = this.routingActions.toggleCreateRoutingRuleForm.bind(
		this.routingActions,
	);
	readonly updateCreateRoutingRuleForm = this.routingActions.updateCreateRoutingRuleForm.bind(
		this.routingActions,
	);
	readonly createRoutingRule = this.routingActions.createRoutingRule.bind(this.routingActions);
	readonly startEditRoutingRule = this.routingActions.startEditRoutingRule.bind(
		this.routingActions,
	);
	readonly cancelEditRoutingRule = this.routingActions.cancelEditRoutingRule.bind(
		this.routingActions,
	);
	readonly updateEditRoutingRuleForm = this.routingActions.updateEditRoutingRuleForm.bind(
		this.routingActions,
	);
	readonly saveRoutingRule = this.routingActions.saveRoutingRule.bind(this.routingActions);
	readonly showDeleteRoutingRule = this.routingActions.showDeleteRoutingRule.bind(
		this.routingActions,
	);
	readonly cancelDeleteRoutingRule = this.routingActions.cancelDeleteRoutingRule.bind(
		this.routingActions,
	);
	readonly deleteRoutingRule = this.routingActions.deleteRoutingRule.bind(this.routingActions);
	readonly showCloneTemplate = this.routingActions.showCloneTemplate.bind(this.routingActions);
	readonly cancelCloneTemplate = this.routingActions.cancelCloneTemplate.bind(this.routingActions);
	readonly cloneTemplate = this.routingActions.cloneTemplate.bind(this.routingActions);

	readonly paymentStatusClass = paymentStatusClass;
	readonly invoiceStatusClass = invoiceStatusClass;
	readonly folioStatusClass = folioStatusClass;
	readonly chargeTypeClass = chargeTypeClass;
	readonly canVoid = canVoidPayment;
	readonly canRefund = canRefundPayment;
	readonly canVoidInvoice = canVoidInvoice;
	readonly canFinalizeInvoice = canFinalizeInvoice;
	readonly canCreditNote = canCreditNote;
	readonly canReopenInvoice = canReopenInvoice;
	readonly canVoidCharge = canVoidCharge;
	readonly canCloseFolio = canCloseFolio;
	readonly canReopenFolio = canReopenFolio;

	constructor() {
		effect(() => {
			this.globalSearch.query();
			this.paymentPage.set(1);
			this.invoicePage.set(1);
			this.folioPage.set(1);
			this.chargePage.set(1);
			this.routingPage.set(1);
		});

		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			const activeView = this.activeView();
			this.data.loadForView(activeView === "routing" ? "payments" : activeView);
			this.loadRoutingRules();
		});
	}

	setView(view: BillingView): void {
		this.activeView.set(view);
		if (view === "routing") {
			this.loadRoutingRules();
			return;
		}
		this.data.ensureLoaded(view);
	}

	setPaymentFilter(f: PaymentStatusFilter): void {
		this.activePaymentFilter.set(f);
		this.paymentPage.set(1);
	}

	onPaymentSort(col: string): void {
		this.paymentSort.set(toggleSort(this.paymentSort(), col));
		this.paymentPage.set(1);
	}

	setInvoiceFilter(f: InvoiceStatusFilter): void {
		this.activeInvoiceFilter.set(f);
		this.invoicePage.set(1);
	}

	onInvoiceSort(col: string): void {
		this.invoiceSort.set(toggleSort(this.invoiceSort(), col));
		this.invoicePage.set(1);
	}

	setFolioFilter(f: FolioStatusFilter): void {
		this.activeFolioFilter.set(f);
		this.folioPage.set(1);
	}

	onFolioSort(col: string): void {
		this.folioSort.set(toggleSort(this.folioSort(), col));
		this.folioPage.set(1);
	}

	setChargeFilter(f: ChargeTypeFilter): void {
		this.activeChargeFilter.set(f);
		this.chargePage.set(1);
	}

	onChargeSort(col: string): void {
		this.chargeSort.set(toggleSort(this.chargeSort(), col));
		this.chargePage.set(1);
	}

	onRoutingSort(col: string): void {
		this.routingSort.set(toggleSort(this.routingSort(), col));
		this.routingPage.set(1);
	}

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

	targetFoliosFor(sourceFolioId: string): FolioListItem[] {
		return this.openFolios().filter((folio) => folio.id !== sourceFolioId);
	}

	openRoutingCreateForFolio(folio: FolioListItem): void {
		this.setView("routing");
		this.routingActions.openCreateForFolio(folio);
	}

	formatDate(dateStr: string): string {
		return this.settings.formatDate(dateStr);
	}

	formatCurrency(amount: number, currency?: string): string {
		return this.settings.formatCurrency(amount, currency);
	}

	refreshAll(): void {
		this.data.loadForView(this.activeView() === "routing" ? "payments" : this.activeView());
		this.loadRoutingRules();
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

	loadRouting(): Promise<void> {
		return this.loadRoutingRules();
	}
}
