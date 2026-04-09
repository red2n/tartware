import type {
	BillingPaymentListItem,
	ChargePostingListItem,
	FolioListItem,
	InvoiceListItem,
} from "@tartware/schemas";

/** Badge CSS class for a payment status value. */
export function paymentStatusClass(status: string): string {
	switch (status) {
		case "completed":
			return "badge-success";
		case "pending":
		case "processing":
			return "badge-warning";
		case "failed":
		case "cancelled":
			return "badge-danger";
		case "refunded":
		case "partially_refunded":
			return "badge-accent";
		case "authorized":
			return "badge-muted";
		default:
			return "";
	}
}

/** Badge CSS class for an invoice status value. */
export function invoiceStatusClass(status: string): string {
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

/** Badge CSS class for a folio status value. */
export function folioStatusClass(status: string): string {
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

/** Badge CSS class for a charge transaction type. */
export function chargeTypeClass(type: string): string {
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

/** Whether a payment can be voided. */
export function canVoidPayment(payment: BillingPaymentListItem): boolean {
	return payment.status === "authorized" || payment.status === "pending";
}

/** Whether a payment can be refunded. */
export function canRefundPayment(payment: BillingPaymentListItem): boolean {
	return payment.status === "completed";
}

/** Whether an invoice can be voided (draft only). */
export function canVoidInvoice(invoice: InvoiceListItem): boolean {
	return invoice.status === "draft";
}

/** Whether an invoice can be finalized (draft only). */
export function canFinalizeInvoice(invoice: InvoiceListItem): boolean {
	return invoice.status === "draft";
}

/** Whether a credit note can be issued against an invoice. */
export function canCreditNote(invoice: InvoiceListItem): boolean {
	return invoice.status === "issued" || invoice.status === "paid";
}

/** Whether an invoice can be reopened into a correction draft. */
export function canReopenInvoice(invoice: InvoiceListItem): boolean {
	return invoice.status !== "draft";
}

/** Whether a charge posting can be voided. */
export function canVoidCharge(charge: ChargePostingListItem): boolean {
	return charge.transaction_type === "charge" && !charge.is_voided;
}

/** Whether a folio can be closed / settled. */
export function canCloseFolio(folio: FolioListItem): boolean {
	return folio.folio_status === "open";
}

/** Whether a folio can be reopened for additional postings. */
export function canReopenFolio(folio: FolioListItem): boolean {
	return folio.folio_status === "closed" || folio.folio_status === "settled";
}
