import { Injectable, inject, signal } from "@angular/core";

import type { BillingPaymentListItem } from "@tartware/schemas";

import { ApiService } from "../../core/api/api.service";
import { AuthService } from "../../core/auth/auth.service";
import { TenantContextService } from "../../core/context/tenant-context.service";
import { settleCommandReadModel } from "../../shared/command-refresh";
import { ToastService } from "../../shared/toast/toast.service";

import { BillingDataService } from "./billing-data.service";

@Injectable()
export class BillingPaymentsService {
	private readonly api = inject(ApiService);
	private readonly auth = inject(AuthService);
	private readonly ctx = inject(TenantContextService);
	private readonly toast = inject(ToastService);
	private readonly data = inject(BillingDataService);

	readonly voidingPaymentId = signal<string | null>(null);
	readonly voidPaymentReason = signal("");
	readonly processingVoid = signal(false);
	readonly refundingPaymentId = signal<string | null>(null);
	readonly refundForm = signal({ amount: 0, reason: "" });
	readonly processingRefund = signal(false);
	readonly showCapturePaymentForm = signal(false);
	readonly capturePaymentForm = signal({
		folio_id: "",
		amount: 0,
		payment_method: "CASH",
		payment_reference: "",
	});
	readonly capturingPayment = signal(false);

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
			this.toast.success("Payment void submitted. Refreshing billing data...");
			this.voidingPaymentId.set(null);
			await settleCommandReadModel(() => this.data.loadPayments());
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
			this.toast.success("Refund submitted. Refreshing billing data...");
			this.refundingPaymentId.set(null);
			await settleCommandReadModel(() => this.data.loadPayments());
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to refund payment");
		} finally {
			this.processingRefund.set(false);
		}
	}

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
			this.toast.success("Payment capture submitted. Refreshing billing data...");
			this.showCapturePaymentForm.set(false);
			this.capturePaymentForm.set({
				folio_id: "",
				amount: 0,
				payment_method: "CASH",
				payment_reference: "",
			});
			await settleCommandReadModel(() =>
				Promise.all([this.data.loadPayments(), this.data.loadFolios()]),
			);
		} catch (e) {
			this.toast.error(e instanceof Error ? e.message : "Failed to capture payment");
		} finally {
			this.capturingPayment.set(false);
		}
	}
}
