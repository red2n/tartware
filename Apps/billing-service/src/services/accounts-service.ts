import { toNumberOrFallback } from "@tartware/config";
import {
  type AccountsReceivableDetail,
  AccountsReceivableDetailSchema,
  type AccountsReceivableListItem,
  AccountsReceivableListItemSchema,
  type ArAgingSummary,
  ArAgingSummarySchema,
  type InvoiceListItem,
  InvoiceListItemSchema,
  type InvoiceRow,
} from "@tartware/schemas";
import { query } from "../lib/db.js";
import {
  AR_AGING_SUMMARY_SQL,
  AR_BY_ID_SQL,
  AR_LIST_SQL,
  INVOICE_BY_ID_SQL,
  INVOICE_LIST_SQL,
} from "../sql/accounts-queries.js";

const formatEnumDisplay = (
  value: string | null,
  fallback: string,
): { value: string; display: string } => {
  if (!value || typeof value !== "string") {
    const formatted = fallback.toLowerCase();
    return { value: formatted, display: fallback };
  }
  const normalized = value.toLowerCase();
  const display = normalized
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return { value: normalized, display };
};

const toIsoString = (value: string | Date | null): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return value;
};

const formatDisplayLabel = (value: string | null | undefined): string => {
  if (!value || typeof value !== "string") return "Unknown";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const toIso = (val: string | Date | null | undefined): string | undefined => {
  if (!val) return undefined;
  return val instanceof Date ? val.toISOString() : val;
};

// ============================================================================
// INVOICES
// ============================================================================

// InvoiceRow imported from @tartware/schemas

const mapRowToInvoice = (row: InvoiceRow): InvoiceListItem => {
  const { value: invoiceType, display: invoiceTypeDisplay } = formatEnumDisplay(
    row.invoice_type,
    "Standard",
  );
  const { value: status, display: statusDisplay } = formatEnumDisplay(row.status, "Draft");

  return InvoiceListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    reservation_id: row.reservation_id,
    confirmation_number: row.confirmation_number ?? undefined,
    guest_id: row.guest_id,
    guest_name: row.guest_name ?? undefined,
    invoice_number: row.invoice_number,
    invoice_type: invoiceType,
    invoice_type_display: invoiceTypeDisplay,
    invoice_date: toIsoString(row.invoice_date) ?? "",
    due_date: toIsoString(row.due_date),
    subtotal: toNumberOrFallback(row.subtotal),
    tax_amount: toNumberOrFallback(row.tax_amount),
    discount_amount: toNumberOrFallback(row.discount_amount),
    total_amount: toNumberOrFallback(row.total_amount),
    paid_amount: toNumberOrFallback(row.paid_amount),
    balance_due: toNumberOrFallback(row.balance_due),
    currency: row.currency ?? "USD",
    status,
    status_display: statusDisplay,
    sent_at: toIsoString(row.sent_at),
    pdf_url: row.pdf_url ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at),
    version: row.version ? row.version.toString() : "0",
  });
};

export const listInvoices = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  reservationId?: string;
  guestId?: string;
  offset?: number;
}): Promise<InvoiceListItem[]> => {
  const { rows } = await query<InvoiceRow>(INVOICE_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.status ? options.status.trim().toUpperCase() : null,
    options.reservationId ?? null,
    options.guestId ?? null,
    options.offset ?? 0,
  ]);

  return rows.map(mapRowToInvoice);
};

export const getInvoiceById = async (
  invoiceId: string,
  tenantId: string,
): Promise<InvoiceListItem | null> => {
  const { rows } = await query<InvoiceRow>(INVOICE_BY_ID_SQL, [invoiceId, tenantId]);
  const [row] = rows;
  if (!row) return null;
  return mapRowToInvoice(row);
};

// ============================================================================
// ACCOUNTS RECEIVABLE
// ============================================================================

export const listAccountsReceivable = async (options: {
  tenantId: string;
  propertyId?: string;
  status?: string;
  accountType?: string;
  agingBucket?: string;
  limit?: number;
  offset?: number;
  reservationId?: string;
}): Promise<AccountsReceivableListItem[]> => {
  const { rows } = await query(AR_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.status ?? null,
    options.accountType ?? null,
    options.agingBucket ?? null,
    options.offset ?? 0,
    options.reservationId ?? null,
  ]);

  return rows.map((r: Record<string, unknown>) =>
    AccountsReceivableListItemSchema.parse({
      ar_id: r.ar_id,
      tenant_id: r.tenant_id,
      property_id: r.property_id,
      property_name: r.property_name ?? undefined,
      ar_number: r.ar_number,
      ar_reference: r.ar_reference ?? undefined,
      account_type: r.account_type,
      account_type_display: formatDisplayLabel(r.account_type as string),
      account_name: r.account_name,
      guest_id: r.guest_id ?? undefined,
      guest_name: r.guest_name ?? undefined,
      company_id: r.company_id ?? undefined,
      source_type: r.source_type ?? undefined,
      source_reference: r.source_reference ?? undefined,
      reservation_id: r.reservation_id ?? undefined,
      invoice_id: r.invoice_id ?? undefined,
      folio_id: r.folio_id ?? undefined,
      transaction_date: toIso(r.transaction_date as string | Date) ?? "",
      due_date: toIso(r.due_date as string | Date) ?? undefined,
      original_amount: String(r.original_amount ?? "0"),
      outstanding_balance: String(r.outstanding_balance ?? "0"),
      paid_amount: String(r.paid_amount ?? "0"),
      currency: (r.currency as string) ?? "USD",
      ar_status: r.ar_status as string,
      ar_status_display: formatDisplayLabel(r.ar_status as string),
      aging_bucket: r.aging_bucket ?? undefined,
      aging_bucket_display: r.aging_bucket
        ? formatDisplayLabel(r.aging_bucket as string)
        : undefined,
      aging_days: r.aging_days != null ? Number(r.aging_days) : undefined,
      is_overdue: r.is_overdue ?? false,
      payment_terms: r.payment_terms ?? undefined,
      payment_count: r.payment_count != null ? Number(r.payment_count) : undefined,
      last_payment_date: toIso(r.last_payment_date as string | Date) ?? undefined,
      priority: r.priority ?? undefined,
      created_at: toIso(r.created_at as string | Date) ?? "",
    }),
  );
};

export const getAccountsReceivableById = async (options: {
  arId: string;
  tenantId: string;
}): Promise<AccountsReceivableDetail | null> => {
  const { rows } = await query(AR_BY_ID_SQL, [options.arId, options.tenantId]);
  if (rows.length === 0) return null;

  const r = rows[0] as Record<string, unknown>;
  return AccountsReceivableDetailSchema.parse({
    ar_id: r.ar_id,
    tenant_id: r.tenant_id,
    property_id: r.property_id,
    property_name: r.property_name ?? undefined,
    ar_number: r.ar_number,
    ar_reference: r.ar_reference ?? undefined,
    account_type: r.account_type,
    account_type_display: formatDisplayLabel(r.account_type as string),
    account_name: r.account_name,
    account_id: r.account_id ?? undefined,
    account_code: r.account_code ?? undefined,
    guest_id: r.guest_id ?? undefined,
    guest_name: r.guest_name ?? undefined,
    company_id: r.company_id ?? undefined,
    contact_name: r.contact_name ?? undefined,
    contact_email: r.contact_email ?? undefined,
    contact_phone: r.contact_phone ?? undefined,
    billing_address: r.billing_address ?? undefined,
    source_type: r.source_type ?? undefined,
    source_reference: r.source_reference ?? undefined,
    reservation_id: r.reservation_id ?? undefined,
    invoice_id: r.invoice_id ?? undefined,
    folio_id: r.folio_id ?? undefined,
    transaction_date: toIso(r.transaction_date as string | Date) ?? "",
    due_date: toIso(r.due_date as string | Date) ?? undefined,
    original_amount: String(r.original_amount ?? "0"),
    outstanding_balance: String(r.outstanding_balance ?? "0"),
    paid_amount: String(r.paid_amount ?? "0"),
    currency: (r.currency as string) ?? "USD",
    ar_status: r.ar_status as string,
    ar_status_display: formatDisplayLabel(r.ar_status as string),
    aging_bucket: r.aging_bucket ?? undefined,
    aging_bucket_display: r.aging_bucket ? formatDisplayLabel(r.aging_bucket as string) : undefined,
    aging_days: r.aging_days != null ? Number(r.aging_days) : undefined,
    days_overdue: r.days_overdue != null ? Number(r.days_overdue) : undefined,
    is_overdue: r.is_overdue ?? false,
    payment_terms: r.payment_terms ?? undefined,
    payment_terms_days: r.payment_terms_days != null ? Number(r.payment_terms_days) : undefined,
    early_payment_discount_percent:
      r.early_payment_discount_percent != null
        ? String(r.early_payment_discount_percent)
        : undefined,
    early_payment_discount_days:
      r.early_payment_discount_days != null ? Number(r.early_payment_discount_days) : undefined,
    discount_deadline: toIso(r.discount_deadline as string | Date) ?? undefined,
    late_fee_applicable: r.late_fee_applicable ?? undefined,
    late_fees_charged: r.late_fees_charged != null ? String(r.late_fees_charged) : undefined,
    interest_applicable: r.interest_applicable ?? undefined,
    interest_accrued: r.interest_accrued != null ? String(r.interest_accrued) : undefined,
    payment_count: r.payment_count != null ? Number(r.payment_count) : undefined,
    last_payment_date: toIso(r.last_payment_date as string | Date) ?? undefined,
    last_payment_amount: r.last_payment_amount != null ? String(r.last_payment_amount) : undefined,
    payments: r.payments ?? undefined,
    in_collection: r.in_collection ?? undefined,
    collection_notes: r.collection_notes ?? undefined,
    disputed: r.disputed ?? undefined,
    dispute_reason: r.dispute_reason ?? undefined,
    dispute_amount: r.dispute_amount != null ? String(r.dispute_amount) : undefined,
    written_off: r.written_off ?? undefined,
    write_off_amount: r.write_off_amount != null ? String(r.write_off_amount) : undefined,
    write_off_reason: r.write_off_reason ?? undefined,
    write_off_date: toIso(r.write_off_date as string | Date) ?? undefined,
    is_bad_debt: r.is_bad_debt ?? undefined,
    has_payment_plan: r.has_payment_plan ?? undefined,
    installment_count: r.installment_count != null ? Number(r.installment_count) : undefined,
    next_installment_due_date: toIso(r.next_installment_due_date as string | Date) ?? undefined,
    priority: r.priority ?? undefined,
    notes: r.notes ?? undefined,
    internal_notes: r.internal_notes ?? undefined,
    tags: r.tags ?? undefined,
    created_at: toIso(r.created_at as string | Date) ?? "",
    updated_at: toIso(r.updated_at as string | Date) ?? undefined,
  });
};

export const getArAgingSummary = async (options: {
  tenantId: string;
  propertyId?: string;
}): Promise<ArAgingSummary[]> => {
  const { rows } = await query(AR_AGING_SUMMARY_SQL, [
    options.tenantId,
    options.propertyId ?? null,
  ]);

  return rows.map((r: Record<string, unknown>) =>
    ArAgingSummarySchema.parse({
      property_id: r.property_id,
      property_name: r.property_name ?? undefined,
      current: String(r.current_amount ?? "0"),
      days_1_30: String(r.days_1_30 ?? "0"),
      days_31_60: String(r.days_31_60 ?? "0"),
      days_61_90: String(r.days_61_90 ?? "0"),
      days_91_120: String(r.days_91_120 ?? "0"),
      over_120: String(r.over_120 ?? "0"),
      total_outstanding: String(r.total_outstanding ?? "0"),
      total_accounts: Number(r.total_accounts ?? 0),
      currency: (r.currency as string) ?? "USD",
    }),
  );
};
