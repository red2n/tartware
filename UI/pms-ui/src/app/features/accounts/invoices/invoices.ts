import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";

import type { InvoiceListItem, InvoiceListResponse } from "@tartware/schemas";

import { ApiService } from "../../../core/api/api.service";
import { AuthService } from "../../../core/auth/auth.service";
import { TenantContextService } from "../../../core/context/tenant-context.service";
import { TranslatePipe } from "../../../core/i18n/translate.pipe";
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
import { settleCommandReadModel } from "../../../shared/command-refresh";
import { ToastService } from "../../../shared/toast/toast.service";

const INVOICE_STATUS_ORDER = [
	"draft",
	"issued",
	"paid",
	"partially_paid",
	"overdue",
	"finalized",
	"superseded",
	"void",
	"cancelled",
] as const;

@Component({
	selector: "app-invoices",
	standalone: true,
	imports: [
		NgClass,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatProgressSpinnerModule,
		MatTooltipModule,
		PageHeaderComponent,
		PaginationComponent,
		TranslatePipe,
	],
	templateUrl: "./invoices.html",
	styleUrl: "./invoices.scss",
})
export class InvoicesComponent {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	readonly settings = inject(SettingsService);

	// ── List state ──
	readonly invoices = signal<InvoiceListItem[]>([]);
	readonly dataReady = signal(false);
	readonly error = signal<string | null>(null);
	readonly totalCount = signal(0);

	// ── Filters ──
	readonly statusFilter = signal("ALL");
	readonly searchQuery = signal("");

	// ── Pagination ──
	readonly page = signal(1);
	readonly pageSize = signal(25);

	// ── Sort ──
	readonly sort = createSortState();

	// ── Create form ──
	readonly showCreateForm = signal(false);
	readonly creating = signal(false);
	readonly createForm = signal({
		guest_id: "",
		reservation_id: "",
		total_amount: "",
		due_date: "",
		notes: "",
	});

	// ── Adjust dialog ──
	readonly adjustingInvoiceId = signal<string | null>(null);
	readonly adjustForm = signal({ adjustment_amount: "", reason: "" });
	readonly adjusting = signal(false);
	readonly voidingInvoiceId = signal<string | null>(null);
	readonly voidReason = signal("");
	readonly voiding = signal(false);
	readonly creditingInvoiceId = signal<string | null>(null);
	readonly creditForm = signal({ credit_amount: "", reason: "" });
	readonly crediting = signal(false);
	readonly reopeningInvoiceId = signal<string | null>(null);
	readonly reopenReason = signal("");
	readonly reopening = signal(false);

	// ── Actions ──
	readonly actionLoading = signal(false);

	// ── Computed ──
	readonly statusFilters = computed(() => {
		const counts = new Map<string, number>();
		for (const invoice of this.invoices()) {
			counts.set(invoice.status, (counts.get(invoice.status) ?? 0) + 1);
		}

		const ordered = INVOICE_STATUS_ORDER.filter((status) => counts.has(status)).map((status) => ({
			key: status,
			label: this.formatStatusLabel(status),
			count: counts.get(status) ?? 0,
		}));
		const extras = [...counts.keys()]
			.filter(
				(status) => !INVOICE_STATUS_ORDER.includes(status as (typeof INVOICE_STATUS_ORDER)[number]),
			)
			.sort()
			.map((status) => ({
				key: status,
				label: this.formatStatusLabel(status),
				count: counts.get(status) ?? 0,
			}));

		return [{ key: "ALL", label: "All", count: this.invoices().length }, ...ordered, ...extras];
	});

	readonly summary = computed(() => {
		const items = this.invoices();
		return {
			total: items.length,
			outstandingBalance: items.reduce((sum, invoice) => sum + Math.max(invoice.balance_due, 0), 0),
			draftCount: items.filter((invoice) => invoice.status === "draft").length,
			overdueCount: items.filter((invoice) => invoice.status === "overdue").length,
			creditCount: items.filter((invoice) => this.isCreditInvoice(invoice)).length,
		};
	});

	readonly filtered = computed(() => {
		let items = this.invoices();
		const q = this.searchQuery().toLowerCase();
		const status = this.statusFilter();

		if (status !== "ALL") {
			items = items.filter((i) => i.status === status);
		}
		if (q) {
			items = items.filter(
				(i) =>
					(i.invoice_number ?? "").toLowerCase().includes(q) ||
					(i.guest_name ?? "").toLowerCase().includes(q) ||
					(i.confirmation_number ?? "").toLowerCase().includes(q) ||
					i.status.toLowerCase().includes(q) ||
					i.status_display.toLowerCase().includes(q) ||
					i.invoice_type.toLowerCase().includes(q) ||
					i.invoice_type_display.toLowerCase().includes(q),
			);
		}
		return sortBy(items, this.sort().column, this.sort().direction);
	});

	readonly paginated = computed(() => {
		const all = this.filtered();
		const start = (this.page() - 1) * this.pageSize();
		return all.slice(start, start + this.pageSize());
	});

	constructor() {
		effect(() => {
			this.auth.tenantId();
			this.ctx.propertyId();
			this.loadInvoices();
		});
	}

	// ── Data loading ──
	async loadInvoices(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		this.dataReady.set(false);
		this.error.set(null);
		try {
			const res = await this.api.get<InvoiceListResponse>("/billing/invoices", {
				tenant_id: tenantId,
				property_id: propertyId,
				limit: "200",
			});
			this.invoices.set(res.data ?? []);
			this.totalCount.set(res.meta?.count ?? res.data?.length ?? 0);
		} catch (e) {
			this.invoices.set([]);
			this.totalCount.set(0);
			this.error.set(e instanceof Error ? e.message : "Failed to load invoices.");
		} finally {
			this.dataReady.set(true);
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

	// ── Pagination ──
	onPageChange(p: number): void {
		this.page.set(p);
	}

	// ── Formatting ──
	formatCurrency(amount: number, currency: string): string {
		return this.settings.formatCurrency(amount, currency);
	}
	formatDate(d: string): string {
		return this.settings.formatDate(d);
	}

	statusBadge(status: string): string {
		switch (status) {
			case "draft":
				return "badge-muted";
			case "issued":
			case "finalized":
				return "badge-accent";
			case "partially_paid":
			case "overdue":
				return "badge-warning";
			case "paid":
				return "badge-success";
			case "superseded":
				return "badge-muted";
			case "void":
			case "cancelled":
				return "badge-danger";
			default:
				return "badge-muted";
		}
	}

	statusLabel(invoice: InvoiceListItem): string {
		return invoice.status_display || this.formatStatusLabel(invoice.status);
	}

	formatStatusLabel(status: string): string {
		return status
			.split("_")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" ");
	}

	displayInvoiceNumber(invoice: InvoiceListItem): string {
		if (invoice.invoice_number) return invoice.invoice_number;
		if (this.isCreditInvoice(invoice)) return "Credit Note Pending";
		if (invoice.status === "draft") return "Draft Pending";
		return "Number Pending";
	}

	isCreditInvoice(invoice: InvoiceListItem): boolean {
		return invoice.total_amount < 0 || invoice.invoice_type.toLowerCase().includes("credit");
	}

	canVoidInvoiceAction(invoice: InvoiceListItem): boolean {
		return invoice.status === "draft";
	}

	canCreditInvoiceAction(invoice: InvoiceListItem): boolean {
		return ["issued", "paid", "overdue", "finalized"].includes(invoice.status);
	}

	canReopenInvoiceAction(invoice: InvoiceListItem): boolean {
		return invoice.status !== "draft";
	}

	actionLabel(invoice: InvoiceListItem): string {
		if (this.canVoidInvoiceAction(invoice)) return "Draft";
		if (this.canCreditInvoiceAction(invoice) || this.canReopenInvoiceAction(invoice)) {
			return "Managed";
		}
		return "Locked";
	}

	setStatusFilter(f: string): void {
		this.statusFilter.set(f);
		this.page.set(1);
	}

	resultsLabel(): string {
		return `${this.filtered().length} of ${this.totalCount()} invoices`;
	}

	// ── Create Invoice ──
	openCreateForm(): void {
		this.showCreateForm.set(true);
		this.createForm.set({
			guest_id: "",
			reservation_id: "",
			total_amount: "",
			due_date: "",
			notes: "",
		});
	}

	cancelCreate(): void {
		this.showCreateForm.set(false);
	}

	async submitCreate(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		if (!tenantId || !propertyId) return;

		const f = this.createForm();
		if (!f.guest_id || !f.total_amount) {
			this.toast.error("Guest ID and total amount are required.");
			return;
		}

		this.creating.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices`, {
				property_id: propertyId,
				guest_id: f.guest_id,
				reservation_id: f.reservation_id || undefined,
				total_amount: Number.parseFloat(f.total_amount),
				due_date: f.due_date || undefined,
				notes: f.notes || undefined,
			});
			this.toast.success("Invoice create submitted. Refreshing invoices...");
			this.showCreateForm.set(false);
			await settleCommandReadModel(() => this.loadInvoices());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create invoice.");
		} finally {
			this.creating.set(false);
		}
	}

	// ── Adjust Invoice ──
	openAdjust(inv: InvoiceListItem): void {
		this.adjustingInvoiceId.set(inv.id);
		this.adjustForm.set({ adjustment_amount: "", reason: "" });
	}

	cancelAdjust(): void {
		this.adjustingInvoiceId.set(null);
	}

	async submitAdjust(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const invoiceId = this.adjustingInvoiceId();
		if (!tenantId || !invoiceId) return;

		const f = this.adjustForm();
		if (!f.adjustment_amount) {
			this.toast.error("Adjustment amount is required.");
			return;
		}

		this.adjusting.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${invoiceId}/adjust`, {
				invoice_id: invoiceId,
				adjustment_amount: Number.parseFloat(f.adjustment_amount),
				reason: f.reason || undefined,
			});
			this.toast.success("Invoice adjust submitted. Refreshing invoices...");
			this.adjustingInvoiceId.set(null);
			await settleCommandReadModel(() => this.loadInvoices());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to adjust invoice.");
		} finally {
			this.adjusting.set(false);
		}
	}

	// ── Finalize Invoice ──
	async finalizeInvoice(inv: InvoiceListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;

		this.actionLoading.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${inv.id}/finalize`, {
				invoice_id: inv.id,
			});
			this.toast.success("Invoice finalize submitted. Refreshing invoices...");
			await settleCommandReadModel(() => this.loadInvoices());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to finalize invoice.");
		} finally {
			this.actionLoading.set(false);
		}
	}

	openVoid(inv: InvoiceListItem): void {
		this.voidingInvoiceId.set(inv.id);
		this.voidReason.set("");
	}

	cancelVoid(): void {
		this.voidingInvoiceId.set(null);
	}

	async submitVoid(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const invoiceId = this.voidingInvoiceId();
		if (!tenantId || !invoiceId) return;

		this.voiding.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${invoiceId}/void`, {
				reason: this.voidReason() || undefined,
			});
			this.toast.success("Invoice void submitted. Refreshing invoices...");
			this.voidingInvoiceId.set(null);
			await settleCommandReadModel(() => this.loadInvoices());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to void invoice.");
		} finally {
			this.voiding.set(false);
		}
	}

	openCredit(inv: InvoiceListItem): void {
		this.creditingInvoiceId.set(inv.id);
		this.creditForm.set({
			credit_amount: String(inv.balance_due > 0 ? inv.balance_due : inv.total_amount),
			reason: "",
		});
	}

	cancelCredit(): void {
		this.creditingInvoiceId.set(null);
	}

	async submitCredit(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const propertyId = this.ctx.propertyId();
		const invoiceId = this.creditingInvoiceId();
		if (!tenantId || !propertyId || !invoiceId) return;

		const form = this.creditForm();
		if (!form.credit_amount || !form.reason.trim()) {
			this.toast.error("Credit amount and reason are required.");
			return;
		}

		this.crediting.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${invoiceId}/credit-note`, {
				property_id: propertyId,
				credit_amount: Number.parseFloat(form.credit_amount),
				reason: form.reason.trim(),
			});
			this.toast.success("Credit note submitted. Refreshing invoices...");
			this.creditingInvoiceId.set(null);
			await settleCommandReadModel(() => this.loadInvoices());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create credit note.");
		} finally {
			this.crediting.set(false);
		}
	}

	openReopen(inv: InvoiceListItem): void {
		this.reopeningInvoiceId.set(inv.id);
		this.reopenReason.set("");
	}

	cancelReopen(): void {
		this.reopeningInvoiceId.set(null);
	}

	async submitReopen(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const invoiceId = this.reopeningInvoiceId();
		if (!tenantId || !invoiceId) return;

		if (!this.reopenReason().trim()) {
			this.toast.error("Reason is required to reopen an invoice.");
			return;
		}

		this.reopening.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${invoiceId}/reopen`, {
				reason: this.reopenReason().trim(),
			});
			this.toast.success("Invoice reopen submitted. Refreshing invoices...");
			this.reopeningInvoiceId.set(null);
			await settleCommandReadModel(() => this.loadInvoices());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to reopen invoice.");
		} finally {
			this.reopening.set(false);
		}
	}
}
