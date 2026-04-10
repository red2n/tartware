import { computed, Injectable, inject, signal } from "@angular/core";

import type { InvoiceListItem } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { settleCommandReadModel } from "../../shared/command-refresh";
import { ToastService } from "../../shared/toast/toast.service";

import { BillingDataService } from "./billing-data.service";

@Injectable()
export class BillingInvoicesService {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	private readonly data = inject(BillingDataService);

	readonly processingInvoiceAction = signal<string | null>(null);
	readonly creditNoteInvoiceId = signal<string | null>(null);
	readonly creditNoteForm = signal({ credit_amount: 0, reason: "" });
	readonly processingCreditNote = signal(false);
	readonly voidInvoiceId = signal<string | null>(null);
	readonly voidInvoiceReason = signal("");
	readonly processingInvoiceVoid = signal(false);
	readonly reopenInvoiceId = signal<string | null>(null);
	readonly reopenInvoiceReason = signal("");
	readonly processingInvoiceReopen = signal(false);
	readonly showCreateInvoiceForm = signal(false);
	readonly createInvoiceForm = signal({
		reservation_id: "",
		guest_id: "",
		total_amount: 0,
		due_date: "",
		notes: "",
	});
	readonly creatingInvoice = signal(false);
	readonly availableGuests = this.data.availableGuests;
	readonly availableReservations = computed(() =>
		this.data.reservationsForGuest(this.createInvoiceForm().guest_id),
	);

	async finalizeInvoice(invoice: InvoiceListItem): Promise<void> {
		const tenantId = this.auth.tenantId();
		if (!tenantId) return;
		this.processingInvoiceAction.set(invoice.id);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${invoice.id}/finalize`, {});
			this.toast.success("Invoice finalize submitted. Refreshing invoices...");
			await settleCommandReadModel(() => this.data.loadInvoices());
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
			this.toast.success("Invoice void submitted. Refreshing invoices...");
			this.voidInvoiceId.set(null);
			await settleCommandReadModel(() => this.data.loadInvoices());
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
			this.toast.success("Credit note submitted. Refreshing invoices...");
			this.creditNoteInvoiceId.set(null);
			await settleCommandReadModel(() => this.data.loadInvoices());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create credit note");
		} finally {
			this.processingCreditNote.set(false);
		}
	}

	showReopenInvoice(invoiceId: string): void {
		this.reopenInvoiceId.set(invoiceId);
		this.reopenInvoiceReason.set("");
	}

	cancelReopenInvoice(): void {
		this.reopenInvoiceId.set(null);
	}

	async reopenInvoice(): Promise<void> {
		const tenantId = this.auth.tenantId();
		const invoiceId = this.reopenInvoiceId();
		if (!tenantId || !invoiceId || !this.reopenInvoiceReason().trim()) return;
		this.processingInvoiceReopen.set(true);
		try {
			await this.api.post(`/tenants/${tenantId}/billing/invoices/${invoiceId}/reopen`, {
				reason: this.reopenInvoiceReason().trim(),
			});
			this.toast.success("Invoice reopen submitted. Refreshing invoices...");
			this.reopenInvoiceId.set(null);
			await settleCommandReadModel(() => this.data.loadInvoices());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to reopen invoice");
		} finally {
			this.processingInvoiceReopen.set(false);
		}
	}

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
			this.toast.success("Invoice create submitted. Refreshing invoices...");
			this.showCreateInvoiceForm.set(false);
			this.createInvoiceForm.set({
				reservation_id: "",
				guest_id: "",
				total_amount: 0,
				due_date: "",
				notes: "",
			});
			await settleCommandReadModel(() => this.data.loadInvoices());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to create invoice");
		} finally {
			this.creatingInvoice.set(false);
		}
	}
}
