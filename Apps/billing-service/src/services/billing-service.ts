import {
  type BillingPaymentListItem,
  BillingPaymentListItemSchema,
  type ChargePostingListItem,
  ChargePostingListItemSchema,
  type FolioListItem,
  FolioListItemSchema,
} from "@tartware/schemas";

import { applyBillingRetentionPolicy } from "../lib/compliance-policies.js";
import { query } from "../lib/db.js";
import {
  BILLING_PAYMENT_LIST_SQL,
  CHARGE_POSTING_LIST_SQL,
  FOLIO_BY_ID_SQL,
  FOLIO_LIST_SQL,
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

// ============================================================================
// TRIAL BALANCE
// ============================================================================

type TrialBalanceLineItem = {
  category: string;
  charge_code: string | null;
  debit_total: number;
  credit_total: number;
  net: number;
};

type TrialBalanceReport = {
  business_date: string;
  property_id: string | null;
  line_items: TrialBalanceLineItem[];
  total_debits: number;
  total_credits: number;
  total_payments: number;
  variance: number;
  is_balanced: boolean;
};

/**
 * Generate a trial balance report for a given business date.
 * Verifies that total debits equal total credits + payments collected.
 */
export const getTrialBalance = async (options: {
  tenantId: string;
  propertyId?: string;
  businessDate: string;
}): Promise<TrialBalanceReport> => {
  const { tenantId, propertyId, businessDate } = options;

  const params: unknown[] = [tenantId, businessDate];
  const propFilter = propertyId
    ? (params.push(propertyId), `AND cp.property_id = $${params.length}::uuid`)
    : "";

  // Line items by department and charge code
  const lineItemsResult = await query<{
    department: string;
    charge_code: string | null;
    total_debits: string;
    total_credits: string;
    net: string;
  }>(
    `SELECT
       COALESCE(cc.department_name, 'UNCATEGORIZED') AS department,
       cp.charge_code,
       COALESCE(SUM(CASE WHEN cp.posting_type = 'DEBIT' THEN cp.total_amount ELSE 0 END), 0) AS total_debits,
       COALESCE(SUM(CASE WHEN cp.posting_type = 'CREDIT' THEN cp.total_amount ELSE 0 END), 0) AS total_credits,
       COALESCE(SUM(CASE WHEN cp.posting_type = 'DEBIT' THEN cp.total_amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN cp.posting_type = 'CREDIT' THEN cp.total_amount ELSE 0 END), 0) AS net
     FROM charge_postings cp
     LEFT JOIN charge_codes cc ON cc.code = cp.charge_code
     WHERE cp.tenant_id = $1::uuid
       AND cp.business_date = $2::date
       AND COALESCE(cp.is_voided, false) = false
       ${propFilter}
     GROUP BY COALESCE(cc.department_name, 'UNCATEGORIZED'), cp.charge_code
     ORDER BY department, cp.charge_code`,
    params,
  );

  // Aggregate totals
  const totalsParams: unknown[] = [tenantId, businessDate];
  const totalsPropFilter = propertyId
    ? (totalsParams.push(propertyId), `AND property_id = $${totalsParams.length}::uuid`)
    : "";

  const totalsResult = await query<{
    total_debits: string;
    total_credits: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN posting_type = 'DEBIT' THEN total_amount ELSE 0 END), 0) AS total_debits,
       COALESCE(SUM(CASE WHEN posting_type = 'CREDIT' THEN total_amount ELSE 0 END), 0) AS total_credits
     FROM charge_postings
     WHERE tenant_id = $1::uuid
       AND business_date = $2::date
       AND COALESCE(is_voided, false) = false
       ${totalsPropFilter}`,
    totalsParams,
  );

  // Payments collected for the date
  const payParams: unknown[] = [tenantId, businessDate];
  const payPropFilter = propertyId
    ? (payParams.push(propertyId), `AND property_id = $${payParams.length}::uuid`)
    : "";

  const paymentsResult = await query<{ total_payments: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_payments
     FROM payments
     WHERE tenant_id = $1::uuid
       AND COALESCE(processed_at, created_at)::date = $2::date
       AND status = 'COMPLETED'
       AND transaction_type IN ('CAPTURE', 'REFUND', 'PARTIAL_REFUND')
       ${payPropFilter}`,
    payParams,
  );

  const totalDebits = Number(totalsResult.rows[0]?.total_debits ?? 0);
  const totalCredits = Number(totalsResult.rows[0]?.total_credits ?? 0);
  const totalPayments = Number(paymentsResult.rows[0]?.total_payments ?? 0);
  const variance = totalDebits - totalCredits - totalPayments;

  return {
    business_date: businessDate,
    property_id: propertyId ?? null,
    line_items: lineItemsResult.rows.map((row) => ({
      category: row.department,
      charge_code: row.charge_code,
      debit_total: Number(row.total_debits),
      credit_total: Number(row.total_credits),
      net: Number(row.net),
    })),
    total_debits: totalDebits,
    total_credits: totalCredits,
    total_payments: totalPayments,
    variance,
    is_balanced: Math.abs(variance) < 0.01,
  };
};

// ============================================================================
// DEPARTMENTAL REVENUE REPORT
// ============================================================================

type DepartmentalRevenueItem = {
  department: string;
  charge_count: number;
  gross_revenue: number;
  adjustments: number;
  net_revenue: number;
};

/**
 * Revenue breakdown by department for a business date range.
 */
export const getDepartmentalRevenue = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<{ items: DepartmentalRevenueItem[]; total_gross: number; total_net: number }> => {
  const params: unknown[] = [options.tenantId, options.startDate, options.endDate];
  const propFilter = options.propertyId
    ? (params.push(options.propertyId), `AND cp.property_id = $${params.length}::uuid`)
    : "";

  const { rows } = await query<{
    department: string;
    charge_count: string;
    gross_revenue: string;
    adjustments: string;
    net_revenue: string;
  }>(
    `SELECT
       COALESCE(cc.department_name, 'UNCATEGORIZED') AS department,
       COUNT(*)::text AS charge_count,
       COALESCE(SUM(CASE WHEN cp.posting_type = 'DEBIT' THEN cp.total_amount ELSE 0 END), 0)::text AS gross_revenue,
       COALESCE(SUM(CASE WHEN cp.posting_type = 'CREDIT' THEN cp.total_amount ELSE 0 END), 0)::text AS adjustments,
       (COALESCE(SUM(CASE WHEN cp.posting_type = 'DEBIT' THEN cp.total_amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN cp.posting_type = 'CREDIT' THEN cp.total_amount ELSE 0 END), 0))::text AS net_revenue
     FROM charge_postings cp
     LEFT JOIN charge_codes cc ON cc.code = cp.charge_code
     WHERE cp.tenant_id = $1::uuid
       AND cp.business_date >= $2::date AND cp.business_date <= $3::date
       AND COALESCE(cp.is_voided, false) = false
       ${propFilter}
     GROUP BY COALESCE(cc.department_name, 'UNCATEGORIZED')
     ORDER BY net_revenue DESC`,
    params,
  );

  const totalGross = rows.reduce((s, r) => s + Number(r.gross_revenue), 0);
  const totalNet = rows.reduce((s, r) => s + Number(r.net_revenue), 0);

  return {
    total_gross: Math.round(totalGross * 100) / 100,
    total_net: Math.round(totalNet * 100) / 100,
    items: rows.map((r) => ({
      department: r.department,
      charge_count: parseInt(r.charge_count, 10),
      gross_revenue: Math.round(Number(r.gross_revenue) * 100) / 100,
      adjustments: Math.round(Number(r.adjustments) * 100) / 100,
      net_revenue: Math.round(Number(r.net_revenue) * 100) / 100,
    })),
  };
};

// ============================================================================
// TAX SUMMARY REPORT
// ============================================================================

type TaxSummaryItem = {
  tax_name: string;
  tax_type: string;
  jurisdiction: string;
  taxable_amount: number;
  tax_collected: number;
  transaction_count: number;
};

/**
 * Tax collections summary grouped by tax name / jurisdiction.
 */
export const getTaxSummary = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<{ items: TaxSummaryItem[]; total_tax_collected: number }> => {
  const params: unknown[] = [options.tenantId, options.startDate, options.endDate];
  const propFilter = options.propertyId
    ? (params.push(options.propertyId), `AND cp.property_id = $${params.length}::uuid`)
    : "";

  const { rows } = await query<{
    tax_name: string;
    tax_type: string;
    jurisdiction: string;
    taxable_amount: string;
    tax_collected: string;
    tx_count: string;
  }>(
    `SELECT
       COALESCE(tc.tax_name, cp.charge_code) AS tax_name,
       COALESCE(tc.tax_type, 'OTHER')::text AS tax_type,
       COALESCE(tc.jurisdiction_level, 'N/A')::text AS jurisdiction,
       COALESCE(SUM(cp.base_amount), 0)::text AS taxable_amount,
       COALESCE(SUM(cp.tax_amount), 0)::text AS tax_collected,
       COUNT(*)::text AS tx_count
     FROM charge_postings cp
     LEFT JOIN tax_configurations tc ON tc.charge_code = cp.charge_code AND tc.tenant_id = cp.tenant_id
     WHERE cp.tenant_id = $1::uuid
       AND cp.business_date >= $2::date AND cp.business_date <= $3::date
       AND COALESCE(cp.is_voided, false) = false
       AND cp.tax_amount > 0
       ${propFilter}
     GROUP BY COALESCE(tc.tax_name, cp.charge_code),
              COALESCE(tc.tax_type, 'OTHER'),
              COALESCE(tc.jurisdiction_level, 'N/A')
     ORDER BY SUM(cp.tax_amount) DESC`,
    params,
  );

  const totalTax = rows.reduce((s, r) => s + Number(r.tax_collected), 0);

  return {
    total_tax_collected: Math.round(totalTax * 100) / 100,
    items: rows.map((r) => ({
      tax_name: r.tax_name,
      tax_type: r.tax_type,
      jurisdiction: r.jurisdiction,
      taxable_amount: Math.round(Number(r.taxable_amount) * 100) / 100,
      tax_collected: Math.round(Number(r.tax_collected) * 100) / 100,
      transaction_count: parseInt(r.tx_count, 10),
    })),
  };
};

// ============================================================================
// COMMISSION REPORT
// ============================================================================

type CommissionReportItem = {
  source: string;
  reservation_count: number;
  room_revenue: number;
  commission_amount: number;
  commission_rate_avg: number;
};

/**
 * OTA / agent commission accruals for a date range.
 */
export const getCommissionReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<{ items: CommissionReportItem[]; total_commission: number }> => {
  const params: unknown[] = [options.tenantId, options.startDate, options.endDate];
  const propFilter = options.propertyId
    ? (params.push(options.propertyId), `AND cp.property_id = $${params.length}::uuid`)
    : "";

  const { rows } = await query<{
    source: string;
    reservation_count: string;
    room_revenue: string;
    commission_amount: string;
  }>(
    `SELECT
       COALESCE(r.source, 'DIRECT') AS source,
       COUNT(DISTINCT r.id)::text AS reservation_count,
       COALESCE(SUM(CASE WHEN cc.department_name = 'Rooms Division' THEN cp.total_amount ELSE 0 END), 0)::text AS room_revenue,
       COALESCE(SUM(CASE WHEN cc.department_code = 'COMMISSION' OR cp.charge_code LIKE '%COMM%' THEN cp.total_amount ELSE 0 END), 0)::text AS commission_amount
     FROM charge_postings cp
     LEFT JOIN charge_codes cc ON cc.code = cp.charge_code
     LEFT JOIN folios f ON f.id = cp.folio_id AND f.tenant_id = cp.tenant_id
     LEFT JOIN reservations r ON r.id = f.reservation_id AND r.tenant_id = cp.tenant_id
     WHERE cp.tenant_id = $1::uuid
       AND cp.business_date >= $2::date AND cp.business_date <= $3::date
       AND COALESCE(cp.is_voided, false) = false
       ${propFilter}
     GROUP BY COALESCE(r.source, 'DIRECT')
     ORDER BY commission_amount DESC`,
    params,
  );

  const totalComm = rows.reduce((s, r) => s + Number(r.commission_amount), 0);

  return {
    total_commission: Math.round(totalComm * 100) / 100,
    items: rows.map((r) => {
      const roomRev = Number(r.room_revenue);
      const commAmt = Number(r.commission_amount);
      return {
        source: r.source,
        reservation_count: parseInt(r.reservation_count, 10),
        room_revenue: Math.round(roomRev * 100) / 100,
        commission_amount: Math.round(commAmt * 100) / 100,
        commission_rate_avg: roomRev > 0 ? Math.round((commAmt / roomRev) * 10000) / 100 : 0,
      };
    }),
  };
};

// ============================================================================
// PRE-AUDIT CHECKLIST
// ============================================================================

type PreAuditCheckItem = {
  check: string;
  passed: boolean;
  detail: string;
};

/**
 * Run pre-audit checks for a property's current business date.
 * Returns a checklist with pass/fail per item that front-desk staff
 * should review before starting the night audit.
 */
export const getPreAuditChecklist = async (options: {
  tenantId: string;
  propertyId: string;
}): Promise<{ business_date: string; checks: PreAuditCheckItem[] }> => {
  const { tenantId, propertyId } = options;

  // 1. Get current business date
  const { rows: dateRows } = await query<{
    business_date: string;
    date_status: string;
    night_audit_status: string;
  }>(
    `SELECT business_date::text, date_status, night_audit_status
     FROM business_dates
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND date_status = 'OPEN' AND COALESCE(deleted_at, '9999-12-31'::timestamp) > NOW()
     ORDER BY business_date DESC LIMIT 1`,
    [tenantId, propertyId],
  );

  const businessDate = dateRows[0]?.business_date ?? new Date().toISOString().slice(0, 10);
  const checks: PreAuditCheckItem[] = [];

  // 2. Check no audit already in progress
  const auditStatus = dateRows[0]?.night_audit_status ?? "PENDING";
  checks.push({
    check: "No audit in progress",
    passed: auditStatus === "PENDING" || auditStatus === "FAILED",
    detail:
      auditStatus === "IN_PROGRESS"
        ? "Night audit is currently running"
        : auditStatus === "COMPLETED"
          ? "Night audit already completed for this date"
          : "Ready for audit",
  });

  // 3. Open cashier sessions — all should be closed
  const { rows: openSessions } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM cashier_sessions
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND status = 'OPEN' AND COALESCE(deleted_at, '9999-12-31'::timestamp) > NOW()`,
    [tenantId, propertyId],
  );
  const openCount = Number(openSessions[0]?.cnt ?? 0);
  checks.push({
    check: "All cashier sessions closed",
    passed: openCount === 0,
    detail: openCount > 0 ? `${openCount} cashier session(s) still open` : "All sessions closed",
  });

  // 4. Pending arrivals — expected today that haven't checked in
  const { rows: pendingArrivals } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND check_in_date = $3::date AND status = 'confirmed'
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const arrivalCount = Number(pendingArrivals[0]?.cnt ?? 0);
  checks.push({
    check: "No pending arrivals",
    passed: arrivalCount === 0,
    detail:
      arrivalCount > 0
        ? `${arrivalCount} reservation(s) expected today not yet checked in`
        : "All expected arrivals processed",
  });

  // 5. Pending departures — expected today that haven't checked out
  const { rows: pendingDepartures } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND check_out_date = $3::date AND status = 'checked_in'
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const departureCount = Number(pendingDepartures[0]?.cnt ?? 0);
  checks.push({
    check: "No pending departures",
    passed: departureCount === 0,
    detail:
      departureCount > 0
        ? `${departureCount} guest(s) due out today still checked in`
        : "All departures processed",
  });

  // 6. Unbalanced folios — open folios with unsettled charges
  const { rows: unbalancedFolios } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM folios
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND status = 'open' AND COALESCE(balance_due, 0) != 0
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId],
  );
  const unbalancedCount = Number(unbalancedFolios[0]?.cnt ?? 0);
  checks.push({
    check: "No unbalanced open folios",
    passed: unbalancedCount === 0,
    detail:
      unbalancedCount > 0
        ? `${unbalancedCount} open folio(s) with non-zero balance`
        : "All open folios balanced",
  });

  // 7. Room status verified — no rooms in 'out_of_order' that are occupied
  const { rows: conflictRooms } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM rooms
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND room_status = 'out_of_order' AND occupancy_status = 'occupied'
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId],
  );
  const conflictCount = Number(conflictRooms[0]?.cnt ?? 0);
  checks.push({
    check: "Room statuses consistent",
    passed: conflictCount === 0,
    detail:
      conflictCount > 0
        ? `${conflictCount} room(s) marked out-of-order but occupied`
        : "All room statuses consistent",
  });

  return { business_date: businessDate, checks };
};

// ============================================================================
// BUCKET CHECK (OCCUPANCY VERIFICATION)
// ============================================================================

type BucketCheckItem = {
  category: string;
  expected: number;
  actual: number;
  matched: boolean;
  detail: string;
};

/**
 * Bucket check: compare system occupancy counts against expected
 * room states for a given business date. Helps front desk verify
 * stayover, due-out, and arrival counts match physical reality.
 */
export const getBucketCheck = async (options: {
  tenantId: string;
  propertyId: string;
  businessDate?: string;
}): Promise<{ business_date: string; items: BucketCheckItem[]; is_balanced: boolean }> => {
  const { tenantId, propertyId } = options;

  // Resolve business date
  const bdParam = options.businessDate ?? null;
  const { rows: dateRows } = await query<{ business_date: string }>(
    bdParam
      ? `SELECT $3::date::text AS business_date`
      : `SELECT business_date::text
         FROM business_dates
         WHERE tenant_id = $1::uuid AND property_id = $2::uuid
           AND date_status = 'OPEN' AND COALESCE(deleted_at, '9999-12-31'::timestamp) > NOW()
         ORDER BY business_date DESC LIMIT 1`,
    bdParam ? [tenantId, propertyId, bdParam] : [tenantId, propertyId],
  );
  const businessDate = dateRows[0]?.business_date ?? new Date().toISOString().slice(0, 10);

  const items: BucketCheckItem[] = [];

  // 1. Total sellable rooms
  const { rows: totalRooms } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM rooms
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND room_status != 'out_of_order' AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId],
  );
  const totalSellable = Number(totalRooms[0]?.cnt ?? 0);

  // 2. Rooms physically occupied (occupancy_status = 'occupied')
  const { rows: occupiedRooms } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM rooms
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND occupancy_status = 'occupied' AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId],
  );
  const physicalOccupied = Number(occupiedRooms[0]?.cnt ?? 0);

  // 3. Reservation-based stayovers (checked in, not departing today)
  const { rows: stayovers } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND status = 'checked_in' AND check_out_date > $3::date
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const stayoverCount = Number(stayovers[0]?.cnt ?? 0);

  // 4. Due-outs (checked in, departing today)
  const { rows: dueOuts } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND status = 'checked_in' AND check_out_date = $3::date
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const dueOutCount = Number(dueOuts[0]?.cnt ?? 0);

  // 5. Expected arrivals (confirmed, arriving today)
  const { rows: arrivals } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND check_in_date = $3::date AND status = 'confirmed'
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const arrivalCount = Number(arrivals[0]?.cnt ?? 0);

  // 6. Already checked-in today
  const { rows: checkedInToday } = await query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM reservations
     WHERE tenant_id = $1::uuid AND property_id = $2::uuid
       AND check_in_date = $3::date AND status = 'checked_in'
       AND COALESCE(is_deleted, false) = false`,
    [tenantId, propertyId, businessDate],
  );
  const checkedInTodayCount = Number(checkedInToday[0]?.cnt ?? 0);

  // Expected occupied = stayovers + due-outs (still in-house)
  const expectedOccupied = stayoverCount + dueOutCount;
  const occupancyMatch = physicalOccupied === expectedOccupied;

  items.push(
    {
      category: "Total Sellable Rooms",
      expected: totalSellable,
      actual: totalSellable,
      matched: true,
      detail: `${totalSellable} rooms available (excludes out-of-order)`,
    },
    {
      category: "Occupied Rooms (Physical)",
      expected: expectedOccupied,
      actual: physicalOccupied,
      matched: occupancyMatch,
      detail: occupancyMatch
        ? "Physical occupancy matches reservation count"
        : `Mismatch: ${physicalOccupied} physical vs ${expectedOccupied} expected (${stayoverCount} stayovers + ${dueOutCount} due-outs)`,
    },
    {
      category: "Stayovers",
      expected: stayoverCount,
      actual: stayoverCount,
      matched: true,
      detail: `${stayoverCount} guest(s) staying through tonight`,
    },
    {
      category: "Due-Outs",
      expected: dueOutCount,
      actual: dueOutCount,
      matched: true,
      detail: `${dueOutCount} guest(s) due to depart today`,
    },
    {
      category: "Expected Arrivals",
      expected: arrivalCount,
      actual: checkedInTodayCount,
      matched: arrivalCount === checkedInTodayCount,
      detail:
        arrivalCount === checkedInTodayCount
          ? `All ${arrivalCount} expected arrival(s) checked in`
          : `${checkedInTodayCount} of ${arrivalCount} expected arrival(s) checked in`,
    },
  );

  const isBalanced = items.every((i) => i.matched);

  return { business_date: businessDate, items, is_balanced: isBalanced };
};
