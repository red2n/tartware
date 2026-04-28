import { toNumberOrFallback } from "@tartware/config";
import {
  type CommissionReportItem,
  type DepartmentalRevenueItem,
  type FiscalPeriodListItem,
  FiscalPeriodListItemSchema,
  type FiscalPeriodRow,
  type LedgerEntryListItem,
  LedgerEntryListItemSchema,
  type LedgerEntryRow,
  type TaxConfigurationListItem,
  TaxConfigurationListItemSchema,
  type TaxConfigurationRow,
  type TaxSummaryItem,
  type TrialBalanceResponse,
} from "@tartware/schemas";
import { query } from "../lib/db.js";
import {
  FISCAL_PERIOD_LIST_SQL,
  LEDGER_ENTRY_LIST_SQL,
  TAX_CONFIGURATION_BY_ID_SQL,
  TAX_CONFIGURATION_LIST_SQL,
} from "../sql/finance-admin-queries.js";

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

const mapRowToFiscalPeriod = (row: FiscalPeriodRow): FiscalPeriodListItem => {
  const { display: periodStatusDisplay } = formatEnumDisplay(row.period_status, "Open");

  return FiscalPeriodListItemSchema.parse({
    fiscal_period_id: row.fiscal_period_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    fiscal_year: row.fiscal_year,
    fiscal_year_start: (toIsoString(row.fiscal_year_start) ?? "").split("T")[0],
    fiscal_year_end: (toIsoString(row.fiscal_year_end) ?? "").split("T")[0],
    period_number: row.period_number,
    period_name: row.period_name,
    period_start: (toIsoString(row.period_start) ?? "").split("T")[0],
    period_end: (toIsoString(row.period_end) ?? "").split("T")[0],
    period_status: row.period_status,
    period_status_display: periodStatusDisplay,
    is_reconciled: Boolean(row.is_reconciled),
    closed_at: toIsoString(row.closed_at),
    soft_closed_at: toIsoString(row.soft_closed_at),
    locked_at: toIsoString(row.locked_at),
    total_revenue:
      row.total_revenue != null ? String(toNumberOrFallback(row.total_revenue, 0)) : undefined,
    total_expenses:
      row.total_expenses != null ? String(toNumberOrFallback(row.total_expenses, 0)) : undefined,
    net_income: row.net_income != null ? String(toNumberOrFallback(row.net_income, 0)) : undefined,
    notes: row.notes ?? undefined,
  });
};

const mapRowToLedgerEntry = (row: LedgerEntryRow): LedgerEntryListItem => {
  const { value: status, display: statusDisplay } = formatEnumDisplay(row.status, "Draft");
  const batchStatus = row.batch_status
    ? formatEnumDisplay(row.batch_status, row.batch_status)
    : null;

  return LedgerEntryListItemSchema.parse({
    gl_entry_id: row.gl_entry_id,
    gl_batch_id: row.gl_batch_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    property_name: row.property_name ?? undefined,
    batch_number: row.batch_number ?? undefined,
    batch_date: row.batch_date ? (toIsoString(row.batch_date) ?? "").split("T")[0] : undefined,
    accounting_period: row.accounting_period ?? undefined,
    batch_status: batchStatus?.value,
    batch_status_display: batchStatus?.display,
    folio_id: row.folio_id ?? undefined,
    folio_number: row.folio_number ?? undefined,
    reservation_id: row.reservation_id ?? undefined,
    confirmation_number: row.confirmation_number ?? undefined,
    department_code: row.department_code ?? undefined,
    posting_date: (toIsoString(row.posting_date) ?? "").split("T")[0],
    gl_account_code: row.gl_account_code,
    cost_center: row.cost_center ?? undefined,
    usali_category: row.usali_category ?? undefined,
    description: row.description ?? undefined,
    debit_amount: toNumberOrFallback(row.debit_amount, 0),
    credit_amount: toNumberOrFallback(row.credit_amount, 0),
    currency: row.currency ?? undefined,
    source_table: row.source_table ?? undefined,
    source_id: row.source_id ?? undefined,
    reference_number: row.reference_number ?? undefined,
    status,
    status_display: statusDisplay,
    posted_at: toIsoString(row.posted_at),
    created_at: toIsoString(row.created_at) ?? new Date().toISOString(),
  });
};

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

export const getTaxConfigurationById = async (options: {
  taxConfigId: string;
  tenantId: string;
}): Promise<TaxConfigurationListItem | null> => {
  const { rows } = await query<TaxConfigurationRow>(TAX_CONFIGURATION_BY_ID_SQL, [
    options.taxConfigId,
    options.tenantId,
  ]);

  const row = rows[0];
  if (!row) return null;

  return mapRowToTaxConfiguration(row);
};

export const listFiscalPeriods = async (options: {
  tenantId: string;
  propertyId?: string;
}): Promise<FiscalPeriodListItem[]> => {
  const { rows } = await query<FiscalPeriodRow>(FISCAL_PERIOD_LIST_SQL, [
    options.tenantId,
    options.propertyId ?? null,
  ]);

  return rows.map(mapRowToFiscalPeriod);
};

export const listLedgerEntries = async (options: {
  tenantId: string;
  propertyId?: string;
  status?: string;
  batchStatus?: string;
  glAccountCode?: string;
  departmentCode?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<LedgerEntryListItem[]> => {
  const { rows } = await query<LedgerEntryRow>(LEDGER_ENTRY_LIST_SQL, [
    options.tenantId,
    options.propertyId ?? null,
    options.status ?? null,
    options.batchStatus ?? null,
    options.glAccountCode ?? null,
    options.departmentCode ?? null,
    options.startDate ?? null,
    options.endDate ?? null,
    options.limit ?? 200,
    options.offset ?? 0,
  ]);

  return rows.map(mapRowToLedgerEntry);
};

// ============================================================================
// TRIAL BALANCE
// ============================================================================

export const getTrialBalance = async (options: {
  tenantId: string;
  propertyId?: string;
  businessDate: string;
}): Promise<TrialBalanceResponse> => {
  const { tenantId, propertyId, businessDate } = options;

  const params: unknown[] = [tenantId, businessDate];
  let propFilter = "";
  if (propertyId) {
    params.push(propertyId);
    propFilter = `AND cp.property_id = $${params.length}::uuid`;
  }

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
     LEFT JOIN charge_codes cc ON cc.code = cp.charge_code AND cc.tenant_id = cp.tenant_id
     WHERE cp.tenant_id = $1::uuid
       AND cp.business_date = $2::date
       AND COALESCE(cp.is_voided, false) = false
       ${propFilter}
     GROUP BY COALESCE(cc.department_name, 'UNCATEGORIZED'), cp.charge_code
     ORDER BY department, cp.charge_code`,
    params,
  );

  const totalsParams: unknown[] = [tenantId, businessDate];
  let totalsPropFilter = "";
  if (propertyId) {
    totalsParams.push(propertyId);
    totalsPropFilter = `AND property_id = $${totalsParams.length}::uuid`;
  }

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

  const payParams: unknown[] = [tenantId, businessDate];
  let payPropFilter = "";
  if (propertyId) {
    payParams.push(propertyId);
    payPropFilter = `AND property_id = $${payParams.length}::uuid`;
  }

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

export const getDepartmentalRevenue = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<{ items: DepartmentalRevenueItem[]; total_gross: number; total_net: number }> => {
  const params: unknown[] = [options.tenantId, options.startDate, options.endDate];
  let propFilter = "";
  if (options.propertyId) {
    params.push(options.propertyId);
    propFilter = `AND cp.property_id = $${params.length}::uuid`;
  }

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
     LEFT JOIN charge_codes cc ON cc.code = cp.charge_code AND cc.tenant_id = cp.tenant_id
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

export const getTaxSummary = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<{ items: TaxSummaryItem[]; total_tax_collected: number }> => {
  const params: unknown[] = [options.tenantId, options.startDate, options.endDate];
  let propFilter = "";
  if (options.propertyId) {
    params.push(options.propertyId);
    propFilter = `AND cp.property_id = $${params.length}::uuid`;
  }

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
       COALESCE(SUM(cp.subtotal), 0)::text AS taxable_amount,
       COALESCE(SUM(cp.tax_amount), 0)::text AS tax_collected,
       COUNT(*)::text AS tx_count
     FROM charge_postings cp
     LEFT JOIN tax_configurations tc ON tc.tax_code = cp.tax_code AND tc.tenant_id = cp.tenant_id
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

export const getCommissionReport = async (options: {
  tenantId: string;
  propertyId?: string;
  startDate: string;
  endDate: string;
}): Promise<{ items: CommissionReportItem[]; total_commission: number }> => {
  const params: unknown[] = [options.tenantId, options.startDate, options.endDate];
  let propFilter = "";
  if (options.propertyId) {
    params.push(options.propertyId);
    propFilter = `AND cp.property_id = $${params.length}::uuid`;
  }

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
     LEFT JOIN charge_codes cc ON cc.code = cp.charge_code AND cc.tenant_id = cp.tenant_id
     LEFT JOIN folios f ON f.folio_id = cp.folio_id AND f.tenant_id = cp.tenant_id
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
