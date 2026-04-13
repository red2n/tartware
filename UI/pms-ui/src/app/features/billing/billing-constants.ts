/** Billing view tab identifiers. */
export type BillingView = "payments" | "invoices" | "folios" | "charges" | "routing";

export type PaymentStatusFilter =
	| "ALL"
	| "completed"
	| "pending"
	| "authorized"
	| "failed"
	| "cancelled"
	| "refunded"
	| "partially_refunded";
export type InvoiceStatusFilter = "ALL" | "draft" | "issued" | "paid" | "overdue";
export type FolioStatusFilter = "ALL" | "open" | "closed" | "settled";
export type ChargeTypeFilter = "ALL" | "charge" | "payment" | "adjustment";

export const PAYMENT_STATUS_FILTERS: ReadonlyArray<{ key: PaymentStatusFilter; label: string }> = [
	{ key: "ALL", label: "All" },
	{ key: "completed", label: "Completed" },
	{ key: "pending", label: "Pending" },
	{ key: "authorized", label: "Authorized" },
	{ key: "failed", label: "Failed" },
	{ key: "cancelled", label: "Cancelled" },
	{ key: "refunded", label: "Refunded" },
	{ key: "partially_refunded", label: "Partial Refund" },
];

export const INVOICE_STATUS_FILTERS: ReadonlyArray<{ key: InvoiceStatusFilter; label: string }> = [
	{ key: "ALL", label: "All" },
	{ key: "issued", label: "Issued" },
	{ key: "paid", label: "Paid" },
	{ key: "overdue", label: "Overdue" },
	{ key: "draft", label: "Draft" },
];

export const FOLIO_STATUS_FILTERS: ReadonlyArray<{ key: FolioStatusFilter; label: string }> = [
	{ key: "ALL", label: "All" },
	{ key: "open", label: "Open" },
	{ key: "closed", label: "Closed" },
	{ key: "settled", label: "Settled" },
];

export const CHARGE_TYPE_FILTERS: ReadonlyArray<{ key: ChargeTypeFilter; label: string }> = [
	{ key: "ALL", label: "All" },
	{ key: "charge", label: "Charges" },
	{ key: "payment", label: "Payments" },
	{ key: "adjustment", label: "Adjustments" },
];

export const CHARGE_CODE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "MISC", label: "MISC — Miscellaneous" },
	{ value: "ROOM", label: "ROOM — Room Charge" },
	{ value: "FB", label: "FB — Food & Beverage" },
	{ value: "SPA", label: "SPA — Spa Service" },
	{ value: "MINIBAR", label: "MINIBAR — Minibar" },
	{ value: "PHONE", label: "PHONE — Telephone" },
	{ value: "LAUNDRY", label: "LAUNDRY — Laundry" },
	{ value: "PARKING", label: "PARKING — Parking" },
	{ value: "INTERNET", label: "INTERNET — Internet" },
	{ value: "TRANSPORT", label: "TRANSPORT — Transportation" },
];

export const PAYMENT_METHOD_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "CASH", label: "Cash" },
	{ value: "CREDIT_CARD", label: "Credit Card" },
	{ value: "DEBIT_CARD", label: "Debit Card" },
	{ value: "BANK_TRANSFER", label: "Bank Transfer" },
	{ value: "CHECK", label: "Check" },
	{ value: "MOBILE_WALLET", label: "Mobile Wallet" },
	{ value: "VIRTUAL_CARD", label: "Virtual Card" },
];

export const FOLIO_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
	{ value: "GUEST", label: "Guest Folio" },
	{ value: "MASTER", label: "Master Folio" },
	{ value: "CITY_LEDGER", label: "City Ledger" },
	{ value: "INCIDENTAL", label: "Incidental" },
	{ value: "HOUSE_ACCOUNT", label: "House Account" },
];

export const DEFAULT_PAGE_SIZE = 25;
