import {
  type BillingPaymentListItem,
  BillingPaymentListItemSchema,
  type ChargePostingListItem,
  ChargePostingListItemSchema,
  type FolioListItem,
  FolioListItemSchema,
  type InvoiceListItem,
  InvoiceListItemSchema,
  type TaxConfigurationListItem,
  TaxConfigurationListItemSchema,
} from "@tartware/schemas";

import { applyBillingRetentionPolicy } from "../lib/compliance-policies.js";
import { query } from "../lib/db.js";
import {
  BILLING_PAYMENT_LIST_SQL,
  CHARGE_POSTING_LIST_SQL,
  FOLIO_BY_ID_SQL,
  FOLIO_LIST_SQL,
  INVOICE_BY_ID_SQL,
  INVOICE_LIST_SQL,
  TAX_CONFIGURATION_BY_ID_SQL,
  TAX_CONFIGURATION_LIST_SQL,
} from "../sql/billing-queries.js";
import { toNumberOrFallback } from "../utils/numbers.js";

/**
 * Re-export for backward compatibility.
 */
export const BillingPaymentSchema = BillingPaymentListItemSchema;
export type BillingPayment = BillingPaymentListItem;

type BillingPaymentRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  reservation_id: string | null;
  confirmation_number: string | null;
  guest_id: string | null;
  reservation_guest_name: string | null;
  reservation_guest_email: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  payment_reference: string;
  external_transaction_id: string | null;
  transaction_type: string | null;
  payment_method: string | null;
  amount: number | string | null;
  currency: string | null;
  status: string | null;
  gateway_name: string | null;
  gateway_reference: string | null;
  processed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  version: bigint | null;
};

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
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
};

const resolveGuestName = (row: BillingPaymentRow): string | undefined => {
  if (row.reservation_guest_name) {
    return row.reservation_guest_name;
  }
  if (row.guest_first_name || row.guest_last_name) {
    return `${row.guest_first_name ?? ""} ${row.guest_last_name ?? ""}`.trim() || undefined;
  }
  return undefined;
};

const mapRowToPayment = (row: BillingPaymentRow): BillingPayment => {
  const { value: transactionType, display: transactionTypeDisplay } = formatEnumDisplay(
    row.transaction_type,
    "Unknown",
  );
  const { value: paymentMethod, display: paymentMethodDisplay } = formatEnumDisplay(
    row.payment_method,
    "Unknown",
  );
  const { value: status, display: statusDisplay } = formatEnumDisplay(row.status, "Unknown");

  return BillingPaymentSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    reservation_id: row.reservation_id ?? undefined,
    confirmation_number: row.confirmation_number ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: resolveGuestName(row),
    payment_reference: row.payment_reference,
    external_transaction_id: row.external_transaction_id ?? undefined,
    transaction_type: transactionType,
    transaction_type_display: transactionTypeDisplay,
    payment_method: paymentMethod,
    payment_method_display: paymentMethodDisplay,
    status,
    status_display: statusDisplay,
    amount: toNumberOrFallback(row.amount),
    currency: row.currency ?? "USD",
    processed_at: toIsoString(row.processed_at),
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at),
    version: row.version ? row.version.toString() : "0",
    gateway_name: row.gateway_name ?? undefined,
    gateway_reference: row.gateway_reference ?? undefined,
  });
};

/**
 * List billing payments with optional filters.
 */
export const listBillingPayments = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  transactionType?: string;
  paymentMethod?: string;
  offset?: number;
}): Promise<BillingPayment[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ? options.status.trim().toUpperCase() : null;
  const transactionType = options.transactionType
    ? options.transactionType.trim().toUpperCase()
    : null;
  const paymentMethod = options.paymentMethod ? options.paymentMethod.trim().toUpperCase() : null;
  const offset = options.offset ?? 0;

  const { rows } = await query<BillingPaymentRow>(BILLING_PAYMENT_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    transactionType,
    paymentMethod,
    offset,
  ]);

  return rows.map((row) => applyBillingRetentionPolicy(mapRowToPayment(row)));
};

// ============================================================================
// INVOICES
// ============================================================================

type InvoiceRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  reservation_id: string;
  confirmation_number: string | null;
  guest_id: string;
  guest_name: string | null;
  invoice_number: string;
  invoice_type: string | null;
  invoice_date: string | Date;
  due_date: string | Date | null;
  subtotal: number | string;
  tax_amount: number | string | null;
  discount_amount: number | string | null;
  total_amount: number | string;
  paid_amount: number | string | null;
  balance_due: number | string | null;
  currency: string | null;
  status: string | null;
  sent_at: string | Date | null;
  pdf_url: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  version: bigint | null;
};

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

/**
 * List invoices with optional filters.
 */
export const listInvoices = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  reservationId?: string;
  guestId?: string;
  offset?: number;
}): Promise<InvoiceListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const status = options.status ? options.status.trim().toUpperCase() : null;
  const reservationId = options.reservationId ?? null;
  const guestId = options.guestId ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<InvoiceRow>(INVOICE_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    status,
    reservationId,
    guestId,
    offset,
  ]);

  return rows.map(mapRowToInvoice);
};

/**
 * Get invoice by ID.
 */
export const getInvoiceById = async (
  invoiceId: string,
  tenantId: string,
): Promise<InvoiceListItem | null> => {
  const { rows } = await query<InvoiceRow>(INVOICE_BY_ID_SQL, [invoiceId, tenantId]);

  const [row] = rows;
  if (!row) {
    return null;
  }

  return mapRowToInvoice(row);
};

// ============================================================================
// FOLIOS
// ============================================================================

type FolioRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  folio_number: string;
  folio_type: string;
  folio_status: string;
  reservation_id: string | null;
  confirmation_number: string | null;
  guest_id: string | null;
  guest_name: string | null;
  company_name: string | null;
  balance: number | string;
  total_charges: number | string;
  total_payments: number | string;
  total_credits: number | string;
  currency: string | null;
  opened_at: string | Date;
  closed_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

const mapRowToFolio = (row: FolioRow): FolioListItem => {
  const { value: folioType, display: folioTypeDisplay } = formatEnumDisplay(
    row.folio_type,
    "Guest",
  );
  const { value: folioStatus, display: folioStatusDisplay } = formatEnumDisplay(
    row.folio_status,
    "Open",
  );

  return FolioListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    folio_number: row.folio_number,
    folio_type: folioType,
    folio_type_display: folioTypeDisplay,
    folio_status: folioStatus,
    folio_status_display: folioStatusDisplay,
    reservation_id: row.reservation_id ?? undefined,
    confirmation_number: row.confirmation_number ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: row.guest_name ?? undefined,
    company_name: row.company_name ?? undefined,
    balance: toNumberOrFallback(row.balance),
    total_charges: toNumberOrFallback(row.total_charges),
    total_payments: toNumberOrFallback(row.total_payments),
    total_credits: toNumberOrFallback(row.total_credits),
    currency: row.currency ?? "USD",
    opened_at: toIsoString(row.opened_at) ?? "",
    closed_at: toIsoString(row.closed_at),
    created_at: toIsoString(row.created_at) ?? "",
    updated_at: toIsoString(row.updated_at),
  });
};

/**
 * List folios with optional filters.
 */
export const listFolios = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  folioStatus?: string;
  folioType?: string;
  reservationId?: string;
  guestId?: string;
  offset?: number;
}): Promise<FolioListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const folioStatus = options.folioStatus ? options.folioStatus.trim().toUpperCase() : null;
  const folioType = options.folioType ? options.folioType.trim().toUpperCase() : null;
  const reservationId = options.reservationId ?? null;
  const guestId = options.guestId ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<FolioRow>(FOLIO_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    folioStatus,
    folioType,
    reservationId,
    guestId,
    offset,
  ]);

  return rows.map(mapRowToFolio);
};

/**
 * Get folio by ID.
 */
export const getFolioById = async (
  folioId: string,
  tenantId: string,
): Promise<FolioListItem | null> => {
  const { rows } = await query<FolioRow>(FOLIO_BY_ID_SQL, [folioId, tenantId]);

  const [row] = rows;
  if (!row) {
    return null;
  }

  return mapRowToFolio(row);
};

// ============================================================================
// CHARGE POSTINGS
// ============================================================================

type ChargePostingRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  folio_id: string;
  folio_number: string | null;
  reservation_id: string | null;
  guest_id: string | null;
  guest_name: string | null;
  posting_date: string | Date;
  business_date: string | Date;
  transaction_type: string;
  posting_type: string;
  charge_code: string;
  charge_description: string;
  charge_category: string | null;
  quantity: number | string;
  unit_price: number | string;
  subtotal: number | string;
  tax_amount: number | string | null;
  service_charge: number | string | null;
  discount_amount: number | string | null;
  total_amount: number | string;
  currency: string | null;
  payment_method: string | null;
  source_system: string | null;
  outlet: string | null;
  is_voided: boolean;
  voided_at: string | Date | null;
  void_reason: string | null;
  created_at: string | Date;
  version: bigint | null;
};

const mapRowToChargePosting = (row: ChargePostingRow): ChargePostingListItem => {
  const { value: transactionType, display: transactionTypeDisplay } = formatEnumDisplay(
    row.transaction_type,
    "Charge",
  );
  const { value: postingType, display: postingTypeDisplay } = formatEnumDisplay(
    row.posting_type,
    "Debit",
  );

  return ChargePostingListItemSchema.parse({
    id: row.id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    folio_id: row.folio_id,
    folio_number: row.folio_number ?? undefined,
    reservation_id: row.reservation_id ?? undefined,
    guest_id: row.guest_id ?? undefined,
    guest_name: row.guest_name ?? undefined,
    posting_date: toIsoString(row.posting_date) ?? "",
    business_date: toIsoString(row.business_date) ?? "",
    transaction_type: transactionType,
    transaction_type_display: transactionTypeDisplay,
    posting_type: postingType,
    posting_type_display: postingTypeDisplay,
    charge_code: row.charge_code,
    charge_description: row.charge_description,
    charge_category: row.charge_category ?? undefined,
    quantity: toNumberOrFallback(row.quantity),
    unit_price: toNumberOrFallback(row.unit_price),
    subtotal: toNumberOrFallback(row.subtotal),
    tax_amount: toNumberOrFallback(row.tax_amount),
    service_charge: toNumberOrFallback(row.service_charge),
    discount_amount: toNumberOrFallback(row.discount_amount),
    total_amount: toNumberOrFallback(row.total_amount),
    currency: row.currency ?? "USD",
    payment_method: row.payment_method ?? undefined,
    source_system: row.source_system ?? undefined,
    outlet: row.outlet ?? undefined,
    is_voided: row.is_voided,
    voided_at: toIsoString(row.voided_at),
    void_reason: row.void_reason ?? undefined,
    created_at: toIsoString(row.created_at) ?? "",
    version: row.version ? row.version.toString() : "0",
  });
};

/**
 * List charge postings with optional filters.
 */
export const listChargePostings = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  folioId?: string;
  transactionType?: string;
  chargeCode?: string;
  includeVoided?: boolean;
  offset?: number;
}): Promise<ChargePostingListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const folioId = options.folioId ?? null;
  const transactionType = options.transactionType
    ? options.transactionType.trim().toUpperCase()
    : null;
  const chargeCode = options.chargeCode ?? null;
  const includeVoided = options.includeVoided ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<ChargePostingRow>(CHARGE_POSTING_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    folioId,
    transactionType,
    chargeCode,
    includeVoided === true ? null : false,
    offset,
  ]);

  return rows.map(mapRowToChargePosting);
};

// =====================================================
// TAX CONFIGURATION SERVICE
// =====================================================

type TaxConfigurationRow = {
  tax_config_id: string;
  tenant_id: string;
  property_id: string | null;
  property_name: string | null;
  tax_code: string;
  tax_name: string;
  tax_description: string | null;
  tax_type: string;
  tax_category: string | null;
  country_code: string;
  state_province: string | null;
  city: string | null;
  jurisdiction_name: string | null;
  jurisdiction_level: string | null;
  tax_authority_name: string | null;
  tax_registration_number: string | null;
  tax_rate: number | string;
  is_percentage: boolean;
  fixed_amount: number | string | null;
  effective_from: string | Date;
  effective_to: string | Date | null;
  is_active: boolean;
  calculation_method: string | null;
  calculation_base: string | null;
  is_compound_tax: boolean;
  rounding_method: string | null;
  rounding_precision: number;
  applies_to: string[];
  rate_type: string | null;
  display_on_invoice: boolean;
  display_separately: boolean;
  display_name: string | null;
  display_order: number | null;
  allows_exemptions: boolean;
  exemption_types: string[];
  tax_gl_account: string | null;
  remittance_frequency: string | null;
  times_applied: number;
  total_tax_collected: number | string;
  last_applied_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

const mapRowToTaxConfiguration = (row: TaxConfigurationRow): TaxConfigurationListItem => {
  const { value: taxType, display: taxTypeDisplay } = formatEnumDisplay(row.tax_type, "Other");

  return TaxConfigurationListItemSchema.parse({
    tax_config_id: row.tax_config_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id ?? undefined,
    property_name: row.property_name ?? undefined,
    tax_code: row.tax_code,
    tax_name: row.tax_name,
    tax_description: row.tax_description,
    tax_type: taxType,
    tax_type_display: taxTypeDisplay,
    tax_category: row.tax_category,
    country_code: row.country_code,
    state_province: row.state_province,
    city: row.city,
    jurisdiction_name: row.jurisdiction_name,
    jurisdiction_level: row.jurisdiction_level,
    tax_authority_name: row.tax_authority_name,
    tax_registration_number: row.tax_registration_number,
    tax_rate: toNumberOrFallback(row.tax_rate, 0),
    is_percentage: Boolean(row.is_percentage),
    fixed_amount: row.fixed_amount ? toNumberOrFallback(row.fixed_amount, 0) : null,
    effective_from: (toIsoString(row.effective_from) ?? "").split("T")[0],
    effective_to: row.effective_to ? (toIsoString(row.effective_to) ?? "").split("T")[0] : null,
    is_active: Boolean(row.is_active),
    calculation_method: row.calculation_method,
    calculation_base: row.calculation_base,
    is_compound_tax: Boolean(row.is_compound_tax),
    rounding_method: row.rounding_method,
    rounding_precision: row.rounding_precision ?? 2,
    applies_to: row.applies_to ?? [],
    rate_type: row.rate_type,
    display_on_invoice: Boolean(row.display_on_invoice),
    display_separately: Boolean(row.display_separately),
    display_name: row.display_name,
    display_order: row.display_order,
    allows_exemptions: Boolean(row.allows_exemptions),
    exemption_types: row.exemption_types ?? [],
    tax_gl_account: row.tax_gl_account,
    remittance_frequency: row.remittance_frequency,
    times_applied: row.times_applied ?? 0,
    total_tax_collected: toNumberOrFallback(row.total_tax_collected, 0),
    last_applied_at: toIsoString(row.last_applied_at),
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
    updated_at: toIsoString(row.updated_at),
  });
};

/**
 * List tax configurations with optional filters.
 */
export const listTaxConfigurations = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  taxType?: string;
  isActive?: boolean;
  countryCode?: string;
  jurisdictionLevel?: string;
  offset?: number;
}): Promise<TaxConfigurationListItem[]> => {
  const limit = options.limit ?? 100;
  const tenantId = options.tenantId;
  const propertyId = options.propertyId ?? null;
  const taxType = options.taxType ?? null;
  const isActive = options.isActive ?? null;
  const countryCode = options.countryCode ?? null;
  const jurisdictionLevel = options.jurisdictionLevel ?? null;
  const offset = options.offset ?? 0;

  const { rows } = await query<TaxConfigurationRow>(TAX_CONFIGURATION_LIST_SQL, [
    limit,
    tenantId,
    propertyId,
    taxType,
    isActive,
    countryCode,
    jurisdictionLevel,
    offset,
  ]);

  return rows.map(mapRowToTaxConfiguration);
};

/**
 * Get a single tax configuration by ID.
 */
export const getTaxConfigurationById = async (options: {
  taxConfigId: string;
  tenantId: string;
}): Promise<TaxConfigurationListItem | null> => {
  const { rows } = await query<TaxConfigurationRow>(TAX_CONFIGURATION_BY_ID_SQL, [
    options.taxConfigId,
    options.tenantId,
  ]);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return mapRowToTaxConfiguration(row);
};
