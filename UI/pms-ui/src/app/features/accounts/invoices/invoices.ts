import { NgClass } from "@angular/common";
import { Component, computed, effect, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

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
import { ToastService } from "../../../shared/toast/toast.service";

type StatusFilter = "ALL" | "DRAFT" | "SENT" | "FINALIZED" | "PAID" | "VOIDED";

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
	readonly loading = signal(false);
	readonly totalCount = signal(0);

	// ── Filters ──
	readonly statusFilter = signal<StatusFilter>("ALL");
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

	// ── Actions ──
	readonly actionLoading = signal(false);

	// ── Computed ──
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
					(i.confirmation_number ?? "").toLowerCase().includes(q),
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

		this.loading.set(true);
		try {
			const res = await this.api.get<InvoiceListResponse>("/billing/invoices", {
				tenant_id: tenantId,
				property_id: propertyId,
				limit: "200",
			});
			this.invoices.set(res.data ?? []);
			this.totalCount.set(res.meta?.count ?? res.data?.length ?? 0);
		} catch {
			this.invoices.set([]);
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

	// ── Pagination ──
	onPageChange(p: number): void {
		this.page.set(p);
	}

	// ── Filters ──
	setStatusFilter(f: StatusFilter): void {
		this.statusFilter.set(f);
		this.page.set(1);
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
			case "DRAFT":
				return "badge badge-info";
			case "SENT":
				return "badge badge-warning";
			case "FINALIZED":
				return "badge badge-primary";
			case "PAID":
				return "badge badge-success";
			case "VOIDED":
				return "badge badge-danger";
			default:
				return "badge";
		}
	}

	// ── Create Invoice ──
	openCreateForm(): void {
		this.showCreateForm.set(true);
		this.createForm.set({ guest_id: "", reservation_id: "", total_amount: "", due_date: "", notes: "" });
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
			this.toast.success("Invoice created successfully.");
			this.showCreateForm.set(false);
			await this.loadInvoices();
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
			this.toast.success("Invoice adjusted successfully.");
			this.adjustingInvoiceId.set(null);
			await this.loadInvoices();
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
			this.toast.success("Invoice finalized.");
			await this.loadInvoices();
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to finalize invoice.");
		} finally {
			this.actionLoading.set(false);
		}
	}
}
